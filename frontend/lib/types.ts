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
  "QR Link"?: string;
  "Created At"?: string;
  "Last Updated"?: string;
  assignedUsers?: string[];
  "Assigned Users"?: string;
}

export interface Asset {
  "Asset ID": string;
  "Asset Name"?: string;
  "Machine Name"?: string;
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
  "QR Link"?: string;
  "Created At"?: string;
  "Last Updated"?: string;
  assignedUsers?: string[];
  "Assigned Users"?: string;
}

export type TableId = "machines" | "assets" | "users" | "maintenance" | "safety";

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
  assignedMachines?: string[];
  "Assigned Machines"?: string;
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

export interface MachineAssignment {
  assignmentId: string;
  userId: string;
  userName?: string;
  userRole?: string;
  userEmail?: string;
  assetId: string;
  machineName?: string;
  department?: string;
  status: "Active" | "Removed";
  assignedAt: string;
  assignedBy: string;
  removedAt?: string;
  removedBy?: string;
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
  requestId?: string;
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

export interface ChecklistRecord {
  recordId: string;
  submissionId?: string;
  date: string;
  shift?: string;
  assetId: string;
  machineName: string;
  checklistId?: string;
  templateId?: string;
  checkPoint: string;
  category?: string;
  standardRequirement?: string;
  frequency?: string;
  response: string; // OK, Not OK, NA
  status: string; // OK, Not OK, NA, PASSED, FAILED
  remarks?: string;
  actionIfNotOk?: string;
  photoEvidence?: string;
  operator?: string;
  userName?: string;
  userId?: string;
  submittedBy?: string;
  maintenanceTicketId?: string; // Linked breakdown/maintenance record ID if Not OK
  createdAt?: string;
  lastUpdated?: string;
  [key: string]: any;
}

export interface Database {
  machines: Machine[];
  assets?: Asset[];
  users: UserRecord[];
  maintenanceRecords: MaintenanceRecord[];
  safetyRecords: SafetyRecord[];
  checklists?: Array<Record<string, string>>;
  checklistRecords?: ChecklistRecord[];
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
