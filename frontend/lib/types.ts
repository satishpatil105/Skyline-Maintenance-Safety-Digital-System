export interface Machine {
  "Asset ID": string;
  "Machine Name": string;
  Category?: string;
  Department?: string;
  Location?: string;
  Make?: string;
  Model?: string;
  "Serial No."?: string;
  Criticality?: string;
  "Responsible Person"?: string;
  Status?: string;
  "PM Frequency"?: string;
  "AMC Vendor"?: string;
  "AMC Contact"?: string;
  "AMC Expiry"?: string;
  "Installation Date"?: string;
  "Created At"?: string;
  "Last Updated"?: string;
}

export type TableId = "machines" | "users" | "maintenance" | "safety";

export interface UserRecord {
  "Login Email": string;
  "User ID"?: string;
  email?: string;
  userId?: string;
  username?: string;
  Name?: string;
  name?: string;
  /** Job title in the sheet ("Operator", "Supervisor"). Not the app access level. */
  Role?: string;
  role?: string;
  "Department / Machine"?: string;
  department?: string;
  Mobile?: string;
  mobile?: string;
  // --- kept by the app in app-access.json, not in the spreadsheet ---
  /** "Admin" can do everything and opens the dashboard. */
  "App Access"?: "Admin" | "User" | string;
  /** scrypt hash. Never sent to the browser. */
  "Password Hash"?: string;
  /** Visible/provisioned password shown to system administrators. */
  "Display Password"?: string;
  Active: "Yes" | "No" | string;
  "Can Submit Maintenance": "Yes" | "No" | string;
  "Can Submit Safety": "Yes" | "No" | string;
  "Can Approve Close": "Yes" | "No" | string;
  "Can Add Machine"?: "Yes" | "No" | string;
  "Can Edit Machine"?: "Yes" | "No" | string;
}

export const PERMISSIONS = [
  "Can Submit Maintenance",
  "Can Submit Safety",
  "Can Approve Close",
  "Can Add Machine",
  "Can Edit Machine",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface MaintenanceRecord {
  recordId: string;
  recordType: string;
  date: string;
  assetId: string;
  machineName: string;
  userId: string;
  userName: string;
  submittedBy: string;
  checklistId: string;
  checkPoint: string;
  /** "Completed"/"Pending" from the maintenance form; "OK"/"Not OK"/"NA" etc. from checklists. */
  result: string;
  problem: string;
  rootCause: string;
  priority: string;
  assignedTo: string;
  technicianName: string;
  status: string;
  correctiveAction: string;
  spareParts: string;
  downtime: string;
  completionDate: string;
  photoEvidence: string;
  remarks: string;
  createdAt: string;
  lastUpdated: string;
  closedBy: string;
}

export interface SafetyRecord {
  recordId: string;
  date: string;
  assetId: string;
  machineName: string;
  userId: string;
  userName: string;
  submittedBy: string;
  safetyType: string;
  observation?: string;
  inspector: string;
  result: string;
  riskLevel: string;
  immediateAction: string;
  assignedTo: string;
  targetDate: string;
  status: string;
  correctiveAction: string;
  photoEvidence: string;
  remarks: string;
  createdAt: string;
  lastUpdated: string;
  closedBy: string;
}

export interface Database {
  machines: Machine[];
  users: UserRecord[];
  maintenanceRecords: MaintenanceRecord[];
  safetyRecords: SafetyRecord[];
  checklists?: Array<Record<string, string>>;
  pmParts?: Array<Record<string, string>>;
  documentRegister?: Array<Record<string, string>>;
  notifications?: Array<Record<string, string>>;
  /**
   * Column order found in each Excel sheet (by internal key), so extra
   * columns someone adds in Excel survive when the app saves.
   */
  columns?: Partial<Record<TableId, string[]>>;
}

export interface ApiResult<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}
