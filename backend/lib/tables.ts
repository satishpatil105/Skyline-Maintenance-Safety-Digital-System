import type { TableId } from "./types";

export type FieldType = "text" | "date" | "select" | "textarea";

export interface ColumnDef {
  /** Property name used in code and the API. */
  key: string;
  /** Column header in the spreadsheet (used when a new workbook is created). */
  label: string;
  /** Other header spellings that mean the same column ("Machine / Equipment"). */
  aliases?: string[];
  type?: FieldType;
  options?: string[];
  required?: boolean;
}

export interface TableDef {
  id: TableId;
  /** Property on the Database object. */
  dbKey: "machines" | "users" | "maintenanceRecords" | "safetyRecords";
  /** Worksheet name inside the workbook. */
  sheet: string;
  title: string;
  singular: string;
  idKey: string;
  /** Columns that live in the spreadsheet. */
  columns: ColumnDef[];
  /**
   * Settings the app keeps itself (not in the spreadsheet), e.g. a user's
   * password and Admin access. Shown in the dashboard next to the sheet columns.
   */
  virtualColumns: ColumnDef[];
  /** Columns that are never sent to the browser. */
  secretKeys: string[];
}

const YES_NO = ["Yes", "No"];

const same = (label: string, extra: Partial<ColumnDef> = {}): ColumnDef => ({
  key: label,
  label,
  ...extra,
});

export const TABLES: Record<TableId, TableDef> = {
  machines: {
    id: "machines",
    dbKey: "machines",
    sheet: "Machine Master",
    title: "Machines",
    singular: "machine",
    idKey: "Asset ID",
    secretKeys: [],
    virtualColumns: [],
    columns: [
      same("Asset ID", { required: true }),
      same("Machine Name", { required: true }),
      same("Category"),
      same("Department"),
      same("Location"),
      same("Make"),
      same("Model"),
      same("Serial No."),
      same("Criticality", { type: "select", options: ["Low", "Medium", "High", "Critical"] }),
      same("Responsible Person"),
      same("Status", { type: "select", options: ["Operational", "Running", "Under Maintenance", "Out of Service"] }),
      same("PM Frequency"),
      same("AMC Vendor"),
      same("AMC Contact"),
      same("AMC Expiry"),
      same("Installation Date"),
      same("QR Link"),
      same("QR Code"),
      same("Created At"),
      same("Last Updated"),
      same("QR Target URL"),
    ],
  },
  users: {
    id: "users",
    dbKey: "users",
    sheet: "User Master",
    title: "Users",
    singular: "user",
    idKey: "Login Email",
    secretKeys: ["Password Hash"],
    columns: [
      same("User ID"),
      same("Name"),
      // A job title in this sheet ("Operator", "Supervisor"), NOT the app's access level.
      same("Role"),
      same("Department / Machine"),
      same("Mobile"),
      same("Active", { type: "select", options: YES_NO }),
      same("Login Email", { required: true }),
      same("Can Submit Maintenance", { type: "select", options: YES_NO }),
      same("Can Submit Safety", { type: "select", options: YES_NO }),
      same("Can Approve Close", { type: "select", options: YES_NO }),
    ],
    virtualColumns: [
      same("App Access", { type: "select", options: ["User", "Admin"] }),
      same("Can Add Machine", { type: "select", options: YES_NO }),
      same("Can Edit Machine", { type: "select", options: YES_NO }),
      same("Password Hash"),
    ],
  },
  maintenance: {
    id: "maintenance",
    dbKey: "maintenanceRecords",
    sheet: "Maintenance Records",
    title: "Maintenance Records",
    singular: "maintenance record",
    idKey: "recordId",
    secretKeys: [],
    virtualColumns: [],
    columns: [
      { key: "recordId", label: "Record ID" },
      { key: "recordType", label: "Record Type" },
      { key: "date", label: "Date", type: "date" },
      { key: "assetId", label: "Asset ID", required: true },
      { key: "machineName", label: "Machine / Equipment", aliases: ["Machine Name", "Machine"] },
      { key: "userId", label: "User ID" },
      { key: "userName", label: "User Name" },
      { key: "submittedBy", label: "Submitted By" },
      { key: "checklistId", label: "Checklist ID" },
      { key: "checkPoint", label: "Check Point" },
      { key: "result", label: "Result" },
      { key: "problem", label: "Problem / Request", type: "textarea", aliases: ["Problem"] },
      { key: "rootCause", label: "Root Cause", type: "textarea" },
      { key: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High", "Critical"] },
      { key: "assignedTo", label: "Assigned To" },
      { key: "technicianName", label: "Technician Name" },
      { key: "status", label: "Status" },
      { key: "correctiveAction", label: "Action Taken", type: "textarea", aliases: ["Corrective Action"] },
      { key: "spareParts", label: "Spare Parts" },
      { key: "downtime", label: "Downtime" },
      { key: "completionDate", label: "Completion Date", type: "date" },
      { key: "photoEvidence", label: "Photo / Evidence", aliases: ["Photo Evidence"] },
      { key: "remarks", label: "Remarks", type: "textarea" },
      { key: "createdAt", label: "Created At" },
      { key: "lastUpdated", label: "Last Updated" },
      { key: "closedBy", label: "Closed By" },
    ],
  },
  safety: {
    id: "safety",
    dbKey: "safetyRecords",
    sheet: "Safety Records",
    title: "Safety Records",
    singular: "safety record",
    idKey: "recordId",
    secretKeys: [],
    virtualColumns: [],
    columns: [
      { key: "recordId", label: "Safety Record ID", aliases: ["Record ID"] },
      { key: "date", label: "Date" },
      { key: "assetId", label: "Asset ID", required: true },
      { key: "machineName", label: "Machine Name", aliases: ["Machine / Equipment"] },
      { key: "userId", label: "User ID" },
      { key: "userName", label: "User Name" },
      { key: "submittedBy", label: "Submitted By" },
      { key: "safetyType", label: "Safety Type" },
      { key: "observation", label: "Observation / Issue", type: "textarea", aliases: ["Observation"] },
      { key: "inspector", label: "Inspector" },
      { key: "result", label: "Result" },
      { key: "riskLevel", label: "Risk Level", type: "select", options: ["Low", "Medium", "High", "Critical"] },
      { key: "immediateAction", label: "Immediate Action", type: "textarea" },
      { key: "assignedTo", label: "Assigned To" },
      { key: "targetDate", label: "Target Date", type: "date" },
      { key: "status", label: "Status" },
      { key: "correctiveAction", label: "Corrective Action", type: "textarea" },
      { key: "photoEvidence", label: "Photo / Evidence", aliases: ["Photo Evidence"] },
      { key: "remarks", label: "Remarks", type: "textarea" },
      { key: "createdAt", label: "Created At" },
      { key: "lastUpdated", label: "Last Updated" },
      { key: "closedBy", label: "Closed By" },
    ],
  },
};

export const TABLE_LIST: TableDef[] = [
  TABLES.machines,
  TABLES.users,
  TABLES.maintenance,
  TABLES.safety,
];

export function isTableId(value: string): value is TableId {
  return Object.prototype.hasOwnProperty.call(TABLES, value);
}

/** Letters and digits only, lower case: "Record_ID" and "record id" match. */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Sheet header -> internal key (forgiving; unknown headers pass through). */
export function keyForHeader(table: TableDef, header: string): string {
  const h = squash(header);
  const col = table.columns.find(
    (c) =>
      squash(c.label) === h ||
      squash(c.key) === h ||
      c.aliases?.some((a) => squash(a) === h)
  );
  return col ? col.key : header.trim();
}

/** Internal key -> the header text used when a new sheet is created. */
export function headerForKey(table: TableDef, key: string): string {
  return table.columns.find((c) => c.key === key)?.label ?? key;
}

/** "3. User Master" -> "usermaster" (leading numbering ignored). */
const squashTab = (s: string) => squash(s.replace(/^\s*\d+\s*[.)-]?\s*/, ""));

/** Words a tab name must contain to be treated as this table. */
const TAB_WORDS: Record<TableId, string[]> = {
  machines: ["machine"],
  users: ["user"],
  maintenance: ["maintenance", "record"],
  safety: ["safety", "record"],
};

/**
 * Which tab in the workbook holds this table? An env override wins
 * (SHEET_TAB_MACHINES / _USERS / _MAINTENANCE / _SAFETY), then an exact match
 * ignoring numbering ("4. Maintenance Records"), then a keyword match.
 */
export function resolveTabName(table: TableDef, names: string[]): string | undefined {
  const override = process.env[`SHEET_TAB_${table.id.toUpperCase()}`]?.trim();
  if (override) {
    return names.find((n) => n.trim().toLowerCase() === override.toLowerCase());
  }

  const exact = names.find((n) => squashTab(n) === squashTab(table.sheet));
  if (exact) return exact;

  const words = TAB_WORDS[table.id];
  return names.find((n) => {
    const s = squashTab(n);
    return words.every((w) => s.includes(w));
  });
}
