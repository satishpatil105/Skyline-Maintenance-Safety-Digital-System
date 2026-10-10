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
  id: ["Notification ID"],
  date: ["Date"],
  type: ["Notification Type", "Type"],
  asset: ["Asset ID"],
  machine: ["Machine / Equipment", "Machine Name", "Machine"],
  message: ["Message"],
  priority: ["Priority"],
  assigned: ["Assigned To"],
  status: ["Status"],
  due: ["Due Date"],
  by: ["Created By"],
  closed: ["Closed Date"],
  remarks: ["Remarks"],
  created: ["Created At"],
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

      if (lastPm) {
        const due = addInterval(lastPm, freq);
        out.push({
          code: "PMM",
          sourceId: asset,
          type: "PM Due",
          assetId: asset,
          machine,
          due,
          window: leadDays(freq),
          assignedTo: m["Responsible Person"] ?? "",
          critical,
          source: "Machine Master PM Frequency",
          describe: (days) =>
            `Preventive maintenance for ${machine} ${timing(due, days, "due")} (frequency: ${m["PM Frequency"]})`,
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
  for (const [key, item] of lastChecklist) {
    if (/^(not ok|fail|failed|no)$/i.test(item.response.trim())) {
      const machine = machineName(item.assetId);
      out.push({
        code: "CHKDEF",
        sourceId: `${item.assetId}-${idSafe(key)}`,
        type: "Maintenance Pending",
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
    const due = target ?? raised ?? now;

    out.push({
      code: "SAF",
      sourceId: r.recordId,
      type: "Safety Action Due",
      assetId: asset,
      machine,
      due,
      window: target ? 60 : 999,
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

  // --- 7. Document Register Sector: certificates and documents that expire
  const docTab = findTab(tabs, ["document"]);
  if (docTab) {
    const g = reader(docTab);
    for (const row of docTab.rows) {
      const expiry = parseDate(g(row, "Expiry Date", "Expiry"));
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

/**
 * Bring the Notifications sheet in line with the other sheets: add new alerts,
 * refresh the wording/priority of open ones, close those no longer needed.
 */
export function syncNotifications(opts: { today?: string } = {}): Promise<SyncResult> {
  return withDbLock(async () => {
    const store = getStore();
    const db = await readDb();
    const tabs = await store.readAll();

    const ntab = findTab(tabs, ["notification"]);
    if (!ntab) return { created: 0, updated: 0, closed: 0, open: 0, skipped: "There is no Notifications tab in the workbook." };

    const ix = indexOf(ntab);
    if (ix.id < 0 || ix.message < 0 || ix.status < 0) {
      return { created: 0, updated: 0, closed: 0, open: 0, skipped: "The Notifications tab needs 'Notification ID', 'Message' and 'Status' columns." };
    }

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

      const status = days < 0 ? (EXPIRY_TYPES.includes(c.type) ? "Expired" : "Open") : "Due Soon";
      const priority = priorityFor(days, c.critical);
      const message = c.describe(days, now);
      const row = existing.get(id.toLowerCase());

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
      if (AUTO_STATUS.test(current)) put(cells, ix.status, status);
      if (ix.assigned >= 0 && !cells[ix.assigned]?.trim()) put(cells, ix.assigned, c.assignedTo);

      if (!sameCells(cells, row.cells)) {
        put(cells, ix.updated, stamp);
        updates.push({ type: "update", tab: ntab.name, row: row.row, expected: row.cells, cells });
        updated++;
      }
    }

    // Alerts the system made that are no longer needed (part replaced, document renewed...).
    for (const [key, row] of existing) {
      if (!key.startsWith(AUTO_PREFIX.toLowerCase()) || wanted.has(key)) continue;
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
  type: string;
  assetId: string;
  machine: string;
  message: string;
  priority: string;
  assignedTo: string;
  status: string;
  dueDate: string;
  /** Negative when overdue; null when there is no due date. */
  daysLeft: number | null;
}

/** The open alerts (most urgent first), optionally for one machine. */
export async function listAlerts(opts: { assetId?: string; today?: string } = {}): Promise<AlertItem[]> {
  const tabs = await getStore().readAll();
  const ntab = findTab(tabs, ["notification"]);
  if (!ntab) return [];

  const g = reader(ntab);
  const now = todayOf(opts.today);
  const wanted = opts.assetId?.trim().toLowerCase();

  const items: AlertItem[] = [];
  for (const row of ntab.rows) {
    const status = g(row, ...FIELDS.status);
    const message = g(row, ...FIELDS.message);
    if (!message || isFinished(status)) continue;

    const asset = g(row, ...FIELDS.asset);
    if (wanted && asset.toLowerCase() !== wanted) continue;

    const due = parseDate(g(row, ...FIELDS.due));
    items.push({
      id: g(row, ...FIELDS.id),
      type: g(row, ...FIELDS.type),
      assetId: asset,
      machine: g(row, ...FIELDS.machine),
      message,
      priority: g(row, ...FIELDS.priority),
      assignedTo: g(row, ...FIELDS.assigned),
      status,
      dueDate: due ? formatIso(due) : "",
      daysLeft: due ? daysBetween(due, now) : null,
    });
  }

  return items.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
}

/** Mark one alert as done (needs the "Can Approve Close" permission). */
export function closeAlert(id: string, byEmail: string): Promise<{ success: boolean; message: string }> {
  return withDbLock(async () => {
    const store = getStore();
    const tabs = await store.readAll();
    const ntab = findTab(tabs, ["notification"]);
    if (!ntab) return { success: false, message: "There is no Notifications tab in the workbook." };

    const ix = indexOf(ntab);
    const row = ntab.rows.find((r) => String(r.cells[ix.id] ?? "").trim().toLowerCase() === id.trim().toLowerCase());
    if (!id.trim() || !row) return { success: false, message: "That alert was not found." };
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
