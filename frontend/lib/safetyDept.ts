import { formatIso, parseDate, today as todayOf, daysBetween } from "./alertDates";
import { uniqueRecordId, withDbLock } from "./db";
import {
  CATEGORIES,
  FINISHED,
  STATUSES,
  categoryById,
  dropdownsFor,
  headersFor,
  hiraFigures,
  type CategoryId,
  type DeptCategory,
} from "./safetyDeptConfig";
import { getStore, type StoreRow, type TabData } from "./store";

/**
 * The Safety Department: Fire Safety, Employee Safety, HIRA, Environmental and
 * Other. Each category is its own tab in the Excel workbook (created the first
 * time it is needed, dropdown lists included). The record formats live in
 * lib/safetyDeptConfig.ts.
 *
 * Reading is forgiving: columns are matched by header name, so if someone
 * re-orders or renames the tab in Excel the app keeps working. Saving never
 * adds columns to a tab that already exists.
 */

export interface DeptRecord {
  /** Row number in the sheet. */
  row: number;
  recordId: string;
  date: string;
  status: string;
  title: string;
  /** Every column by its header label. */
  values: Record<string, string>;
  /** Target date is in the past and the record is not finished. */
  overdue: boolean;
  /** Days until the target date (negative when late), null without one. */
  daysToTarget: number | null;
  /** Employee Digital Signature / Acceptance status */
  employeeSignStatus?: "Accepted (Digitally Signed)" | "Rejected (Not Received)" | "Pending Signature";
  employeeSignDate?: string;
  digitalSignId?: string;
}

export interface DeptResult {
  success: boolean;
  message: string;
  status?: number;
  recordId?: string;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const squashTab = (s: string) => squash(s.replace(/^\s*\d+\s*[.)-]?\s*/, ""));
const fail = (message: string, status = 400): DeptResult => ({ success: false, message, status });

/** The tab for a category: SHEET_TAB_SAFETY_<ID>, else the name (numbering ignored). */
export function findDeptTab(tabs: TabData[], c: DeptCategory): TabData | undefined {
  const override = process.env[`SHEET_TAB_SAFETY_${c.id.toUpperCase()}`]?.trim();
  if (override) return tabs.find((t) => t.name.trim().toLowerCase() === override.toLowerCase());
  const targetSquash = squashTab(c.tab);
  const targetId = squash(c.id);
  return tabs.find((t) => {
    const sName = squashTab(t.name);
    return (
      sName === targetSquash ||
      sName === targetId ||
      sName.includes(targetId) ||
      (c.id === "fire" && sName.includes("fire")) ||
      (c.id === "employee" && (sName.includes("employee") || sName.includes("emp"))) ||
      (c.id === "hira" && sName.includes("hira")) ||
      (c.id === "environmental" && (sName.includes("env") || sName.includes("environment"))) ||
      (c.id === "other" && sName.includes("other"))
    );
  });
}

function columnMap(tab: TabData): Map<string, number> {
  const map = new Map<string, number>();
  tab.headers.forEach((h, i) => {
    const key = squash(h);
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

const cellAt = (row: StoreRow, cols: Map<string, number>, label: string) => {
  const i = cols.get(squash(label));
  return i === undefined ? "" : String(row.cells[i] ?? "").trim();
};

function toRecord(c: DeptCategory, row: StoreRow, cols: Map<string, number>, now: Date, tab?: TabData): DeptRecord {
  const values: Record<string, string> = {};

  // 1. Copy all raw columns from the row into values so no MongoDB field is lost!
  if (tab?.headers) {
    tab.headers.forEach((h, i) => {
      const val = String(row.cells[i] ?? "").trim();
      if (val) values[h] = val;
    });
  }

  // 2. Also map standard configured headers
  for (const label of headersFor(c)) {
    const val = cellAt(row, cols, label);
    if (val && !values[label]) values[label] = val;
  }

  // 3. Normalize recordId from various MongoDB ID conventions
  const rawId =
    values["Record ID"] ||
    values["Equipment ID"] ||
    values["HIRA ID"] ||
    values["Audit ID"] ||
    values["Item ID"] ||
    values["Equipment ID / Tag"] ||
    values["Safety Record ID"] ||
    values["_id"] ||
    "";

  const fallbackId =
    values["Document ID"] ||
    values["Permit / Consent Name"] ||
    (values["Employee Name"] ? `${values["Employee Name"]}-${values["Event Type"] || "INC"}` : "") ||
    `${c.prefix}-ROW-${row.row}`;

  const recordId = rawId || fallbackId;

  // 4. Normalize Status
  const status =
    values["Status"] ||
    values["Compliance Status"] ||
    values["Audit Status"] ||
    values["Pressure Gauge Status"] ||
    "Open";

  // 5. Normalize Title
  let title = c.headline.map((l) => values[l]).filter(Boolean).join(" - ");
  if (!title) {
    title =
      values["Equipment Type"] ||
      values["Safety Inspection Item"] ||
      values["Process / Activity"] ||
      values["Environmental Aspect"] ||
      values["Event Type"] ||
      values["Activity / Process"] ||
      values["Identified Hazard"] ||
      values["Aspect"] ||
      values["Title"] ||
      recordId;
  }

  // 6. Normalize Location / Area
  if (!values["Location / Area"]) {
    values["Location / Area"] =
      values["Location"] || values["Area"] || values["Department"] || "Main Plant";
  }

  // 7. Normalize Date
  const dateVal =
    values["Date"] ||
    values["Last Inspection Date"] ||
    values["Date of Incident"] ||
    values["Audit Date"] ||
    values["Inspection Date"] ||
    values["Next Due Date"] ||
    values["Report Date"] ||
    (values["Created At"] ? values["Created At"].slice(0, 10) : "") ||
    now.toISOString().slice(0, 10);

  // 8. Normalize Risk Rating
  if (!values["Risk Rating"]) {
    values["Risk Rating"] =
      values["Initial Risk Rating"] ||
      values["Risk Severity"] ||
      values["Risk Level"] ||
      values["Residual Risk Rating"] ||
      "Medium";
  }

  // 9. Normalize Responsible Person
  if (!values["Responsible Person"]) {
    values["Responsible Person"] =
      values["Inspector Name"] ||
      values["Compliance Officer"] ||
      values["Assigned Responsibility"] ||
      values["Employee Name"] ||
      values["Submitted By"] ||
      "";
  }

  // 10. Normalize Remarks / Action
  if (!values["Remarks"]) {
    values["Remarks"] =
      values["Action Taken"] ||
      values["Control Measure"] ||
      values["Observation"] ||
      values["Physical Condition"] ||
      "";
  }

  const remarks = values["Remarks"] || "";
  let employeeSignStatus: DeptRecord["employeeSignStatus"] = "Pending Signature";
  let employeeSignDate = "";
  let digitalSignId = "";
  if (/Accepted \(Digitally Signed\)|Accepted by/i.test(remarks) || values["Employee Sign Status"] === "Accepted (Digitally Signed)") {
    employeeSignStatus = "Accepted (Digitally Signed)";
    const m = remarks.match(/\((DSIG-[^)]+)\)/);
    if (m) digitalSignId = m[1];
    const dm = remarks.match(/on ([0-9/:\-\s,APMapm]+)/);
    if (dm) employeeSignDate = dm[1];
  } else if (/Rejected \(Not Received\)|Rejected by/i.test(remarks) || values["Employee Sign Status"] === "Rejected (Not Received)") {
    employeeSignStatus = "Rejected (Not Received)";
  }

  const target = parseDate(values["Target Date"] || values["Next Due Date"]);
  const daysToTarget = target ? daysBetween(target, now) : null;

  return {
    row: row.row,
    recordId,
    date: dateVal,
    status,
    title: title || recordId,
    values,
    overdue: daysToTarget !== null && daysToTarget < 0 && !FINISHED.test(status),
    daysToTarget,
    employeeSignStatus,
    employeeSignDate,
    digitalSignId,
  };
}

// ------------------------------------------------------------------ reading

/** All records of a category, newest first. `exists` is false until the tab has been created. */
export async function listDeptRecords(id: CategoryId): Promise<{ exists: boolean; records: DeptRecord[] }> {
  const c = categoryById(id);
  if (!c) return { exists: false, records: [] };

  // Map category ID to MongoDB collection name
  const colMap: Record<CategoryId, string> = {
    fire: "fire_safety",
    employee: "employee_safety",
    hira: "hira",
    environmental: "environmental",
    other: "other_safety",
  };
  const colName = colMap[id];

  // Try direct MongoDB query first (fastest path, avoids loading ALL collections)
  try {
    const { getMongoDb } = await import("./mongodb");
    const db = await Promise.race([
      getMongoDb(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("MongoDB timeout")), 12000)),
    ]);
    const docs = await db.collection(colName).find({}).toArray();
    if (docs.length > 0) {
      // Build TabData from raw MongoDB docs
      const headers = Object.keys(docs[0] || {}).filter((k) => k !== "_id" && k !== "__row" && k !== "__v");
      const rows: import("./store").StoreRow[] = docs.map((doc: any, index: number) => ({
        row: index + 2,
        cells: headers.map((h) => String(doc[h] ?? "").trim()),
      }));
      const tab: import("./store").TabData = { name: colName, headers, rows };
      const cols = columnMap(tab);
      const now = todayOf();
      const records = rows
        .map((r) => toRecord(c, r, cols, now, tab))
        .filter((r) => r.recordId || r.title)
        .sort((a, b) => (b.values["Created At"] || b.date).localeCompare(a.values["Created At"] || a.date) || b.row - a.row);
      return { exists: true, records };
    }
  } catch (err) {
    console.warn(`[safetyDept] Direct MongoDB query failed for '${colName}', falling back to store:`, (err as Error)?.message);
  }

  // Fallback: use the store (loads from db.json when MongoDB is down)
  const tabs = await getStore().readAll();
  const tab = findDeptTab(tabs, c);
  if (!tab) return { exists: false, records: [] };

  const cols = columnMap(tab);
  const now = todayOf();
  const records = tab.rows
    .map((r) => toRecord(c, r, cols, now, tab))
    .filter((r) => r.recordId || r.title)
    .sort((a, b) => (b.values["Created At"] || b.date).localeCompare(a.values["Created At"] || a.date) || b.row - a.row);
  return { exists: true, records };
}

export interface CategoryStat {
  id: CategoryId;
  label: string;
  blurb: string;
  exists: boolean;
  total: number;
  open: number;
  overdue: number;
  /** HIRA: open items rated High or Critical; other categories: 0. */
  highRisk: number;
}

export async function safetyOverview(): Promise<CategoryStat[]> {
  try {
    const { getMongoDb } = await import("./mongodb");
    const mongoDb = await Promise.race([
      getMongoDb(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("safetyOverview mongo timeout")), 10000)
      ),
    ]);
    const [fire, emp, hira, env, other] = await Promise.race([
      Promise.all([
        mongoDb.collection("fire_safety").find({}).toArray().catch(() => []),
        mongoDb.collection("employee_safety").find({}).toArray().catch(() => []),
        mongoDb.collection("hira").find({}).toArray().catch(() => []),
        mongoDb.collection("environmental").find({}).toArray().catch(() => []),
        mongoDb.collection("other_safety").find({}).toArray().catch(() => []),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("safetyOverview query timeout")), 10000)
      ),
    ]);

    const stats: CategoryStat[] = [
      {
        id: "fire",
        label: "Fire Safety",
        blurb: "Fire extinguishers, hydrants & alarms",
        exists: true,
        total: fire.length,
        open: fire.filter((r: any) => !/closed|completed|ok|passed/i.test(r.status || r["Compliance Status"] || "")).length,
        overdue: 0,
        highRisk: 0,
      },
      {
        id: "employee",
        label: "Employee Safety",
        blurb: "PPE, incidents & near misses",
        exists: true,
        total: emp.length,
        open: emp.filter((r: any) => !/closed|completed|resolved/i.test(r.status || r.Status || "")).length,
        overdue: 0,
        highRisk: 0,
      },
      {
        id: "hira",
        label: "HIRA",
        blurb: "Hazard identification & risk assessments",
        exists: true,
        total: hira.length,
        open: hira.length,
        overdue: 0,
        highRisk: hira.filter((r: any) => /high|critical/i.test(r["Initial Risk Rating"] || r["Residual Risk Rating"] || r.riskLevel || "")).length,
      },
      {
        id: "environmental",
        label: "Environmental",
        blurb: "Waste, emissions & spill compliance",
        exists: true,
        total: env.length,
        open: env.filter((r: any) => !/compliant|closed|ok/i.test(r.Status || r.status || "")).length,
        overdue: 0,
        highRisk: 0,
      },
      {
        id: "other",
        label: "Other Safety",
        blurb: "General safety observations",
        exists: true,
        total: other.length,
        open: other.filter((r: any) => !/closed|completed|ok/i.test(r["Audit Status"] || r.status || "")).length,
        overdue: 0,
        highRisk: 0,
      },
    ];

    return stats;
  } catch (err) {
    console.warn("[safetyOverview] Fast query fallback:", err);
    return [];
  }
}

// ------------------------------------------------------------------ writing

let safetyTabsEnsured = false;

/** Create any missing Safety Department tabs (harmless when they all exist). */
export function ensureSafetyTabs(): Promise<void> {
  if (safetyTabsEnsured) return Promise.resolve();
  return withDbLock(async () => {
    if (safetyTabsEnsured) return;
    const store = getStore();
    const tabs = await store.readAll();
    if (!tabs.length) return; // the workbook isn't created yet
    const missing = CATEGORIES.filter((c) => !findDeptTab(tabs, c));
    if (!missing.length) {
      safetyTabsEnsured = true;
      return;
    }
    await store.apply(
      missing.map((c) => ({ type: "ensureTab" as const, tab: c.tab, headers: headersFor(c), dropdowns: dropdownsFor(c) }))
    );
    safetyTabsEnsured = true;
  });
}

const MAX_TEXT = 300;
const MAX_LONG = 2000;

/** Check and tidy what the form sent. Returns the values by label, or an error message. */
function cleanValues(c: DeptCategory, input: Record<string, unknown>): { values: Record<string, string> } | { error: string } {
  const values: Record<string, string> = {};

  for (const f of c.fields) {
    if (f.computed) continue;
    let v = String(input[f.label] ?? "").replace(/\r\n/g, "\n").trim();
    if (f.kind !== "textarea") v = v.replace(/\s*\n\s*/g, " ");
    v = v.slice(0, f.kind === "textarea" ? MAX_LONG : MAX_TEXT);

    if (!v) {
      if (f.required) return { error: `${f.label} is required.` };
      values[f.label] = "";
      continue;
    }

    if (f.kind === "select") {
      const match = f.options?.find((o) => o.toLowerCase() === v.toLowerCase());
      if (!match) return { error: `${f.label}: "${v.slice(0, 40)}" is not one of the choices.` };
      v = match;
    } else if (f.kind === "date") {
      const d = parseDate(v);
      if (!d) return { error: `${f.label} is not a valid date.` };
      v = formatIso(d);
    } else if (f.kind === "number") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return { error: `${f.label} must be a number (0 or more).` };
      v = String(n);
    }
    values[f.label] = v;
  }
  return { values };
}

export function saveDeptRecord(
  id: string,
  input: Record<string, unknown>,
  who: { email: string; name: string }
): Promise<DeptResult> {
  const c = categoryById(id);
  if (!c) return Promise.resolve(fail("Unknown Safety Department category.", 404));
  if (!input || typeof input !== "object") return Promise.resolve(fail("No data received."));

  const cleaned = cleanValues(c, input);
  if ("error" in cleaned) return Promise.resolve(fail(cleaned.error));
  const values = cleaned.values;

  const status = STATUSES.find((s) => s.toLowerCase() === String(input["Status"] ?? "Open").trim().toLowerCase());
  if (!status) return Promise.resolve(fail(`Status must be one of: ${STATUSES.join(", ")}.`));

  const dateInput = String(input["Date"] ?? "").trim();
  const dateParsed = dateInput ? parseDate(dateInput) : todayOf();
  if (!dateParsed) return Promise.resolve(fail("Date is not a valid date."));

  const problem = c.check?.(values);
  if (problem) return Promise.resolve(fail(problem));

  const photo = String(input["Photo / Evidence"] ?? "").trim();
  const remarks = String(input["Remarks"] ?? "").trim().slice(0, MAX_LONG);

  return withDbLock(async () => {
    const store = getStore();
    const tabs = await store.readAll({ fresh: true });
    const tab = findDeptTab(tabs, c);
    const tabName = tab?.name ?? c.tab;
    const headers = tab?.headers ?? headersFor(c);

    const cols = new Map<string, number>();
    headers.forEach((h, i) => cols.set(squash(h), i));
    const existingIds = tab ? tab.rows.map((r) => cellAt(r, cols, "Record ID")) : [];

    const now = new Date().toISOString();
    const recordId = uniqueRecordId(c.prefix, existingIds);
    const all: Record<string, string> = {
      ...values,
      ...(c.id === "hira" ? hiraFigures(values) : {}),
      "Record ID": recordId,
      Date: formatIso(dateParsed),
      Status: status,
      Remarks: remarks,
      "Photo / Evidence": photo.startsWith("/api/uploads/") ? photo.slice(0, 300) : "",
      "Submitted By": who.email,
      "Created At": now,
      "Last Updated": now,
      "Closed By": FINISHED.test(status) ? who.name || who.email : "",
    };

    const cells = headers.map((h) => (h ? all[headersFor(c).find((l) => squash(l) === squash(h)) ?? ""] ?? "" : ""));
    await store.apply([
      ...(tab ? [] : [{ type: "ensureTab" as const, tab: tabName, headers, dropdowns: dropdownsFor(c) }]),
      { type: "append", tab: tabName, cells },
    ]);
    return { success: true, status: 201, recordId, message: `${c.label} record ${recordId} saved.` };
  });
}

/** Move a record to another status (needs "Can Approve Close"); the change is noted in Remarks. */
export function updateDeptStatus(
  id: string,
  recordId: string,
  nextStatus: string,
  note: string,
  who: { email: string; name: string }
): Promise<DeptResult> {
  const c = categoryById(id);
  if (!c) return Promise.resolve(fail("Unknown Safety Department category.", 404));
  const status = STATUSES.find((s) => s.toLowerCase() === String(nextStatus ?? "").trim().toLowerCase());
  if (!status) return Promise.resolve(fail(`Status must be one of: ${STATUSES.join(", ")}.`));

  return withDbLock(async () => {
    const store = getStore();
    const tabs = await store.readAll({ fresh: true });
    const tab = findDeptTab(tabs, c);
    if (!tab) return fail("That record was not found.", 404);

    const cols = columnMap(tab);
    const target = String(recordId ?? "").trim().toLowerCase();
    const now = todayOf();

    const row = tab.rows.find((r) => {
      const rec = toRecord(c, r, cols, now);
      return rec.recordId.toLowerCase() === target;
    });

    if (!row) return fail("That record was not found.", 404);

    const cells = [...row.cells];
    while (cells.length < tab.headers.length) cells.push("");
    const set = (label: string, value: string) => {
      let i = cols.get(squash(label));
      if (i === undefined) {
        const catHeaders = headersFor(c);
        const idx = catHeaders.findIndex((h) => squash(h) === squash(label));
        if (idx !== -1) i = idx;
      }
      if (i !== undefined) cells[i] = value;
    };

    set("Record ID", recordId);

    const before = cellAt(row, cols, "Status");
    const today = formatIso(todayOf());
    const line = `${today} ${who.name || who.email}: ${before || "(none)"} -> ${status}${note.trim() ? ` (${note.trim().slice(0, 300)})` : ""}`;
    set("Status", status);
    set("Last Updated", new Date().toISOString());
    set("Closed By", FINISHED.test(status) ? who.name || who.email : "");
    set("Remarks", [cellAt(row, cols, "Remarks"), line].filter(Boolean).join("\n").slice(-MAX_LONG));

    await store.apply([{ type: "update", tab: tab.name, row: row.row, expected: row.cells, cells }]);
    return { success: true, status: 200, recordId, message: `${recordId} is now ${status}.` };
  });
}

/** Get a single Safety Department record by recordId, optionally restricting to a category. */
export async function getDeptRecord(
  recordId: string,
  categoryId?: string
): Promise<{ record: DeptRecord; category: DeptCategory } | null> {
  const tabs = await getStore().readAll();
  const now = todayOf();
  const catList = categoryId ? CATEGORIES.filter((c) => c.id === categoryId) : CATEGORIES;
  const targetId = recordId.trim().toLowerCase();

  for (const c of catList) {
    const tab = findDeptTab(tabs, c);
    if (!tab) continue;
    const cols = columnMap(tab);
    for (const row of tab.rows) {
      const rec = toRecord(c, row, cols, now);
      if (rec.recordId.toLowerCase() === targetId) {
        return { record: rec, category: c };
      }
    }
  }
  return null;
}

/** Record employee mobile digital signature acceptance or rejection. */
export function recordEmployeeSignature(
  recordId: string,
  decision: "yes" | "no",
  signerName: string,
  clientInfo?: { remarks?: string; userAgent?: string; ip?: string }
): Promise<DeptResult & { digitalSignId?: string; statusText?: string }> {
  const targetId = recordId.trim().toLowerCase();
  return withDbLock(async () => {
    const store = getStore();
    const tabs = await store.readAll({ fresh: true });

    // Look across safety categories (employee, hira, etc.)
    for (const c of CATEGORIES) {
      const tab = findDeptTab(tabs, c);
      if (!tab) continue;
      const cols = columnMap(tab);
      const row = tab.rows.find((r) => cellAt(r, cols, "Record ID").toLowerCase() === targetId);
      if (!row) continue;

      const cells = [...row.cells];
      while (cells.length < tab.headers.length) cells.push("");
      const set = (label: string, value: string) => {
        const i = cols.get(squash(label));
        if (i !== undefined) cells[i] = value;
      };

      const now = new Date();
      const dateStr =
        now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) +
        " " +
        now.toLocaleTimeString("en-GB");
      const randHex = Math.random().toString(36).substring(2, 7).toUpperCase();
      const dsigId = `DSIG-${recordId.toUpperCase()}-${randHex}`;

      const statusText = decision === "yes" ? "Accepted (Digitally Signed)" : "Rejected (Not Received)";
      const stamp = `[Digital Sign: ${statusText} by ${signerName.trim() || "Employee"} on ${dateStr} (${dsigId})]${clientInfo?.remarks?.trim() ? ` - Note: ${clientInfo.remarks.trim().slice(0, 300)}` : ""
        }`;

      const currentRemarks = cellAt(row, cols, "Remarks");
      const newRemarks = [currentRemarks, stamp].filter(Boolean).join("\n").slice(-MAX_LONG);
      set("Remarks", newRemarks);

      set("Employee Sign Status", statusText);
      set("Employee Sign Date", dateStr);
      set("Digital Sign ID", dsigId);
      set("Last Updated", now.toISOString());

      // If accepted, update status to Completed if open
      if (decision === "yes") {
        const currentStatus = cellAt(row, cols, "Status");
        if (!FINISHED.test(currentStatus)) {
          set("Status", "Completed");
        }
      }

      await store.apply([{ type: "update", tab: tab.name, row: row.row, expected: row.cells, cells }]);

      return {
        success: true,
        status: 200,
        recordId,
        digitalSignId: dsigId,
        statusText,
        message: `Employee verification recorded: ${statusText}.`,
      };
    }

    return fail("Record ID not found in safety records.", 404);
  });
}

// ------------------------------------------------------------------- alerts

export interface DueItem {
  code: string;
  sourceId: string;
  type: "Fire Equipment Due" | "Safety Action Due" | "Safety Training Due" | "HIRA Review Due" | "Environmental Compliance Due";
  /** Where: shown as the "machine / equipment" of the alert. */
  place: string;
  /** What it is, in a few words, e.g. "Fire Extinguisher Check - FE-012". */
  subject: string;
  due: Date;
  /** "due" for actions and reviews, "expire" for equipment and permits. */
  verb: "due" | "expire";
  window: number;
  assignedTo: string;
  critical: boolean;
  source: string;
}

/** Of several records about the same thing, only the latest one counts (an older inspection is superseded). */
function latestPerKey<T extends { key: string; date: string; row: number }>(items: T[]): T[] {
  const best = new Map<string, T>();
  for (const it of items) {
    const seen = best.get(it.key);
    if (!seen || it.date > seen.date || (it.date === seen.date && it.row > seen.row)) best.set(it.key, it);
  }
  return [...best.values()];
}

/** Everything in the Safety Department tabs that has a date worth an alert. */
export function collectSafetyDeptDue(tabs: TabData[]): DueItem[] {
  const out: DueItem[] = [];
  const now = todayOf();

  for (const c of CATEGORIES) {
    const tab = findDeptTab(tabs, c);
    if (!tab) continue;
    const cols = columnMap(tab);
    const recs = tab.rows.map((r) => toRecord(c, r, cols, now)).filter((r) => r.recordId || r.title);
    const place = (r: DeptRecord) => r.values["Location / Area"] || r.values["Area / Department"] || "";
    const assigned = (r: DeptRecord) => r.values["Responsible Person"];

    // A target date on any record that is still open.
    for (const r of recs) {
      const target = parseDate(r.values["Target Date"]);
      if (!target || FINISHED.test(r.status)) continue;
      const risk = r.values["Risk Rating"] || r.values["Risk Level"] || r.values["Severity"] || "";
      const critical =
        /^(high|critical)$/i.test(risk) || /defective|non-compliant/i.test(`${r.values["Condition"]} ${r.values["Compliance"]}`);
      out.push({
        code: `S${c.prefix}`,
        sourceId: r.recordId,
        type: "Safety Action Due",
        place: place(r),
        subject: `${c.label} action - ${r.title}`.slice(0, 120),
        due: target,
        verb: "due",
        window: 60, // allow up to 60 days advance warning
        assignedTo: assigned(r),
        critical,
        source: `${c.label} record ${r.recordId}`,
      });
    }

    // Dates that repeat: only the latest record about the same thing counts.
    const dated = (
      label: string,
      type: DueItem["type"],
      verb: DueItem["verb"],
      keyOf: (r: DeptRecord) => string,
      subject: (r: DeptRecord) => string,
      windowDays: number = 60
    ) => {
      const items = recs
        .filter((r) => parseDate(r.values[label]))
        .map((r) => ({ r, key: keyOf(r).toLowerCase(), date: r.date, row: r.row }));
      for (const { r } of latestPerKey(items)) {
        const dueDate = parseDate(r.values[label])!;
        const daysLeft = daysBetween(dueDate, now);
        out.push({
          code: `S${c.prefix}D`,
          sourceId: r.recordId,
          type,
          place: place(r),
          subject: subject(r),
          due: dueDate,
          verb,
          window: windowDays,
          assignedTo: assigned(r),
          critical: daysLeft < 0 || /defective/i.test(r.values["Condition"] ?? "") || /^(high|critical)$/i.test(r.values["Risk Rating"] ?? ""),
          source: `${c.label} record ${r.recordId}`,
        });
      }
    };

    if (c.id === "fire") {
      dated(
        "Next Service / Expiry Date",
        "Fire Equipment Due",
        "expire",
        (r) => r.values["Equipment ID / Tag"] || r.recordId,
        (r) => `${r.values["Equipment Type"] || "Fire equipment"}${r.values["Equipment ID / Tag"] ? ` ${r.values["Equipment ID / Tag"]}` : ""} service / expiry`,
        60
      );
    } else if (c.id === "employee") {
      dated(
        "Next Due Date",
        "Safety Training Due",
        "due",
        (r) => `${r.values["Employee ID"] || r.values["Employee Name"]}|${r.values["Training / Topic"] || r.values["Record Type"]}`,
        (r) => `${r.values["Training / Topic"] || r.values["Record Type"]} for ${r.values["Employee Name"]}`,
        60
      );
    } else if (c.id === "hira") {
      dated(
        "Review Date",
        "HIRA Review Due",
        "due",
        (r) => `${r.values["Activity / Process"]}|${r.values["Hazard"]}`,
        (r) => `HIRA review - ${r.values["Activity / Process"]}`,
        60
      );
    } else if (c.id === "environmental") {
      dated(
        "Permit Due Date",
        "Environmental Compliance Due",
        "expire",
        (r) => r.values["Permit / Consent Name"] || r.recordId,
        (r) => `${r.values["Permit / Consent Name"] || "Environmental permit"}`,
        60
      );
    }
  }
  return out;
}
