import {
  addInterval,
  daysBetween,
  formatCompact,
  formatDisplay,
  formatIso,
  intervalDays,
  parseDate,
  parseInterval,
  today as todayOf,
  type Interval,
} from "./alertDates";
import { readDb, withDbLock } from "./db";
import { collectSafetyDeptDue } from "./safetyDept";
import { getStore, sameCells, type StoreOp, type StoreRow, type TabData } from "./store";
import type { Database } from "./types";


type AlertType =
  | "PM Due"
  | "AMC Expiry"
  | "Document Expiry"
  | "Safety Action Due"
  | "Fire Equipment Due"
  | "Safety Training Due"
  | "HIRA Review Due"
  | "Environmental Compliance Due"
  | "Maintenance Pending"
  | "Machine Breakdown"
  | "Checklist Due";

/** Alerts about something that runs out (shown as "Expired" once late) rather than something to do. */
const EXPIRY_TYPES: AlertType[] = [
  "AMC Expiry",
  "Document Expiry",
  "Fire Equipment Due",
  "Environmental Compliance Due",
];

const AUTO_PREFIX = "NTF-";
const AUTO_BY = "System (auto)";
const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

/** Statuses meaning "finished, leave it alone". */
const CLOSED = /^(closed|completed|rejected|cancelled|canceled|inactive|done|on hold|not applicable)$/i;
/** Statuses the system owns; anything else (In Progress...) was set by a person. */
const AUTO_STATUS = /^(due soon|open|expired|)$/i;

// ------------------------------------------------------------ sheet helpers

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const squashTab = (s: string) => squash(s.replace(/^\s*\d+\s*[.)-]?\s*/, ""));
const findTab = (tabs: TabData[], words: string[]) =>
  tabs.find((t) => words.every((w) => squashTab(t.name).includes(w)));
const colOf = (tab: TabData, ...names: string[]) =>
  tab.headers.findIndex((h) => names.some((n) => squash(n) === squash(h)));

/** Read cells of a raw tab by (alias) header name. */
function reader(tab: TabData) {
  const cache = new Map<string, number>();
  return (row: StoreRow, ...names: string[]) => {
    const key = names.join("|");
    if (!cache.has(key)) cache.set(key, colOf(tab, ...names));
    const i = cache.get(key)!;
    return i >= 0 ? String(row.cells[i] ?? "").trim() : "";
  };
}

const FIELDS = {
  id: ["Notification ID", "Alert ID", "id", "Record ID"],
  date: ["Date", "Date & Time", "Created At"],
  type: ["Notification Type", "Type", "Alert Type"],
  asset: ["Asset ID", "Source / Machine", "Machine / Equipment"],
  machine: ["Machine / Equipment", "Machine Name", "Source / Machine", "Machine"],
  message: ["Message", "Alert Title", "Title", "Problem", "Observation"],
  priority: ["Priority", "Severity", "Risk Level"],
  assigned: ["Assigned To", "Target Department", "Responsible Person"],
  status: ["Status", "Compliance Status"],
  due: ["Due Date", "Date & Time", "Date", "Next Due Date"],
  by: ["Created By", "Inspector Name"],
  closed: ["Closed Date"],
  remarks: ["Remarks", "Remarks / Action"],
  created: ["Created At", "Date & Time"],
  updated: ["Last Updated"],
} as const;

type FieldIndex = Record<keyof typeof FIELDS, number>;

const indexOf = (tab: TabData): FieldIndex =>
  Object.fromEntries(
    Object.entries(FIELDS).map(([key, names]) => [key, colOf(tab, ...names)])
  ) as FieldIndex;

const put = (cells: string[], i: number, value: string) => {
  if (i >= 0) cells[i] = value;
};

// -------------------------------------------------------------- the rules

interface Candidate {
  code: string;
  sourceId: string;
  type: AlertType;
  assetId: string;
  machine: string;
  due: Date;
  /** Alert once the due date is within this many days (overdue always alerts). */
  window: number;
  assignedTo: string;
  critical: boolean;
  source: string;
  describe: (days: number, now: Date) => string;
}

const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** "is due on 25-09-2026 (in 5 days)" / "was due on ... (OVERDUE by 3 days)" */
function timing(due: Date, days: number, kind: "due" | "expire"): string {
  const d = formatDisplay(due);
  if (kind === "due") {
    if (days < 0) return `was due on ${d} (OVERDUE by ${plural(-days)})`;
    if (days === 0) return `is due today (${d})`;
    return `is due on ${d} (in ${plural(days)})`;
  }
  if (days < 0) return `expired on ${d} (${plural(-days)} ago)`;
  if (days === 0) return `expires today (${d})`;
  return `expires on ${d} (in ${plural(days)})`;
}

/** How early to warn, based on how often the thing repeats. */
function leadDays(interval: Interval | null): number {
  const override = Number(process.env.NOTIFY_LEAD_DAYS);
  if (override > 0) return override;
  if (!interval) return 60;
  const d = intervalDays(interval);
  if (d <= 7) return 3;
  if (d <= 31) return 14;
  if (d <= 100) return 30;
  return 60;
}

const isFinished = (status: string) => CLOSED.test(status.trim());

function priorityFor(days: number, critical: boolean): (typeof PRIORITIES)[number] {
  let level: number;
  if (days < 0) level = days < -14 ? 3 : 2;
  else if (days <= 7) level = 2;
  else if (days <= 30) level = 1;
  else level = 0;
  if (critical && level < 3) level = Math.max(level + 1, 2);
  return PRIORITIES[level];
}

const idSafe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "").slice(0, 24);

/** Everything in the workbook across all sectors that has a due date or status worth alerting on. */
function collectCandidates(db: Database, tabs: TabData[], now = todayOf()): Candidate[] {
  const out: Candidate[] = [];
  const machineByAsset = new Map(
    db.machines
      .filter((m) => m["Asset ID"])
      .map((m) => [String(m["Asset ID"]).trim().toLowerCase(), m])
  );
  const machineName = (assetId: string, fallback = "") =>
    fallback || machineByAsset.get(assetId.toLowerCase())?.["Machine Name"] || assetId;

  // --- 1. Machine Master: Status alerts (Breakdown, Under Maintenance, Out of Service)
  for (const m of db.machines) {
    const asset = String(m["Asset ID"] ?? "").trim();
    if (!asset) continue;
    const status = String(m.Status ?? "").trim();
    if (!status || /^(running|active|idle|standby|ok|operational)$/i.test(status)) continue;
    const machine = m["Machine Name"] || asset;
    const isBreakdown = /breakdown|stopped|down|fail/i.test(status);
    const critical = isBreakdown || /critical/i.test(m.Criticality ?? "");

    out.push({
      code: "MCHST",
      sourceId: asset,
      type: isBreakdown ? "Machine Breakdown" : "Maintenance Pending",
      assetId: asset,
      machine,
      due: now,
      window: 999,
      assignedTo: m["Responsible Person"] ?? "",
      critical,
      source: `Machine Master Status: ${status}`,
      describe: () => `Machine is marked as "${status}": ${machine} (${asset}) requires maintenance attention`,
    });
  }

  // --- 2. Machine Master: AMC expiry and PM frequency
  for (const m of db.machines) {
    const asset = String(m["Asset ID"] ?? "").trim();
    if (!asset) continue;
    const machine = m["Machine Name"] || asset;
    const critical = /critical/i.test(m.Criticality ?? "");

    const amc = parseDate(m["AMC Expiry"]);
    if (amc) {
      const vendor = m["AMC Vendor"];
      out.push({
        code: "AMCM",
        sourceId: asset,
        type: "AMC Expiry",
        assetId: asset,
        machine,
        due: amc,
        window: 60,
        assignedTo: m["Responsible Person"] ?? "",
        critical,
        source: "Machine Master AMC Expiry",
        describe: (days) => `AMC${vendor ? ` (${vendor})` : ""} for ${machine} ${timing(amc, days, "expire")}`,
      });
    }

    const freq = parseInterval(m["PM Frequency"]);
    if (freq) {
      const lastPm = db.maintenanceRecords
        .filter(
          (r) =>
            String(r.assetId ?? "").trim().toLowerCase() === asset.toLowerCase() &&
            /preventive/i.test(r.recordType ?? "") &&
            /^(completed|closed|done)$/i.test((r.status || r.result || "").trim())
        )
        .map((r) => parseDate(r.completionDate) ?? parseDate(r.date))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      let due: Date | null = null;
      if (lastPm) {
        due = addInterval(lastPm, freq);
      } else {
        const install = parseDate(m["Installation Date"]) ?? parseDate(m["Created At"]);
        if (install) {
          let d = install;
          while (d < now) {
            d = addInterval(d, freq);
          }
          due = d;
        } else {
          due = addInterval(now, freq);
        }
      }

      if (due) {
        out.push({
          code: "PMM",
          sourceId: asset,
          type: "PM Due",
          assetId: asset,
          machine,
          due,
          window: 180,
          assignedTo: m["Responsible Person"] ?? "",
          critical,
          source: "Machine Master PM Frequency",
          describe: (days) =>
            `Preventive maintenance for ${machine} ${timing(due!, days, "due")} (frequency: ${m["PM Frequency"]})`,
        });
      }
    }
  }

  // --- 3. Checklist Sector: Checkpoints reported "Not OK" (defects awaiting repair)
  const lastChecklist = new Map<string, { date: Date; response: string; recordId: string; checkPoint: string; assetId: string }>();
  for (const r of db.maintenanceRecords) {
    if (!/^CHK-/i.test(String(r.recordId ?? "")) || !r.checklistId) continue;
    const d = parseDate(r.date) ?? parseDate(r.createdAt);
    if (!d) continue;
    const key = `${String(r.assetId).toLowerCase()}|${String(r.checklistId).toLowerCase()}`;
    const prev = lastChecklist.get(key);
    if (!prev || d >= prev.date) {
      lastChecklist.set(key, {
        date: d,
        response: String(r.result ?? ""),
        recordId: String(r.recordId ?? ""),
        checkPoint: String(r.checkPoint ?? r.problem ?? r.checklistId),
        assetId: String(r.assetId ?? ""),
      });
    }
  }

  // Also check dedicated checklist records collection
  if (db.checklistRecords && Array.isArray(db.checklistRecords)) {
    for (const cr of db.checklistRecords) {
      const resp = String(cr.response || cr.status || "").trim();
      const d = parseDate(cr.date) ?? parseDate(cr.createdAt);
      if (!d) continue;
      const key = `${String(cr.assetId).toLowerCase()}|${String(cr.checklistId || cr.templateId || cr.recordId).toLowerCase()}`;
      const prev = lastChecklist.get(key);
      if (!prev || d >= prev.date) {
        lastChecklist.set(key, {
          date: d,
          response: resp,
          recordId: String(cr.recordId ?? ""),
          checkPoint: String(cr.checkPoint ?? "Shift Inspection Checkpoint"),
          assetId: String(cr.assetId ?? ""),
        });
      }
    }
  }

  for (const [key, item] of lastChecklist) {
    if (/^(not ok|fail|failed|no)$/i.test(item.response.trim())) {
      const machine = machineName(item.assetId);
      out.push({
        code: "CHKDEF",
        sourceId: `${item.assetId}-${idSafe(key)}`,
        type: "Checklist Due",
        assetId: item.assetId,
        machine,
        due: item.date,
        window: 999,
        assignedTo: "",
        critical: true,
        source: `Checklist defect ${item.recordId}`,
        describe: (_days, n) =>
          `Checklist defect on ${machine}: "${item.checkPoint}" reported ${item.response} on ${formatDisplay(item.date)} (${plural(Math.max(0, daysBetween(n, item.date)))} ago)`,
      });
    }
  }

  // --- 4. Maintenance Records Sector: Open / In-progress work orders & breakdowns
  for (const r of db.maintenanceRecords) {
    const status = String(r.status ?? "").trim();
    if (!status || !r.recordId || isFinished(status) || /^completed$/i.test(r.result ?? "")) continue;
    if (/^CHK-/i.test(String(r.recordId))) continue; // checklist lines handled above

    const raised = parseDate(r.date) ?? parseDate(r.createdAt);
    if (!raised) continue;

    const asset = String(r.assetId ?? "").trim();
    const machine = machineName(asset, r.machineName);
    const problem = String(r.problem ?? "").slice(0, 80);
    const isBreakdown = /breakdown/i.test(`${r.recordType} ${r.problem}`);
    const isUrgent = isBreakdown || /critical|high/i.test(r.priority ?? "");

    out.push({
      code: "MNT",
      sourceId: r.recordId,
      type: isBreakdown ? "Machine Breakdown" : "Maintenance Pending",
      assetId: asset,
      machine,
      due: raised,
      window: 999, // alert immediately while ticket remains open
      assignedTo: r.assignedTo ?? "",
      critical: isUrgent,
      source: `Maintenance record ${r.recordId}`,
      describe: (_days, n) =>
        `${isBreakdown ? "Breakdown" : r.recordType || "Maintenance"} ticket ${r.recordId} on ${machine} is "${status}" (${plural(Math.max(0, daysBetween(n, raised)))} open)${problem ? `: ${problem}` : ""}`,
    });
  }

  // --- 5. Safety Records Sector: Open observations / incidents and target dates
  for (const r of db.safetyRecords) {
    if (!r.recordId || isFinished(r.status ?? "")) continue;
    const asset = String(r.assetId ?? "").trim();
    const machine = machineName(asset, r.machineName);
    const what = String(r.observation || r.safetyType || "Safety action").slice(0, 80);
    const target = parseDate(r.targetDate);
    const raised = parseDate(r.date) ?? parseDate(r.createdAt);
    const due = target ?? (raised ? addInterval(raised, { days: 7 }) : now);

    out.push({
      code: "SAF",
      sourceId: r.recordId,
      type: "Safety Action Due",
      assetId: asset,
      machine,
      due,
      window: 999,
      assignedTo: r.assignedTo ?? "",
      critical: /critical|high/i.test(r.riskLevel ?? ""),
      source: `Safety record ${r.recordId}`,
      describe: (days) =>
        `Safety action on ${machine}: ${what}${target ? ` - target date ${timing(target, days, "due").replace(/^(is|was) due /, "")}` : ` (Status: ${r.status})`}`,
    });
  }

  // --- 6. PM Parts AMC Sector: parts, consumables, services and AMC renewals
  const pmTab = findTab(tabs, ["pm", "part"]);
  if (pmTab) {
    const g = reader(pmTab);
    for (const row of pmTab.rows) {
      const item = g(row, "Item / Part Name", "Item Part Name", "Part Name", "Item");
      if (!item || isFinished(g(row, "Status"))) continue;

      const interval = parseInterval(g(row, "Frequency"));
      const last = parseDate(g(row, "Last Service / Replacement", "Last Service", "Last Replacement"));
      let due = parseDate(g(row, "Next Due Date", "Next Due"));
      if (last && interval) {
        const computed = addInterval(last, interval);
        if (!due || computed > due) due = computed;
      }
      if (!due) continue;

      const asset = g(row, "Asset ID");
      const machine = machineName(asset, g(row, "Machine Name"));
      const itemType = g(row, "Item Type");
      const partNo = g(row, "Part No.", "Part No");
      const vendor = g(row, "AMC Vendor");
      const isAmc = /amc/i.test(itemType);
      const action = /part|consumable|replace|spare|filter/i.test(`${itemType} ${item}`) ? "replacement" : "service";
      const label = `${item}${partNo ? ` (Part No. ${partNo})` : ""}`;

      out.push({
        code: isAmc ? "AMC" : "PM",
        sourceId: g(row, "Record ID") || `${asset}${item}`,
        type: isAmc ? "AMC Expiry" : "PM Due",
        assetId: asset,
        machine,
        due,
        window: 60,
        assignedTo: g(row, "Responsible Person"),
        critical: /critical/i.test(machineByAsset.get(asset.toLowerCase())?.Criticality ?? ""),
        source: `${pmTab.name} row ${row.row}`,
        describe: (days) =>
          isAmc
            ? `AMC${vendor ? ` with ${vendor}` : ""} (${item}) for ${machine} ${timing(due!, days, "expire")}`
            : `${label} for ${machine}: ${action} ${timing(due!, days, "due")}`,
      });
    }
  }

  // --- 6b. PM Parts Direct Fallback: if pmTab is empty, scan db.pmParts directly
  if ((!pmTab || pmTab.rows.length === 0) && db.pmParts && Array.isArray(db.pmParts)) {
    for (const p of db.pmParts) {
      const item = p["Part Name"] || p["Item / Part Name"] || p.partName || "";
      if (!item) continue;
      const status = p["Status"] || p.status || "";
      if (isFinished(status)) continue;

      const due = parseDate(p["Expiry / Due Date"] || p["AMC Expiry"] || p.dueDate);
      const stock = Number(p["Quantity"] || p["Stock Quantity"] || p.stockQty || 99);
      const minStock = Number(p["Min Quantity"] || p["Min Qty"] || p.minQty || 15);
      const asset = p["Asset ID"] || p.assetId || "";
      const machine = machineName(asset, p["Machine / Asset"] || p.machineName);

      if (!isNaN(stock) && stock <= minStock) {
        out.push({
          code: "STK",
          sourceId: p["Part ID"] || p.partId || item,
          type: "Maintenance Pending",
          assetId: asset,
          machine,
          due: now,
          window: 999,
          assignedTo: p["Vendor / AMC"] || p.vendor || "",
          critical: stock <= 5,
          source: `PM Parts Inventory`,
          describe: () =>
            `Low spare part stock for ${machine}: "${item}" has ${stock} units remaining (min required: ${minStock})`,
        });
      }

      if (due) {
        out.push({
          code: "PRTDUE",
          sourceId: p["Part ID"] || p.partId || `${item}-${formatCompact(due)}`,
          type: /amc/i.test(item) ? "AMC Expiry" : "PM Due",
          assetId: asset,
          machine,
          due,
          window: 180,
          assignedTo: p["Vendor / AMC"] || p.vendor || "",
          critical: /critical/i.test(machineByAsset.get(asset.toLowerCase())?.Criticality ?? ""),
          source: `PM Parts Register`,
          describe: (days) =>
            `${item} for ${machine} ${timing(due, days, "due")}`,
        });
      }
    }
  }

  // --- 7. Document Register Sector: certificates and documents that expire
  const docTab = findTab(tabs, ["document"]);
  if (docTab && docTab.rows.length > 0) {
    const g = reader(docTab);
    for (const row of docTab.rows) {
      const expiry = parseDate(g(row, "Expiry Date", "Expiry", "Revision Date"));
      if (!expiry || isFinished(g(row, "Status"))) continue;

      const asset = g(row, "Asset ID");
      const machine = machineName(asset, g(row, "Machine / Equipment", "Machine Name"));
      const docType = g(row, "Document Type");
      const name = g(row, "Document Name");
      const no = g(row, "Document No.", "Document No");

      out.push({
        code: "DOC",
        sourceId: g(row, "Document ID") || `${asset}${name}`,
        type: "Document Expiry",
        assetId: asset,
        machine,
        due: expiry,
        window: 60,
        assignedTo: g(row, "Responsible Person"),
        critical: /critical/i.test(machineByAsset.get(asset.toLowerCase())?.Criticality ?? ""),
        source: `${docTab.name} row ${row.row}`,
        describe: (days) =>
          `${docType || "Document"}${name ? ` "${name}"` : ""}${no ? ` (No. ${no})` : ""} for ${machine} ${timing(expiry, days, "expire")}`,
      });
    }
  } else if (db.documentRegister && Array.isArray(db.documentRegister)) {
    for (const d of db.documentRegister) {
      const expiry = parseDate(d["Revision Date"] || d["Expiry Date"] || d.date);
      if (!expiry || isFinished(d["Status"] || d.status || "")) continue;
      const asset = d["Asset ID"] || d.assetId || "";
      const machine = machineName(asset, d["Machine / Department"] || d.department || d.machineName);
      const title = d["Document Title"] || d.title || "Operating Standard";
      out.push({
        code: "DOC",
        sourceId: d["Doc ID"] || d.docId || `${asset}${title}`,
        type: "Document Expiry",
        assetId: asset,
        machine,
        due: expiry,
        window: 60,
        assignedTo: d["Approved By"] || d.approvedBy || "",
        critical: false,
        source: `Document Register`,
        describe: (days) =>
          `Document revision for ${machine}: "${title}" ${timing(expiry, days, "expire")}`,
      });
    }
  }

  // --- 10-14. Safety Department Sector: Fire equipment, training, HIRA, permits, actions
  for (const item of collectSafetyDeptDue(tabs)) {
    out.push({
      code: item.code,
      sourceId: item.sourceId,
      type: item.type,
      assetId: "",
      machine: item.place,
      due: item.due,
      window: item.window,
      assignedTo: item.assignedTo,
      critical: item.critical,
      source: item.source,
      describe: (days) => `${item.subject}${item.place ? ` (${item.place})` : ""} ${timing(item.due, days, item.verb)}`,
    });
  }

  return out;
}

// ----------------------------------------------------------------- syncing

export interface SyncResult {
  created: number;
  updated: number;
  closed: number;
  /** Alerts open after this run. */
  open: number;
  skipped?: string;
}

const DEFAULT_NOTIF_HEADERS = [
  "Notification ID",
  "Date",
  "Notification Type",
  "Asset ID",
  "Machine / Equipment",
  "Message",
  "Priority",
  "Assigned To",
  "Status",
  "Due Date",
  "Created By",
  "Closed Date",
  "Remarks",
  "Created At",
  "Last Updated",
];

/**
 * Bring the Notifications sheet in line with the other sheets: add new alerts,
 * refresh the wording/priority of open ones, close those no longer needed.
 */
export function syncNotifications(opts: { today?: string } = {}): Promise<SyncResult> {
  return withDbLock(async () => {
    const store = getStore();
    const db = await readDb();
    let tabs = await store.readAll();

    let ntab = findTab(tabs, ["notification"]);
    if (!ntab) {
      ntab = { name: "8. Notifications", headers: DEFAULT_NOTIF_HEADERS, rows: [] };
      tabs.push(ntab);
    }

    const ix = indexOf(ntab);
    const now = todayOf(opts.today);
    const stamp = new Date().toISOString();
    const existing = new Map<string, StoreRow>();
    for (const row of ntab.rows) {
      const id = String(row.cells[ix.id] ?? "").trim();
      if (id) existing.set(id.toLowerCase(), row);
    }

    const updates: StoreOp[] = [];
    const appends: StoreOp[] = [];
    const wanted = new Set<string>();
    let created = 0, updated = 0, closed = 0;

    for (const c of collectCandidates(db, tabs, now)) {
      const days = daysBetween(c.due, now);
      if (days > c.window) continue;

      const id = `${AUTO_PREFIX}${c.code}-${idSafe(c.sourceId)}-${formatCompact(c.due)}`;
      wanted.add(id.toLowerCase());

      const status = days < 0 ? (EXPIRY_TYPES.includes(c.type) ? "Expired" : "Overdue") : days === 0 ? "Due Today" : "Upcoming";
      const priority = priorityFor(days, c.critical);
      const message = c.describe(days, now);
      const normId = id.toLowerCase().replace(/[^a-z0-9]/g, "");
      const row =
        existing.get(id.toLowerCase()) ||
        Array.from(existing.entries()).find(
          ([k]) => k.replace(/[^a-z0-9]/g, "") === normId
        )?.[1];

      if (!row) {
        const cells = ntab.headers.map(() => "");
        put(cells, ix.id, id);
        put(cells, ix.date, formatIso(now));
        put(cells, ix.type, c.type);
        put(cells, ix.asset, c.assetId);
        put(cells, ix.machine, c.machine);
        put(cells, ix.message, message);
        put(cells, ix.priority, priority);
        put(cells, ix.assigned, c.assignedTo);
        put(cells, ix.status, status);
        put(cells, ix.due, formatIso(c.due));
        put(cells, ix.by, AUTO_BY);
        put(cells, ix.remarks, `Auto-generated from ${c.source}`);
        put(cells, ix.created, stamp);
        put(cells, ix.updated, stamp);

        // Also populate any secondary alias columns in ntab
        ntab.headers.forEach((h, hIdx) => {
          const sq = squash(h);
          if ((sq === "alertid" || sq === "id") && !cells[hIdx]) cells[hIdx] = id;
          if ((sq === "title" || sq === "alerttitle") && !cells[hIdx]) cells[hIdx] = message;
          if (sq === "severity" && !cells[hIdx]) cells[hIdx] = priority;
          if (sq === "datetime" && !cells[hIdx]) cells[hIdx] = formatIso(c.due);
          if (sq === "sourcemachine" && !cells[hIdx]) cells[hIdx] = c.machine;
          if (sq === "targetdepartment" && !cells[hIdx]) cells[hIdx] = c.assignedTo;
        });

        appends.push({ type: "append", tab: ntab.name, cells });
        created++;
        continue;
      }

      // Already there: refresh it, unless a person has finished with it.
      const current = String(row.cells[ix.status] ?? "").trim();
      if (isFinished(current)) continue;

      const cells = [...row.cells];
      while (cells.length < ntab.headers.length) cells.push("");
      put(cells, ix.message, message);
      put(cells, ix.priority, priority);
      if (AUTO_STATUS.test(current) || !current) put(cells, ix.status, status);
      if (ix.assigned >= 0 && !cells[ix.assigned]?.trim()) put(cells, ix.assigned, c.assignedTo);

      if (!sameCells(cells, row.cells)) {
        put(cells, ix.updated, stamp);
        updates.push({ type: "update", tab: ntab.name, row: row.row, expected: row.cells, cells });
        updated++;
      }
    }

    const normWanted = new Set<string>();
    for (const w of wanted) normWanted.add(w.replace(/[^a-z0-9]/g, ""));

    // Alerts the system made that are no longer needed (part replaced, document renewed...).
    for (const [key, row] of existing) {
      const normKey = key.replace(/[^a-z0-9]/g, "");
      if (!key.startsWith(AUTO_PREFIX.toLowerCase()) || wanted.has(key) || normWanted.has(normKey)) continue;
      if (isFinished(String(row.cells[ix.status] ?? ""))) continue;

      const cells = [...row.cells];
      while (cells.length < ntab.headers.length) cells.push("");
      put(cells, ix.status, "Closed");
      put(cells, ix.closed, formatIso(now));
      const note = `Auto-closed ${formatIso(now)}: no longer due`;
      put(cells, ix.remarks, [cells[ix.remarks], note].filter(Boolean).join("; "));
      put(cells, ix.updated, stamp);
      updates.push({ type: "update", tab: ntab.name, row: row.row, expected: row.cells, cells });
      closed++;
    }

    const ops = [...updates, ...appends];
    if (ops.length) await store.apply(ops);

    const stillOpen =
      ntab.rows.filter((r) => !isFinished(String(r.cells[ix.status] ?? "")) && String(r.cells[ix.message] ?? "").trim()).length -
      closed +
      created;
    return { created, updated, closed, open: Math.max(0, stillOpen) };
  });
}

// ----------------------------------------------------------------- reading

export interface AlertItem {
  id: string;
  categoryType: "due" | "pending" | "upcoming";
  type: string;
  assetId: string;
  machine: string;
  message: string;
  priority: "Critical" | "High" | "Medium" | "Low" | string;
  assignedTo: string;
  status: string;
  dueDate: string;
  /** Negative when overdue; 0 when due today; positive when upcoming; null when no due date. */
  daysLeft: number | null;
  source?: string;
  createdAt?: string;
}

export interface CategorizedAlertsResult {
  alerts: AlertItem[];
  due: AlertItem[];
  pending: AlertItem[];
  upcoming: AlertItem[];
  counts: {
    total: number;
    due: number;
    pending: number;
    upcoming: number;
    critical: number;
  };
}

/** The open alerts (most urgent first), optionally for one machine or category. */
export async function listAlerts(
  opts: { assetId?: string; today?: string; category?: "all" | "due" | "pending" | "upcoming"; sync?: boolean } = {}
): Promise<AlertItem[]> {
  const store = getStore();
  let tabs = await store.readAll();
  let ntab = findTab(tabs, ["notification"]);

  // Only sync if explicitly requested
  if (opts.sync) {
    await syncNotifications(opts).catch(console.error);
    tabs = await store.readAll({ fresh: true });
    ntab = findTab(tabs, ["notification"]);
  }

  if (!ntab || ntab.rows.length === 0) {
    return [];
  }

  console.log("[listAlerts] ntab found:", ntab.name, "headers:", ntab.headers, "rows count:", ntab.rows.length);

  const g = reader(ntab);
  const now = todayOf(opts.today);
  const wanted = opts.assetId?.trim().toLowerCase();

  const items: AlertItem[] = [];
  for (const row of ntab.rows) {
    const status = g(row, ...FIELDS.status);
    const message = g(row, ...FIELDS.message);
    if (!message || isFinished(status)) {
      continue;
    }

    const asset = g(row, ...FIELDS.asset);
    if (wanted && asset.toLowerCase() !== wanted) continue;

    const due = parseDate(g(row, ...FIELDS.due));
    const days = due ? daysBetween(due, now) : null;
    const type = g(row, ...FIELDS.type);

    let categoryType: "due" | "pending" | "upcoming";
    const isDefect = /defect|not ok|fail|breakdown/i.test(`${type} ${status} ${message}`);
    const isLowStock = /stock|stk|low spare/i.test(`${type} ${status} ${message}`);
    const isSafety = /safety/i.test(`${type} ${message}`);

    if (isDefect) {
      categoryType = "due";
    } else if (isLowStock) {
      categoryType = "pending";
    } else if (isSafety) {
      if (days !== null && days < 0 && /target/i.test(message)) {
        categoryType = "due";
      } else {
        categoryType = "pending";
      }
    } else if (days !== null && days <= 0) {
      categoryType = "due";
    } else {
      categoryType = "upcoming";
    }

    if (opts.category && opts.category !== "all" && categoryType !== opts.category) {
      continue;
    }

    items.push({
      id: g(row, ...FIELDS.id),
      categoryType,
      type: type || "System Alert",
      assetId: asset,
      machine: g(row, ...FIELDS.machine) || asset || "Plant Operations",
      message,
      priority: g(row, ...FIELDS.priority) || "Medium",
      assignedTo: g(row, ...FIELDS.assigned),
      status:
        days !== null && days < 0
          ? `Overdue by ${-days}d`
          : days === 0
          ? "Due Today"
          : status || (categoryType === "upcoming" ? `Due in ${days}d` : "Pending"),
      dueDate: due ? formatIso(due) : "",
      daysLeft: days,
      source: g(row, ...FIELDS.remarks) || g(row, ...FIELDS.by),
      createdAt: g(row, ...FIELDS.date),
    });
  }



  return items.sort((a, b) => {
    const prioWeight = (p: string) => {
      const pl = (p || "").toLowerCase();
      if (pl === "critical") return 40;
      if (pl === "high") return 30;
      if (pl === "medium") return 20;
      return 10;
    };
    const catWeight = (c: string) => {
      if (c === "due") return 100;
      if (c === "pending") return 60;
      return 20;
    };
    const scoreA = catWeight(a.categoryType) + prioWeight(a.priority);
    const scoreB = catWeight(b.categoryType) + prioWeight(b.priority);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
  });
}

/**
 * Returns categorized alerts separated into pending, upcoming, and due with counts.
 */
export async function getCategorizedAlerts(
  opts: { assetId?: string; today?: string; sync?: boolean } = {}
): Promise<CategorizedAlertsResult> {
  const alerts = await listAlerts(opts);
  const due = alerts.filter((a) => a.categoryType === "due");
  const pending = alerts.filter((a) => a.categoryType === "pending");
  const upcoming = alerts.filter((a) => a.categoryType === "upcoming");
  const critical = alerts.filter((a) => (a.priority || "").toLowerCase() === "critical").length;

  return {
    alerts,
    due,
    pending,
    upcoming,
    counts: {
      total: alerts.length,
      due: due.length,
      pending: pending.length,
      upcoming: upcoming.length,
      critical,
    },
  };
}

/** Mark one alert as done (needs the "Can Approve Close" permission). */
export function closeAlert(id: string, byEmail: string): Promise<{ success: boolean; message: string }> {
  return withDbLock(async () => {
    const store = getStore();
    const tabs = await store.readAll();
    const ntab = findTab(tabs, ["notification"]);

    // Update mongoDB directly if collection exists
    try {
      const { getMongoDb } = await import("./mongodb");
      const db = await getMongoDb();
      await db.collection("notifications").updateOne(
        { $or: [{ "Notification ID": id }, { alertId: id }, { "Alert ID": id }, { id }] },
        {
          $set: {
            Status: "Closed",
            status: "Closed",
            ClosedDate: formatIso(todayOf()),
            closedBy: byEmail,
            lastUpdated: new Date().toISOString(),
          },
        }
      );
    } catch { }

    if (!ntab) return { success: true, message: "Alert closed in database." };

    const ix = indexOf(ntab);
    const row = ntab.rows.find((r) => String(r.cells[ix.id] ?? "").trim().toLowerCase() === id.trim().toLowerCase());
    if (!id.trim()) return { success: true, message: "Alert closed." };
    if (!row) {
      const cells = ntab.headers.map(() => "");
      put(cells, ix.id, id);
      put(cells, ix.status, "Closed");
      put(cells, ix.closed, formatIso(todayOf()));
      put(cells, ix.remarks, `Closed by ${byEmail} on ${formatIso(todayOf())}`);
      put(cells, ix.updated, new Date().toISOString());
      await store.apply([{ type: "append", tab: ntab.name, cells }]);
      return { success: true, message: "Alert closed." };
    }
    if (isFinished(String(row.cells[ix.status] ?? ""))) return { success: true, message: "That alert was already closed." };

    const cells = [...row.cells];
    while (cells.length < ntab.headers.length) cells.push("");
    put(cells, ix.status, "Closed");
    put(cells, ix.closed, formatIso(todayOf()));
    put(cells, ix.remarks, [cells[ix.remarks], `Closed by ${byEmail} on ${formatIso(todayOf())}`].filter(Boolean).join("; "));
    put(cells, ix.updated, new Date().toISOString());

    await store.apply([{ type: "update", tab: ntab.name, row: row.row, expected: row.cells, cells }]);
    return { success: true, message: "Alert closed." };
  });
}

/** Clear all notification and alert data across MongoDB, store, and local JSON files. */
export async function clearAllNotifications(): Promise<{ success: boolean; count: number; message: string }> {
  return withDbLock(async () => {
    let count = 0;
    // 1. Delete all records from MongoDB Atlas collection
    try {
      const { getMongoDb } = await import("./mongodb");
      const db = await getMongoDb();
      const res = await db.collection("notifications").deleteMany({});
      count = res.deletedCount || 0;
    } catch (err) {
      console.warn("[clearAllNotifications] MongoDB deletion error:", err);
    }

    // 2. Clear notifications in local data/db.json
    try {
      const fs = await import("fs");
      const path = await import("path");
      const p1 = path.join(process.cwd(), "data", "db.json");
      if (fs.existsSync(p1)) {
        const raw = JSON.parse(fs.readFileSync(p1, "utf-8"));
        raw.notifications = [];
        if (raw.allSheets && raw.allSheets["8. Notifications"]) {
          raw.allSheets["8. Notifications"] = [];
        }
        fs.writeFileSync(p1, JSON.stringify(raw, null, 2), "utf-8");
      }
    } catch (fsErr) {
      console.warn("[clearAllNotifications] db.json clear error:", fsErr);
    }

    // 3. Clear in-memory Store cached tab rows
    try {
      const store = getStore();
      const tabs = await store.readAll();
      const ntab = findTab(tabs, ["notification"]);
      if (ntab) {
        ntab.rows = [];
      }
    } catch (stErr) {
      console.warn("[clearAllNotifications] Store clear error:", stErr);
    }

    return { success: true, count, message: "All notification and alert data removed." };
  });
}
