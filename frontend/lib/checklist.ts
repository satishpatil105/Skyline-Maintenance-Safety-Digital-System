import { emailKey } from "./access";
import {
  addDays,
  addMonths,
  daysBetween,
  getFactoryShiftInfo,
  isSunday,
  niceDate,
  SHIFT_HOURS_LABEL,
  SHIFT_NAME,
  skipSunday,
  toDateString,
  todayString,
  WEEKLY_OFF_DAY,
} from "./dates";
import {
  createRecordId,
  normalize,
  readDb,
  remarksBlock,
  withDbLock,
  writeDb,
} from "./db";
import { getStore } from "./store";
import type { Database, MaintenanceRecord } from "./types";

/**
 * Operator checklists, driven by the "Checklist Master" tab of the workbook:
 * one row per check point (Template ID, Category, Check Point, Frequency,
 * Response, IF Not ok Action, Active). Checklists take no photos (the sheet's
 * "Required Photo" column is ignored).
 *
 * Every answer is saved as a row in "Maintenance Records" (Checklist ID, Check
 * Point and Result are columns there already). Those rows are also what
 * decides what is due: once a check point is filled in, it is LOCKED until it
 * is next due (Daily: tomorrow, Weekly: 7 days later, Monthly: a month later),
 * so weekly and monthly items don't appear in every daily checklist. A check
 * point answered "Not OK" comes back the next day for a re-check.
 */

export interface ChecklistItem {
  assetId?: string;
  templateId: string;
  category: string;
  checkPoint: string;
  standardRequirement?: string;
  frequency: string;
  /** Dropdown choices, e.g. ["OK", "Not OK", "N/A"]. Empty for free text/number. */
  options: string[];
  inputType: "select" | "text" | "number";
  actionIfNotOk: string;
  requiredPhoto?: boolean;
}

export interface ChecklistEntry extends ChecklistItem {
  /** "due": can be filled in now. "locked": already done, waiting for its next due date. */
  status: "due" | "locked";
  /** yyyy-mm-dd it is (or becomes) due. */
  nextDue: string;
  /** "today", "tomorrow", "in 5 days (Sun 27 Sep)" or "overdue by 2 days". */
  nextDueLabel: string;
  /** Days past its due date (weekly/monthly items only), else 0. */
  overdueDays: number;
  last?: { date: string; response: string; by: string };
}

export interface ChecklistAnswer {
  templateId: string;
  response: string;
  remarks?: string;
  photo?: string;
}

const DEFAULT_OPTIONS = ["OK", "Not OK", "N/A"];
const FREQUENCY_ORDER = ["daily", "weekly", "monthly", "quarterly", "half-yearly", "yearly", "as required"];

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const isBad = (response: string) => /^(not ok|no|fail|failed)$/i.test(response.trim());

/** "OK / Not OK / N/A" -> ["OK", "Not OK", "N/A"] (the slash inside "N/A" is kept). */
export function parseResponse(spec: string): { inputType: ChecklistItem["inputType"]; options: string[] } {
  const s = spec.trim();
  if (/^text$/i.test(s)) return { inputType: "text", options: [] };
  if (/^number$/i.test(s)) return { inputType: "number", options: [] };

  const parts = s.split("/").map((p) => p.trim()).filter(Boolean);
  const options: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (/^n$/i.test(parts[i]) && /^a$/i.test(parts[i + 1] ?? "")) {
      options.push("N/A");
      i++;
    } else {
      options.push(parts[i]);
    }
  }
  return options.length >= 2
    ? { inputType: "select", options }
    : { inputType: "select", options: DEFAULT_OPTIONS };
}

/** The checklist tab's name: SHEET_TAB_CHECKLIST, else the first tab named like "2. Checklist Master". */
function findChecklistTab(names: string[]): string | undefined {
  const override = process.env.SHEET_TAB_CHECKLIST?.trim();
  if (override) return names.find((n) => n.trim().toLowerCase() === override.toLowerCase());
  return names.find((n) => squash(n.replace(/^\s*\d+\s*[.)-]?\s*/, "")).includes("checklist"));
}

import { getMongoDb } from "./mongodb";

/** Every ACTIVE check point in the Checklist Master collection / tab. */
export async function loadTemplates(): Promise<ChecklistItem[]> {
  try {
    const mongoDb = await Promise.race([
      getMongoDb(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MongoDB connection timeout")), 15000)
      ),
    ]);
    const docs = await Promise.race([
      mongoDb.collection("checklist_master").find({}).toArray(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MongoDB query timeout")), 15000)
      ),
    ]);
    const activeDocs = docs.filter(
      (d) => !d._init && normalize(d["Active"] || d.active || d.status || d.Status) !== "no" && normalize(d["Active"] || d.active || d.status || d.Status) !== "inactive"
    );
    return activeDocs
      .map((d) => {
        const assetId = String(
          d["Asset ID"] || d["Asset ID / Machine"] || d["Machine / Asset"] || d.assetId || ""
        ).trim();
        const templateId = String(
          d["Template ID"] || d["Checklist ID"] || d.templateId || ""
        ).trim();
        const checkPoint = String(d["Check Point"] || d["Check Point / Task"] || d.checkPoint || "").trim();
        const category = String(d["Category"] || d.category || "General").trim();
        const standardRequirement = String(
          d["Standard Requirement"] || d["Standard / Requirement"] || d["Standard Parameter"] || d.standard || d.standardRequirement || ""
        ).trim();
        const frequency = String(d["Frequency"] || d.frequency || "Daily").trim();
        const actionIfNotOk = String(
          d["If Not OK Action"] || d["IF Not ok Action"] || d.actionIfNotOk || "Report to Maintenance"
        ).trim();
        const requiredPhoto =
          normalize(d["Required Photo"] || d.requiredPhoto) === "yes";
        const { inputType, options } = parseResponse(
          String(d["Response"] || d.response || "OK / Not OK / NA")
        );

        return {
          assetId,
          templateId: templateId || checkPoint.substring(0, 30),
          category,
          checkPoint,
          standardRequirement,
          frequency,
          options,
          inputType,
          actionIfNotOk,
          requiredPhoto,
        };
      })
      .filter((item) => item.checkPoint);
  } catch (e) {
    // Fall through to local store only on connection/query error
  }

  const tabs = await getStore().readAll();
  const tab = tabs.find((t) => t.name === findChecklistTab(tabs.map((x) => x.name)));
  if (!tab) return [];

  const col = new Map<string, number>();
  tab.headers.forEach((h, i) => {
    if (h) col.set(squash(h), i);
  });

  const colIndex = (...headers: string[]) => {
    for (const h of headers) {
      const idx = col.get(squash(h));
      if (idx !== undefined && idx >= 0) return idx;
    }
    return -1;
  };
  const at = (cells: string[], ...headers: string[]) => {
    const idx = colIndex(...headers);
    return idx >= 0 ? String(cells[idx] ?? "").trim() : "";
  };

  const items: ChecklistItem[] = [];
  for (const r of tab.rows) {
    const templateId = at(r.cells, "Template ID");
    const checkPoint = at(r.cells, "Check Point");
    if (!templateId || !checkPoint) continue;
    if (normalize(at(r.cells, "Active")) === "no") continue; // blank counts as active

    const standardRequirement = at(
      r.cells,
      "Standard / Requirement",
      "Standard/Requirement",
      "Standard/Requirment",
      "Standard / Requirment",
      "Standard",
      "Requirement",
      "Standard Requirement"
    );

    const requiredPhoto = normalize(at(r.cells, "Required Photo", "RequiredPhoto", "Photo Required", "Photo")) === "yes";

    const { inputType, options } = parseResponse(at(r.cells, "Response"));
    items.push({
      templateId,
      category: at(r.cells, "Category") || "General",
      checkPoint,
      standardRequirement,
      frequency: at(r.cells, "Frequency") || "Daily",
      options,
      inputType,
      actionIfNotOk: at(r.cells, "IF Not ok Action"),
      requiredPhoto,
    });
  }
  return items;
}

/**
 * Which check points apply to a machine:
 * Matches templates to a specific machine so that scanning machine 1 shows
 * ONLY machine 1's checklist points, and scanning machine 2 shows ONLY machine 2's.
 */
function templatesFor(machine: Record<string, string>, all: ChecklistItem[]): ChecklistItem[] {
  const assetId = String(machine["Asset ID"] ?? machine["assetId"] ?? "").trim().toUpperCase();
  const machineName = normalize(machine["Machine Name"] ?? machine["name"] ?? "");
  const machineCat = normalize(machine["Category"] ?? machine["category"] ?? "");

  // 1. Direct Asset ID match from Machine Master
  const directAssetMatches = all.filter((t) => {
    const tAsset = normalize(t.assetId || (t as any)["Asset ID"] || (t as any)["Asset ID / Machine"] || (t as any)["Machine / Asset"] || "");
    return tAsset && (tAsset === normalize(assetId) || tAsset === "all" || tAsset === "all machines");
  });
  if (directAssetMatches.length > 0) {
    return directAssetMatches;
  }

  // Priority-ordered matching rules: specific accessory/utility types evaluated first
  // so host prefixes like "LSR" in "SKY-LSR-ACM-001" or "TPP" in "SKY-TPP-PUN-STB-001" do not misroute
  const rules: {
    categoryNames: string[];
    prefix: string;
    test: () => boolean;
  }[] = [
      // 1. Air Compressor
      {
        categoryNames: ["Air Compressor", "Air Compressor - 5S"],
        prefix: "CMP",
        test: () =>
          assetId.includes("ACM") ||
          assetId.includes("CMP") ||
          machineName.includes("compressor") ||
          machineCat.includes("compressor"),
      },
      // 2. UPS
      {
        categoryNames: ["UPS", "UPS - 5S"],
        prefix: "UPS",
        test: () =>
          assetId.includes("UPS") ||
          machineName.includes("ups") ||
          machineCat.includes("ups"),
      },
      // 3. Stabilizer
      {
        categoryNames: ["Stabilizer", "Stabilizer - 5S"],
        prefix: "STB",
        test: () =>
          assetId.includes("STB") ||
          machineName.includes("stabil") ||
          machineCat.includes("stabil"),
      },
      // 4. Powder Spray Gun
      {
        categoryNames: ["Powder Spray Gun", "Powder Spray Gun - 5S"],
        prefix: "GUN",
        test: () =>
          assetId.includes("GUN") ||
          machineName.includes("gun") ||
          machineCat.includes("gun"),
      },
      // 5. Powder Coating Oven
      {
        categoryNames: ["Powder Coating Oven", "Powder Coating Oven - 5S"],
        prefix: "OVN",
        test: () =>
          assetId.includes("OVN") ||
          machineName.includes("oven") ||
          machineCat.includes("oven"),
      },
      // 6. Powder Spray Booth
      {
        categoryNames: ["Powder Spray Booth", "Powder Spray Booth - 5S"],
        prefix: "SPB",
        test: () =>
          assetId.includes("SPB") ||
          machineName.includes("booth") ||
          machineCat.includes("booth"),
      },
      // 7. Pneumatic Machine / Blower
      {
        categoryNames: ["Pneumatic Machine", "Pneumatic Machine - 5S"],
        prefix: "PNM",
        test: () =>
          assetId.includes("PNM") ||
          assetId.includes("BLW") ||
          machineName.includes("blower") ||
          machineName.includes("pneumatic") ||
          machineName.includes("pemunatic") ||
          machineCat.includes("blower") ||
          machineCat.includes("pneumatic"),
      },
      // 8. Electrical Panel
      {
        categoryNames: ["Electrical Panel", "Electrical Panel - 5S"],
        prefix: "PNL",
        test: () =>
          assetId.includes("PNL") ||
          machineName.includes("panel") ||
          machineCat.includes("panel") ||
          machineName.includes("electrical"),
      },
      // 9. Drill Machine
      {
        categoryNames: ["Drill Machine", "Drill Machine - 5S"],
        prefix: "DRL",
        test: () =>
          assetId.includes("DRL") ||
          machineName.includes("drill") ||
          machineCat.includes("drill"),
      },
      // 10. Grinder Machine
      {
        categoryNames: ["Grinder Machine", "Grinder Machine - 5S"],
        prefix: "GRD",
        test: () =>
          assetId.includes("GRD") ||
          machineName.includes("grind") ||
          machineName.includes("grand") ||
          machineCat.includes("grind") ||
          machineCat.includes("grand"),
      },
      // 11. EOT Crane
      {
        categoryNames: ["EOT Crane", "EOT Crane - 5S"],
        prefix: "CRN",
        test: () =>
          assetId.includes("EOT") ||
          assetId.includes("CRN") ||
          machineName.includes("crane") ||
          machineName.includes("craen") ||
          machineCat.includes("crane") ||
          machineCat.includes("craen"),
      },
      // 12. CO2 Welding Machine
      {
        categoryNames: ["CO2 Welding Machine", "CO2 Welding Machine - 5S"],
        prefix: "WLD",
        test: () =>
          assetId.includes("WLD") ||
          machineName.includes("weld") ||
          machineCat.includes("weld"),
      },
      // 13. Turret Punch
      {
        categoryNames: ["Turret Punch", "Turret Punch - 5S"],
        prefix: "TPP",
        test: () =>
          assetId.includes("TPP") ||
          assetId.includes("PUN") ||
          machineName.includes("punch") ||
          machineCat.includes("punch"),
      },
      // 14. CNC Shearing Machine
      {
        categoryNames: ["CNC Shearing Machine", "CNC Shearing Machine - 5S"],
        prefix: "SHR",
        test: () =>
          assetId.includes("SHR") ||
          machineName.includes("shear") ||
          machineName.includes("shar") ||
          machineCat.includes("shear") ||
          machineCat.includes("shar"),
      },
      // 15. Bending Machine
      {
        categoryNames: ["Bending Machine", "Bending Machine - 5S"],
        prefix: "BND",
        test: () =>
          assetId.includes("BND") ||
          machineName.includes("bend") ||
          machineCat.includes("bend"),
      },
      // 16. Laser Cutting
      {
        categoryNames: ["Laser Cutting", "Laser Cutting - 5S"],
        prefix: "LSR",
        test: () =>
          assetId.includes("LSR") ||
          machineName.includes("laser") ||
          machineCat.includes("laser"),
      },
    ];

  let matched: ChecklistItem[] = [];

  for (const rule of rules) {
    if (rule.test()) {
      matched = all.filter(
        (t) =>
          rule.categoryNames.some((c) => normalize(c) === normalize(t.category)) ||
          t.templateId.toUpperCase().startsWith(rule.prefix + "-")
      );
      if (matched.length > 0) break;
    }
  }

  // Fallback 1: Token match between assetId and templateId
  if (matched.length === 0) {
    const assetTokens = assetId
      .split(/[^A-Z0-9]+/)
      .filter((tok) => tok.length >= 3 && !/^(SKY|MCH|UTL|MNT|00\d|\d+)$/.test(tok));

    matched = all.filter((t) => {
      const tTokens = t.templateId
        .toUpperCase()
        .split(/[^A-Z0-9]+/)
        .filter((tok) => tok.length >= 3 && !/^(CHK|TMP|\d+)$/.test(tok));
      return tTokens.some((tok) => assetTokens.includes(tok));
    });
  }

  // Fallback 2: Exact category name if not generic "machine"
  if (matched.length === 0 && machineCat && machineCat !== "machine") {
    matched = all.filter((t) =>
      normalize(t.category) === machineCat ||
      normalize(t.category) === `${machineCat} - 5s` ||
      normalize(t.category) === `${machineCat} 5s`
    );
  }

  return matched;
}

const frequencyRank = (f: string) => {
  const i = FREQUENCY_ORDER.indexOf(f.toLowerCase());
  return i === -1 ? 99 : i;
};

// ------------------------------------------------------------ due / locked

type Interval = { days: number } | { months: number } | null;

/** How long a completed check point stays locked. null = never locked ("As Required"). */
function intervalFor(frequency: string): Interval {
  switch (squash(frequency)) {
    case "daily":
      return { days: 1 };
    case "weekly":
      return { days: 7 };
    case "fortnightly":
      return { days: 14 };
    case "monthly":
      return { months: 1 };
    case "quarterly":
      return { months: 3 };
    case "halfyearly":
    case "6month":
    case "6months":
      return { months: 6 };
    case "yearly":
    case "annually":
    case "annual":
      return { months: 12 };
    default:
      return null;
  }
}

const applyInterval = (date: string, i: NonNullable<Interval>) =>
  "days" in i ? addDays(date, i.days) : addMonths(date, i.months);

/** The date a check point unlocks after being done on `doneOn` (Not OK = re-check tomorrow). */
function unlockDate(frequency: string, doneOn: string, wasBad: boolean): string {
  const interval = intervalFor(frequency);
  const raw = wasBad || !interval ? addDays(doneOn, 1) : applyInterval(doneOn, interval);
  // Sunday is a weekly off: any unlock date falling on a Sunday automatically moves to Monday
  return skipSunday(raw);
}

function label(daysUntil: number, date: string): string {
  if (daysUntil <= 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} days (${niceDate(date)})`;
}

interface LastDone {
  date: string;
  response: string;
  by: string;
}

/** Latest submission per (machine, check point), taken from checklistRecords (and legacy CHK maintenance records) */
function lastDoneIndex(db: Database): Map<string, LastDone> {
  const index = new Map<string, LastDone>();

  // 1. Check dedicated checklistRecords module
  for (const cr of (db.checklistRecords || [])) {
    const assetId = cr.assetId || (cr as any)["Asset ID"];
    const chkId = cr.templateId || cr.checklistId || (cr as any)["Template ID"] || (cr as any)["Checklist ID"];
    if (!assetId || !chkId) continue;
    const date = toDateString(cr.date) || toDateString(cr.createdAt);
    if (!date) continue;

    const key = `${normalize(assetId)}|${normalize(chkId)}`;
    const existing = index.get(key);
    if (!existing || date >= existing.date) {
      index.set(key, {
        date,
        response: String(cr.response || cr.status || ""),
        by: String(cr.userName || cr.operator || (cr as any)["Operator"] || "")
      });
    }
  }

  // 2. Also check legacy maintenanceRecords with CHK- prefix
  for (const r of (db.maintenanceRecords || [])) {
    if (!/^CHK-/i.test(String(r.recordId ?? "")) || !r.checklistId) continue;
    const date = toDateString(r.date) || toDateString(r.createdAt);
    if (!date) continue;

    const key = `${normalize(r.assetId)}|${normalize(r.checklistId)}`;
    const existing = index.get(key);
    if (!existing || date >= existing.date) {
      index.set(key, { date, response: String(r.result ?? ""), by: String(r.userName ?? "") });
    }
  }
  return index;
}

function entryFor(item: ChecklistItem, last: LastDone | undefined, today: string): ChecklistEntry {
  const base = { ...item, last };
  const todayIsSunday = isSunday(today);

  // Sunday is a weekly off day in the factory:
  // No checklists are due on Sunday. Everything scheduled for today or earlier is deferred to Monday.
  if (todayIsSunday) {
    const nextWorking = addDays(today, 1); // Monday
    if (!last || !intervalFor(item.frequency)) {
      return {
        ...base,
        status: "locked",
        nextDue: nextWorking,
        nextDueLabel: "tomorrow (Monday - Weekly Off today)",
        overdueDays: 0,
      };
    }
    const unlock = unlockDate(item.frequency, last.date, isBad(last.response));
    const targetDate = unlock > nextWorking ? unlock : nextWorking;
    return {
      ...base,
      status: "locked",
      nextDue: targetDate,
      nextDueLabel: targetDate === nextWorking ? "tomorrow (Monday - Weekly Off today)" : label(daysBetween(today, targetDate), targetDate),
      overdueDays: 0,
    };
  }

  if (!last || !intervalFor(item.frequency)) {
    return { ...base, status: "due", nextDue: today, nextDueLabel: "today", overdueDays: 0 };
  }

  const unlock = unlockDate(item.frequency, last.date, isBad(last.response));
  if (unlock <= today) {
    // Only weekly/monthly items are "overdue"; a daily check is simply due again.
    const late = daysBetween(unlock, today);
    const overdueDays = late > 0 && normalize(item.frequency) !== "daily" ? late : 0;
    return {
      ...base,
      status: "due",
      nextDue: unlock,
      nextDueLabel: overdueDays ? `overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}` : "today",
      overdueDays,
    };
  }
  return {
    ...base,
    status: "locked",
    nextDue: unlock,
    nextDueLabel: label(daysBetween(today, unlock), unlock),
    overdueDays: 0,
  };
}

// ----------------------------------------------------------------- queries

/** Machines an operator can pick, with how many check points are due now / tomorrow. */
export async function listChecklistMachines() {
  const [db, all] = await Promise.all([readDb(), loadTemplates()]);
  const today = todayString();
  const tomorrow = addDays(today, 1);
  const last = lastDoneIndex(db);

  const fallbackFactoryMachines = [
    { "Asset ID": "SKY-LSR-MCH-001", "Machine Name": "Laser Machine (HSG 6 kW)", Category: "Production / Laser Area" },
    { "Asset ID": "SKY-SHR-MCH-001", "Machine Name": "Sharing Machine (ERMAKSAN)", Category: "Production / Sharing Area" },
    { "Asset ID": "SKY-BND-MCH-001", "Machine Name": "Bending Machine (ERMAKSAN Power Bend)", Category: "Production / Bending Shop" },
    { "Asset ID": "SKY-LSR-ACM-001", "Machine Name": "Air Compressor (Kaeser ASK-34)", Category: "Maintenance / Utility Bay" },
    { "Asset ID": "SKY-TPP-PUN-001", "Machine Name": "Turret Punching Machine", Category: "Production / Punching Area" },
    { "Asset ID": "SKY-WLD-MCH-001", "Machine Name": "Welding Machine (Jay Ganesh MIG)", Category: "Production / Fabrication Shop" },
    { "Asset ID": "SKY-EOT-8T-001", "Machine Name": "Overhead Crane 8T", Category: "Maintenance / Shop Floor" },
    { "Asset ID": "SKY-PCT-OVN-001", "Machine Name": "Powder Coating Oven", Category: "Production / Paint Shop" },
  ];

  const sourceMachines = db.machines && db.machines.length > 0 ? db.machines : fallbackFactoryMachines;

  return (sourceMachines as Array<Record<string, string>>)
    .filter((m) => m["Asset ID"] && m["Machine Name"])
    .map((m) => {
      const entries = templatesFor(m, all).map((t) =>
        entryFor(t, last.get(`${normalize(m["Asset ID"])}|${normalize(t.templateId)}`), today)
      );
      return {
        assetId: m["Asset ID"],
        name: m["Machine Name"],
        category: m.Category ?? "",
        checkPoints: entries.length,
        dueNow: entries.filter((e) => e.status === "due").length,
        dueTomorrow: entries.filter((e) => e.status === "locked" && e.nextDue === tomorrow).length,
      };
    });
}

/**
 * Everything for one machine: each check point marked due or locked, sorted
 * Daily, Weekly, Monthly..., plus the totals the screen shows.
 */
export async function getChecklist(assetId: string) {
  const [db, all] = await Promise.all([readDb(), loadTemplates()]);
  const normA = normalize(assetId).replace(/[^a-z0-9]/g, "");

  let machine = (db.machines || []).find((m) => {
    const mA = normalize(m["Asset ID"] || (m as any).assetId).replace(/[^a-z0-9]/g, "");
    return mA === normA;
  });

  if (!machine) {
    machine = (db.machines || []).find((m) => {
      const mA = normalize(m["Asset ID"] || (m as any).assetId).replace(/[^a-z0-9]/g, "");
      return (mA && normA && (mA.includes(normA) || normA.includes(mA)));
    });
  }

  if (!machine && assetId) {
    // If not found in machine master, check if checkpoints exist for this assetId
    const matchingTemplate = all.find((t) => normalize(t.assetId).replace(/[^a-z0-9]/g, "") === normA);
    machine = {
      "Asset ID": assetId,
      "Machine Name": matchingTemplate ? `Equipment (${assetId})` : assetId,
      Category: matchingTemplate?.category || "Plant Operations",
    } as any;
  }

  if (!machine) return null;

  const today = todayString();
  const tomorrow = addDays(today, 1);
  const last = lastDoneIndex(db);

  const entries = templatesFor(machine as unknown as Record<string, string>, all)
    .map((t) => entryFor(t, last.get(`${normalize(machine["Asset ID"])}|${normalize(t.templateId)}`), today))
    .sort((a, b) => frequencyRank(a.frequency) - frequencyRank(b.frequency));

  const locked = entries.filter((e) => e.status === "locked");
  const nextUnlock = locked.map((e) => e.nextDue).sort()[0];
  const shiftInfo = getFactoryShiftInfo();

  return {
    machine: { assetId: machine["Asset ID"], name: machine["Machine Name"], category: machine.Category ?? "" },
    today,
    isWeeklyOff: isSunday(today),
    weeklyOffDay: WEEKLY_OFF_DAY,
    shift: {
      name: shiftInfo.name,
      hours: shiftInfo.hours,
      active: shiftInfo.isWithinShiftHours,
      statusLabel: shiftInfo.statusLabel,
    },
    entries,
    counts: {
      due: entries.filter((e) => e.status === "due").length,
      locked: locked.length,
      dueTomorrow: locked.filter((e) => e.nextDue === tomorrow).length,
    },
    nextUnlock: nextUnlock ? { date: nextUnlock, label: label(daysBetween(today, nextUnlock), nextUnlock) } : null,
  };
}

// -------------------------------------------------------------------- save

export interface ChecklistResult {
  success: boolean;
  message: string;
  status?: number;
  saved?: number;
  notOk?: number;
  /** When each frequency in this submission is next due, e.g. Daily -> tomorrow. */
  next?: { frequency: string; count: number; date: string; label: string }[];
}

const fail = (message: string, status = 400): ChecklistResult => ({ success: false, message, status });
const list = (names: string[]) => names.slice(0, 3).join(", ") + (names.length > 3 ? ` and ${names.length - 3} more` : "");

/**
 * Validate and save a filled-in checklist. What is due is re-derived on the
 * server: every due check point must be answered, and check points that are
 * locked (already done) are refused, so nothing gets recorded twice, even if
 * two operators had the form open at once.
 */
export function saveChecklist(
  who: { email: string; name: string },
  input: { assetId: string; answers: ChecklistAnswer[]; allowRecheck?: boolean }
): Promise<ChecklistResult> {
  return withDbLock(async () => {
    const today = todayString();

    // Sunday is Weekly Off - factory operations and checklist filling are closed
    if (isSunday(today)) {
      return fail(
        "Checklist submissions are OFF on Sunday (Weekly Off). Factory operates on General Shift: 9:00 AM – 8:00 PM (Monday – Saturday). Routine inspections resume on Monday at 9:00 AM.",
        403
      );
    }

    const checklist = await getChecklist(input.assetId);
    if (!checklist) return fail(`Machine not found: ${input.assetId}`, 404);

    const allowRecheck = Boolean(input.allowRecheck);
    const due = allowRecheck
      ? checklist.entries
      : checklist.entries.filter((e) => e.status === "due");

    if (!due.length) {
      const when = checklist.nextUnlock ? ` Next check: ${checklist.nextUnlock.label}.` : "";
      return fail(`All check points for this machine are already done.${when}`, 409);
    }

    const answers = Array.isArray(input.answers) ? input.answers : [];
    const byId = new Map(answers.map((a) => [normalize(a?.templateId), a]));

    const locked = allowRecheck
      ? []
      : checklist.entries.filter((e) => e.status === "locked" && byId.has(normalize(e.templateId)));
    if (locked.length) {
      return fail(
        `Already completed, so locked until their next due date: ${list(locked.map((e) => e.checkPoint))}. Reload the checklist to see what is still due.`,
        409
      );
    }

    const missing: string[] = [];
    const needNote: string[] = [];
    const invalid: string[] = [];
    const rows: { item: ChecklistEntry; response: string; remarks: string; photo: string }[] = [];

    for (const item of due) {
      const a = byId.get(normalize(item.templateId));
      let response = String(a?.response ?? "").trim();
      if (!response) {
        missing.push(item.checkPoint);
        continue;
      }

      if (item.inputType === "select") {
        const match = item.options.find((o) => normalize(o) === normalize(response));
        if (!match) {
          invalid.push(item.checkPoint);
          continue;
        }
        response = match;
      } else if (item.inputType === "number" && !Number.isFinite(Number(response))) {
        invalid.push(item.checkPoint);
        continue;
      }

      const remarks = String(a?.remarks ?? "").trim().slice(0, 1000);
      if (isBad(response) && !remarks) needNote.push(item.checkPoint);
      const photo = String(a?.photo ?? "").trim().slice(0, 500);
      rows.push({ item, response, remarks, photo });
    }

    if (missing.length) return fail(`Please answer every check point. Still missing: ${list(missing)}.`);
    if (invalid.length) return fail(`These answers are not valid: ${list(invalid)}.`);
    if (needNote.length) return fail(`Add a note for each "Not OK" answer: ${list(needNote)}.`);

    const db = await readDb();
    const now = new Date().toISOString();
    const sheetUser = db.users.find((u) => emailKey(u["Login Email"]) === emailKey(who.email));
    const operator = sheetUser?.Name || who.name || who.email;

    // One shared ID per submission (CHK-yyyymmdd-hhmmss); each row adds -01, -02...
    db.checklistRecords = db.checklistRecords || [];
    db.maintenanceRecords = db.maintenanceRecords || [];

    const existingChecklistIds = (db.checklistRecords || []).map((r) => r.recordId);
    const existingMntIds = (db.maintenanceRecords || []).map((r) => r.recordId);
    const base = createRecordId("CHK");
    let submission = base;
    for (
      let n = 2;
      existingChecklistIds.some((id) => String(id).includes(submission)) ||
      existingMntIds.some((id) => String(id).includes(submission));
      n++
    ) {
      submission = `${base}x${n}`;
    }

    let notOk = 0;
    const nextByFrequency = new Map<string, { count: number; date: string }>();

    rows.forEach(({ item, response, remarks, photo }, index) => {
      const bad = isBad(response);
      if (bad) notOk++;

      const unlock = unlockDate(item.frequency, today, bad);
      const seen = nextByFrequency.get(item.frequency);
      nextByFrequency.set(item.frequency, {
        count: (seen?.count ?? 0) + 1,
        date: seen && seen.date < unlock ? seen.date : unlock,
      });

      const seq = String(index + 1).padStart(2, "0");
      const recordId = `${submission.replace(/^CHK-/, "CHK-REC-")}-${seq}`;
      let maintenanceTicketId = "";
      let maintenanceRequestId = "";

      // Workflow A: If an item is marked Not OK, automatically generate a unique maintenance request
      if (bad) {
        maintenanceRequestId = `${submission.replace(/^CHK-/, "REQ-")}-${seq}`;
        maintenanceTicketId = maintenanceRequestId;
        const isCriticalCheck = /emergency|safety|critical|sensor|brake|guard|leak/i.test(
          `${item.checkPoint} ${item.category || ""} ${item.standardRequirement || ""}`
        );
        const reqPriority = isCriticalCheck ? "Critical" : "High";

        db.maintenanceRecords.push({
          recordId: maintenanceRequestId,
          recordType: "Checklist Failure",
          date: today,
          assetId: checklist.machine.assetId,
          machineName: checklist.machine.name,
          userId: sheetUser?.["User ID"] ?? "",
          userName: operator,
          submittedBy: who.email,
          checklistId: item.templateId,
          checkPoint: item.checkPoint,
          result: "Not OK",
          problem: remarks || `Checklist Flagged Issue: ${item.checkPoint} - ${item.actionIfNotOk || "Immediate maintenance attention required"}`,
          rootCause: "",
          priority: reqPriority,
          assignedTo: "",
          technicianName: "",
          status: "Open",
          correctiveAction: item.actionIfNotOk || "",
          spareParts: "",
          downtime: "",
          completionDate: "",
          photoEvidence: photo || "",
          remarks: remarksBlock([
            ["Checklist Source", `${submission} (${item.frequency})`],
            ["Check Point", item.checkPoint],
            ["Action If Not OK", item.actionIfNotOk || "Maintenance follow-up required"],
            ["Operator Remarks", remarks],
            ["Reported By", `${operator} (${who.email})`],
          ]),
          createdAt: now,
          lastUpdated: now,
          closedBy: "",
        } as MaintenanceRecord);
      }

      // 100% of filled checklist points (OK, Not OK, NA) are preserved in the dedicated Checklist Records module
      db.checklistRecords!.push({
        recordId,
        submissionId: submission,
        date: today,
        shift: "General (9 AM - 8 PM)",
        assetId: checklist.machine.assetId,
        machineName: checklist.machine.name,
        checklistId: item.templateId,
        templateId: item.templateId,
        checkPoint: item.checkPoint,
        category: item.category || "General Maintenance",
        standardRequirement: item.standardRequirement || "Visual / Normal",
        frequency: item.frequency,
        response: /^n\/a$/i.test(response) ? "NA" : response,
        status: bad ? "Not OK" : (/^n\/a$/i.test(response) ? "NA" : "OK"),
        remarks: remarks || "",
        actionIfNotOk: item.actionIfNotOk || "",
        photoEvidence: photo || "",
        operator: operator,
        userName: operator,
        userId: sheetUser?.["User ID"] ?? "",
        submittedBy: who.email,
        maintenanceTicketId: bad ? maintenanceTicketId : undefined,
        maintenanceRequestId: bad ? maintenanceRequestId : undefined,
        createdAt: now,
        lastUpdated: now,
      } as any);
    });

    // Directly sync any Not OK points to Atlas maintenance_requests, breakdowns, and notifications
    if (notOk > 0) {
      try {
        const { getMongoDb } = await import("./mongodb");
        const mongoDb = await getMongoDb();
        if (mongoDb) {
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (isBad(row.response)) {
              const seq = String(i + 1).padStart(2, "0");
              const reqId = `${submission.replace(/^CHK-/, "REQ-")}-${seq}`;
              const isCriticalCheck = /emergency|safety|critical|sensor|brake|guard|leak/i.test(
                `${row.item.checkPoint} ${row.item.category || ""} ${row.item.standardRequirement || ""}`
              );
              const priority = isCriticalCheck ? "Critical" : "High";

              // 1. Upsert Maintenance Request in Atlas (idempotent, prevents duplicate requests on retry)
              await mongoDb.collection("maintenance_requests").updateOne(
                { requestId: reqId },
                {
                  $set: {
                    requestId: reqId,
                    submissionId: submission,
                    checklistId: row.item.templateId,
                    assetId: checklist.machine.assetId,
                    machineName: checklist.machine.name,
                    failedPoint: row.item.checkPoint,
                    checkPoint: row.item.checkPoint,
                    problem: row.remarks || `Checklist Issue: ${row.item.checkPoint} (${row.item.actionIfNotOk || "Inspection Failed"})`,
                    reportedBy: operator,
                    reportedDate: today,
                    reportedAt: now,
                    priority,
                    assignedTo: "",
                    technicianName: "",
                    status: "Open",
                    source: "Checklist Inspection",
                    actionIfNotOk: row.item.actionIfNotOk || "",
                    photoEvidence: row.photo || "",
                    createdAt: now,
                    lastUpdated: now,
                  },
                },
                { upsert: true }
              );

              // 2. Also register in breakdowns collection for full cross-module compatibility
              const bdId = `${submission.replace(/^CHK-/, "BD-")}-${seq}`;
              await mongoDb.collection("breakdowns").updateOne(
                { "Breakdown Ticket": bdId },
                {
                  $set: {
                    "Breakdown Ticket": bdId,
                    "Asset ID": checklist.machine.assetId,
                    "Machine Name": checklist.machine.name,
                    "Reported By": operator,
                    "Priority": priority,
                    "Issue Description": row.remarks || `Checklist Issue: ${row.item.checkPoint}`,
                    "Status": "Open",
                    "Reported Date": today,
                    "Source": "Checklist Inspection",
                    "CreatedAt": now,
                  },
                },
                { upsert: true }
              );

              // 3. Notify maintenance team in notifications collection
              await mongoDb.collection("notifications").updateOne(
                { requestId: reqId, type: "maintenance_request" },
                {
                  $setOnInsert: {
                    id: `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: "maintenance_request",
                    requestId: reqId,
                    title: `Checklist Defect Flagged: ${checklist.machine.name}`,
                    message: `Point "${row.item.checkPoint}" marked Not OK by ${operator}. Priority: ${priority}. Action required: ${row.item.actionIfNotOk || "Inspect machine"}.`,
                    recipientRole: "maintenance",
                    assetId: checklist.machine.assetId,
                    link: `/admin/maintenance?tab=requests&requestId=${reqId}`,
                    read: false,
                    createdAt: now,
                  },
                },
                { upsert: true }
              );
            }
          }
        }
      } catch (syncErr) {
        console.warn("[saveChecklist] Atlas maintenance request sync warning:", syncErr);
      }
    }

    await writeDb(db);

    const next = [...nextByFrequency.entries()]
      .sort((a, b) => frequencyRank(a[0]) - frequencyRank(b[0]))
      .map(([frequency, v]) => ({
        frequency,
        count: v.count,
        date: v.date,
        label: label(daysBetween(today, v.date), v.date),
      }));

    const issues = notOk
      ? ` ${notOk} item${notOk === 1 ? "" : "s"} marked Not OK ${notOk === 1 ? "was" : "were"} logged as open maintenance issues.`
      : "";
    return {
      success: true,
      status: 201,
      saved: rows.length,
      notOk,
      next,
      message: `Checklist submitted: ${rows.length} check point${rows.length === 1 ? "" : "s"} saved for ${checklist.machine.name}.${issues}`,
    };
  });
}
