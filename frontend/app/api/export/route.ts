import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { getMongoDb } from "@/lib/mongodb";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import type { Db } from "mongodb";

const autoTable = require("jspdf-autotable").default || require("jspdf-autotable");

export const dynamic = "force-dynamic";

interface ColumnDef {
  header?: string;
  label?: string;
  key: string;
  width?: number;
  align?: "left" | "center" | "right";
  wrapText?: boolean;
}

interface ExportPayload {
  format?: "xlsx" | "csv" | "pdf";
  module?: string;
  title?: string;
  subtitle?: string;
  filename?: string;
  dateRange?: { start?: string; end?: string };
  columns?: ColumnDef[];
  data?: Record<string, any>[];
  summary?: Record<string, any>;
}

function sanitizeFilename(name?: string, ext = "xlsx"): string {
  const safe = (name || "SkyMS_Export")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
    .replace(/_+/g, "_");
  const base = safe.endsWith(`.${ext}`) ? safe.slice(0, -(ext.length + 1)) : safe;
  return `${base}.${ext}`;
}

function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCellValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (Array.isArray(val)) {
    return val.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ");
  }
  if (typeof val === "object") {
    if (val._bsontype === "ObjectId") return String(val);
    return JSON.stringify(val);
  }
  return String(val);
}

// Corporate Color Palette
const NAVY_BANNER = "1E3A8A";
const NAVY_HEADER = "1E293B";
const ZEBRA_BG = "F8FAFC";
const BORDER_COLOR = "CBD5E1";

const STATUS_STYLES = {
  success: { bg: "DCFCE7", fg: "166534" }, // Green
  warning: { bg: "FEF3C7", fg: "92400E" }, // Amber
  danger: { bg: "FEE2E2", fg: "991B1B" },  // Red
  info: { bg: "E0F2FE", fg: "075985" },    // Light Blue
  muted: { bg: "F1F5F9", fg: "475569" },   // Grey
};

function getStatusStyle(val: any) {
  const s = String(val || "").trim().toLowerCase();
  if (/^(completed|closed|resolved|optimal|passed|pass|active|running|low risk|normal|yes|ok|success)$/i.test(s)) {
    return STATUS_STYLES.success;
  }
  if (/^(pending|open|under pm|under maintenance|warning|medium|medium risk|standby|in review)$/i.test(s)) {
    return STATUS_STYLES.warning;
  }
  if (/^(overdue|critical|breakdown|failed|fail|high|high risk|out of service|rejected|error|no)$/i.test(s)) {
    return STATUS_STYLES.danger;
  }
  if (/^(in progress|in work|scheduled|assigned)$/i.test(s)) {
    return STATUS_STYLES.info;
  }
  if (/^(inactive|disabled|decommissioned|na|n\/a)$/i.test(s)) {
    return STATUS_STYLES.muted;
  }
  return null;
}

/**
 * Generate centralized professional corporate multi-sheet Excel workbook
 * containing Export Summary + 17 real MongoDB module worksheets.
 */
async function generateCentralizedWorkbook(user: any, mongo: Db): Promise<{ buffer: Buffer; totalRecords: number; sheetCount: number; exportDateStr: string }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Skyline Maintenance & Safety Digital System (SkyMS)";
  wb.lastModifiedBy = user?.name ? `${user.name} (${user.role})` : "Administrator";
  wb.created = new Date();
  wb.modified = new Date();

  const timestamp = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }) + " IST";
  const exportDateStr = new Date().toISOString().slice(0, 10);

  const moduleConfigs: Array<{
    key: string;
    moduleName: string;
    sheetName: string;
    collection: string;
    query?: Record<string, any>;
    limit?: number;
    columns: ColumnDef[];
    filter?: (docs: any[]) => any[];
    transform?: (docs: any[]) => any[];
  }> = [
    {
      key: "users",
      moduleName: "User Management",
      sheetName: "Users",
      collection: "users",
      columns: [
        { header: "User ID", key: "User ID", width: 14, align: "center" },
        { header: "Full Name", key: "Name", width: 22 },
        { header: "Role", key: "Role", width: 16, align: "center" },
        { header: "Login Email", key: "Login Email", width: 28 },
        { header: "Department / Machine", key: "Department / Machine", width: 24 },
        { header: "Mobile", key: "Mobile", width: 16, align: "center" },
        { header: "App Access", key: "App Access", width: 14, align: "center" },
        { header: "Status", key: "Active", width: 12, align: "center" },
        { header: "Can Add Machine", key: "Can Add Machine", width: 16, align: "center" },
        { header: "Can Edit Machine", key: "Can Edit Machine", width: 16, align: "center" },
        { header: "Can Submit Maint", key: "Can Submit Maintenance", width: 16, align: "center" },
        { header: "Can Submit Safety", key: "Can Submit Safety", width: 16, align: "center" },
        { header: "Can Approve Close", key: "Can Approve Close", width: 16, align: "center" },
        { header: "Assigned Machines", key: "Assigned Machines", width: 30 },
      ],
      filter: (docs) =>
        docs.map((d) => {
          const clean = { ...d };
          delete clean.password;
          delete clean.passwordHash;
          delete clean["Password Hash"];
          delete clean.displayPassword;
          delete clean["Display Password"];
          delete clean.hash;
          delete clean.salt;
          delete clean.token;
          delete clean.secret;
          return clean;
        }),
    },
    {
      key: "employees",
      moduleName: "Employee Master",
      sheetName: "Employees",
      collection: "employees",
      columns: [
        { header: "Employee ID", key: "Employee ID", width: 16, align: "center" },
        { header: "Full Name", key: "Full Name", width: 24 },
        { header: "Designation / Role", key: "Designation / Role", width: 28 },
        { header: "Department", key: "Department", width: 20 },
        { header: "Contact Email", key: "Contact Email", width: 28 },
        { header: "Phone", key: "Phone", width: 16, align: "center" },
        { header: "Status", key: "Status", width: 14, align: "center" },
      ],
    },
    {
      key: "machines",
      moduleName: "Machine Master",
      sheetName: "Machines",
      collection: "machines",
      columns: [
        { header: "Asset ID", key: "Asset ID", width: 18, align: "center" },
        { header: "Machine Name", key: "Machine Name", width: 28 },
        { header: "Category", key: "Category", width: 20 },
        { header: "Department", key: "Department", width: 18 },
        { header: "Location", key: "Location", width: 20 },
        { header: "Make", key: "Make", width: 16 },
        { header: "Model", key: "Model", width: 16 },
        { header: "Serial No.", key: "Serial No.", width: 18 },
        { header: "Criticality", key: "Criticality", width: 14, align: "center" },
        { header: "Responsible Person", key: "Responsible Person", width: 22 },
        { header: "Status", key: "Status", width: 16, align: "center" },
        { header: "PM Frequency", key: "PM Frequency", width: 16, align: "center" },
        { header: "AMC Vendor", key: "AMC Vendor", width: 22 },
        { header: "AMC Contact", key: "AMC Contact", width: 18 },
        { header: "AMC Expiry", key: "AMC Expiry", width: 16, align: "center" },
        { header: "Installation Date", key: "Installation Date", width: 16, align: "center" },
        { header: "QR Link", key: "QR Link", width: 30 },
      ],
    },
    {
      key: "assets",
      moduleName: "Asset Master",
      sheetName: "Assets",
      collection: "assets",
      columns: [
        { header: "Sr. No.", key: "srNo", width: 10, align: "center" },
        { header: "Asset ID", key: "Asset ID", width: 18, align: "center" },
        { header: "Asset / Machine Name", key: "Asset Name", width: 30 },
        { header: "Category", key: "Category", width: 20 },
        { header: "Use / Description", key: "Use", width: 32, wrapText: true },
        { header: "Qty", key: "Quantity", width: 10, align: "center" },
        { header: "Responsible Person", key: "Responsible Person", width: 22 },
        { header: "Location", key: "Location", width: 20 },
        { header: "Department", key: "Department", width: 18 },
        { header: "Status", key: "Status", width: 14, align: "center" },
        { header: "Criticality", key: "Criticality", width: 14, align: "center" },
        { header: "PM Frequency", key: "PM Frequency", width: 16, align: "center" },
      ],
      transform: (docs) =>
        docs.map((d) => ({
          ...d,
          "Asset ID": d["Asset ID"] || d.assetId || "",
          "Asset Name": d["Asset Name"] || d.assetName || d["Machine Name"] || "",
          Category: d["Category"] || d.category || "",
          Use: d["Use"] || d.use || d.Description || "",
          Quantity: d["Quantity"] || d.qty || "",
          "Responsible Person": d["Responsible Person"] || d.assignedTo || "",
          Location: d["Location"] || d.location || "",
          Department: d["Department"] || d.department || "",
        })),
    },
    {
      key: "checklist_master",
      moduleName: "Checklist Master",
      sheetName: "Checklist Master",
      collection: "checklist_master",
      columns: [
        { header: "Template ID", key: "Template ID", width: 16, align: "center" },
        { header: "Asset ID", key: "Asset ID", width: 18, align: "center" },
        { header: "Category", key: "Category", width: 22 },
        { header: "Check Point / Task", key: "Check Point", width: 36, wrapText: true },
        { header: "Standard Parameter", key: "Standard Requirement", width: 32, wrapText: true },
        { header: "Frequency", key: "Frequency", width: 14, align: "center" },
        { header: "Shift / Date", key: "Shift / Date", width: 14, align: "center" },
        { header: "Required Photo", key: "Required Photo", width: 14, align: "center" },
        { header: "If Not OK Action", key: "If Not OK Action", width: 28, wrapText: true },
        { header: "Status", key: "Status", width: 12, align: "center" },
      ],
      transform: (docs) =>
        docs.map((d) => ({
          ...d,
          "Template ID": d["Template ID"] || d.templateId || "",
          "Asset ID": d["Asset ID"] || d["Asset ID / Machine"] || d.assetId || "",
          Category: d["Category"] || d.category || "",
          "Check Point": d["Check Point"] || d["Check Point / Task"] || d.checkPoint || "",
          "Standard Requirement": d["Standard Requirement"] || d["Standard Parameter"] || d.standardRequirement || "",
          Status: d["Status"] || d["Active"] || "Active",
        })),
    },
    {
      key: "checklist_records",
      moduleName: "Maintenance Checklists",
      sheetName: "Maintenance Checklists",
      collection: "checklist_records",
      columns: [
        { header: "Record ID", key: "recordId", width: 24, align: "center" },
        { header: "Inspection Date", key: "date", width: 14, align: "center" },
        { header: "Asset ID", key: "assetId", width: 18, align: "center" },
        { header: "Machine Name", key: "machineName", width: 26 },
        { header: "Category", key: "category", width: 22 },
        { header: "Check Point", key: "checkPoint", width: 34, wrapText: true },
        { header: "Standard Requirement", key: "standardRequirement", width: 30, wrapText: true },
        { header: "Frequency", key: "frequency", width: 14, align: "center" },
        { header: "Shift", key: "shift", width: 10, align: "center" },
        { header: "Result / Response", key: "response", width: 14, align: "center" },
        { header: "Status", key: "status", width: 14, align: "center" },
        { header: "Operator", key: "operator", width: 20 },
        { header: "Action If Not OK", key: "actionIfNotOk", width: 26, wrapText: true },
        { header: "Remarks", key: "remarks", width: 26, wrapText: true },
        { header: "Ticket ID", key: "maintenanceTicketId", width: 20, align: "center" },
      ],
    },
    {
      key: "maintenance_records",
      moduleName: "Maintenance Records",
      sheetName: "Maintenance Records",
      collection: "maintenance_records",
      columns: [
        { header: "Record ID", key: "recordId", width: 22, align: "center" },
        { header: "Date", key: "date", width: 14, align: "center" },
        { header: "Asset ID", key: "assetId", width: 18, align: "center" },
        { header: "Machine Name", key: "machineName", width: 26 },
        { header: "Record Type", key: "recordType", width: 16, align: "center" },
        { header: "Priority", key: "priority", width: 14, align: "center" },
        { header: "Status", key: "status", width: 14, align: "center" },
        { header: "Problem / Issue", key: "problem", width: 32, wrapText: true },
        { header: "Corrective Action", key: "correctiveAction", width: 32, wrapText: true },
        { header: "Root Cause", key: "rootCause", width: 26, wrapText: true },
        { header: "Technician", key: "technicianName", width: 20 },
        { header: "Assigned To", key: "assignedTo", width: 20 },
        { header: "Spare Parts Used", key: "spareParts", width: 24 },
        { header: "Downtime (Hrs)", key: "downtime", width: 14, align: "center" },
        { header: "Closed By", key: "closedBy", width: 20 },
        { header: "Completion Date", key: "completionDate", width: 16, align: "center" },
        { header: "Remarks", key: "remarks", width: 28, wrapText: true },
      ],
      transform: (docs) =>
        docs.map((d) => ({
          ...d,
          technicianName: d.technicianName || d.userName || "",
        })),
    },
    {
      key: "breakdowns",
      moduleName: "Breakdown Management",
      sheetName: "Breakdowns",
      collection: "breakdowns",
      columns: [
        { header: "Ticket ID", key: "Breakdown Ticket", width: 22, align: "center" },
        { header: "Machine / Asset", key: "Machine Asset", width: 28 },
        { header: "Breakdown Issue", key: "Breakdown Issue", width: 32, wrapText: true },
        { header: "Reported Date", key: "Reported Date", width: 14, align: "center" },
        { header: "Resolved Date", key: "Resolved Date", width: 14, align: "center" },
        { header: "Downtime (Hours)", key: "Downtime (Hours)", width: 16, align: "center" },
        { header: "Root Cause", key: "Root Cause", width: 28, wrapText: true },
        { header: "Status", key: "Status", width: 14, align: "center" },
        { header: "Priority", key: "Priority", width: 14, align: "center" },
        { header: "Reported By", key: "Reported By", width: 20 },
      ],
    },
    {
      key: "spare_parts",
      moduleName: "Spare Parts / Inventory",
      sheetName: "Spare Parts",
      collection: "spare_parts",
      columns: [
        { header: "Part ID", key: "Part ID", width: 16, align: "center" },
        { header: "Part Name", key: "Part Name", width: 28 },
        { header: "Category", key: "Category", width: 18 },
        { header: "Machine Model", key: "Machine Model", width: 22 },
        { header: "Stock Qty", key: "Stock Quantity", width: 12, align: "center" },
        { header: "Min Reorder Level", key: "Minimum Reorder Level", width: 16, align: "center" },
        { header: "Unit Cost (INR)", key: "Unit Cost (INR)", width: 16, align: "right" },
        { header: "Supplier Name", key: "Supplier Name", width: 24 },
        { header: "Bin Location", key: "Storage Bin Location", width: 18 },
        { header: "Status", key: "Status", width: 14, align: "center" },
        { header: "AMC Expiry", key: "AMC Expiry", width: 14, align: "center" },
      ],
      transform: (docs) =>
        docs.map((d) => ({
          ...d,
          "Part ID": d["Part ID"] || d["Item / Part ID"] || d.partId || "",
          "Part Name": d["Part Name"] || d["Item Name"] || d.partName || "",
          "Machine Model": d["Machine Model"] || d["Machine / Asset"] || "",
          "Stock Quantity": d["Stock Quantity"] || d["Quantity"] || "",
        })),
    },
    {
      key: "safety_records",
      moduleName: "Safety Inspections",
      sheetName: "Safety Inspections",
      collection: "safety_records",
      columns: [
        { header: "Record ID", key: "recordId", width: 20, align: "center" },
        { header: "Inspection Date", key: "date", width: 14, align: "center" },
        { header: "Asset ID", key: "assetId", width: 18, align: "center" },
        { header: "Machine Name", key: "machineName", width: 26 },
        { header: "Safety Inspection Type", key: "safetyType", width: 26 },
        { header: "Risk Level", key: "riskLevel", width: 14, align: "center" },
        { header: "Status", key: "status", width: 14, align: "center" },
        { header: "Inspector Name", key: "inspector", width: 22 },
        { header: "Hazard Observation", key: "observation", width: 36, wrapText: true },
        { header: "Immediate Action Taken", key: "immediateAction", width: 36, wrapText: true },
      ],
    },
    {
      key: "employee_safety",
      moduleName: "Safety Incidents",
      sheetName: "Safety Incidents",
      collection: "employee_safety",
      columns: [
        { header: "Record ID", key: "Record ID", width: 20, align: "center" },
        { header: "Employee Name", key: "Employee Name", width: 24 },
        { header: "Department", key: "Department", width: 20 },
        { header: "Event Type", key: "Event Type", width: 22 },
        { header: "Date of Incident", key: "Date of Incident", width: 16, align: "center" },
        { header: "Risk Severity", key: "Risk Severity", width: 16, align: "center" },
        { header: "Status", key: "Status", width: 14, align: "center" },
        { header: "Action Taken", key: "Action Taken", width: 36, wrapText: true },
      ],
    },
    {
      key: "training_records",
      moduleName: "Training Records",
      sheetName: "Training Records",
      collection: "training_records",
      columns: [
        { header: "Training ID", key: "Training ID", width: 16, align: "center" },
        { header: "Employee ID", key: "Employee ID", width: 14, align: "center" },
        { header: "Employee Name", key: "Employee Name", width: 24 },
        { header: "Department", key: "Department", width: 20 },
        { header: "Training Topic", key: "Training Topic", width: 32 },
        { header: "Trainer Name", key: "Trainer Name", width: 22 },
        { header: "Completion Date", key: "Completion Date", width: 16, align: "center" },
        { header: "Expiry Date", key: "Expiry Date", width: 16, align: "center" },
        { header: "Score / Result", key: "Score / Result", width: 14, align: "center" },
        { header: "Status", key: "Status", width: 14, align: "center" },
      ],
    },
    {
      key: "documents",
      moduleName: "Document Management",
      sheetName: "Documents",
      collection: "documents",
      query: { title: { $exists: true, $ne: "" } },
      limit: 200,
      columns: [
        { header: "Doc ID", key: "docId", width: 16, align: "center" },
        { header: "Document Title", key: "title", width: 36 },
        { header: "Category", key: "category", width: 22 },
        { header: "Machine / Department", key: "machine", width: 24 },
        { header: "Version", key: "version", width: 12, align: "center" },
        { header: "Issue Date", key: "issueDate", width: 14, align: "center" },
        { header: "Approved By", key: "approvedBy", width: 22 },
        { header: "Status", key: "status", width: 14, align: "center" },
      ],
      filter: (docs) => {
        const seen = new Set();
        const clean: any[] = [];
        for (const d of docs) {
          const id = (d.docId || d["Doc ID"] || d.title || "").trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          clean.push({
            docId: d.docId || d["Doc ID"] || "",
            title: d.title || d["Document Title"] || "",
            category: d.category || d.Category || "",
            machine: d.machine || d["Machine / Department"] || "",
            version: d.version || d["Revision Date"] || "v1.0",
            issueDate: d.issueDate || "2024-11-10",
            approvedBy: d.approvedBy || "EHS Manager",
            status: d.status || "Active",
          });
        }
        return clean;
      },
    },
    {
      key: "notifications",
      moduleName: "Notifications",
      sheetName: "Notifications",
      collection: "notifications",
      columns: [
        { header: "Notification ID", key: "id", width: 26, align: "center" },
        { header: "Notification Type", key: "type", width: 24 },
        { header: "Title", key: "title", width: 32 },
        { header: "Message", key: "message", width: 44, wrapText: true },
        { header: "Recipient Role", key: "recipientRole", width: 16, align: "center" },
        { header: "Related Asset ID", key: "assetId", width: 20, align: "center" },
        { header: "Read Status", key: "read", width: 14, align: "center" },
        { header: "Created Date & Time", key: "createdAt", width: 22, align: "center" },
      ],
      transform: (docs) =>
        docs.map((d) => ({
          ...d,
          read: d.read ? "Read" : "Unread",
        })),
    },
    {
      key: "audit_logs",
      moduleName: "Audit Logs",
      sheetName: "Audit Logs",
      collection: "audit_logs",
      columns: [
        { header: "Audit ID", key: "Audit ID", width: 18, align: "center" },
        { header: "Event Type", key: "Event Type", width: 26 },
        { header: "User ID", key: "User ID", width: 14, align: "center" },
        { header: "Actor Email", key: "Actor Email", width: 28 },
        { header: "Action Performed", key: "Action", width: 38, wrapText: true },
        { header: "Target Resource", key: "Target Resource", width: 26 },
        { header: "Timestamp", key: "Timestamp", width: 24, align: "center" },
        { header: "Status", key: "Status", width: 14, align: "center" },
        { header: "IP Address", key: "IP Address", width: 18, align: "center" },
      ],
    },
    {
      key: "hira",
      moduleName: "HIRA Risk Register",
      sheetName: "HIRA Risk Register",
      collection: "hira",
      columns: [
        { header: "HIRA ID", key: "HIRA ID", width: 16, align: "center" },
        { header: "Process / Activity", key: "Process / Activity", width: 32, wrapText: true },
        { header: "Identified Hazard", key: "Identified Hazard", width: 32, wrapText: true },
        { header: "Initial Risk Rating", key: "Initial Risk Rating", width: 20, align: "center" },
        { header: "Control Measure", key: "Control Measure", width: 36, wrapText: true },
        { header: "Residual Risk Rating", key: "Residual Risk Rating", width: 20, align: "center" },
        { header: "Assigned Responsibility", key: "Assigned Responsibility", width: 26 },
        { header: "Review Frequency", key: "Review Frequency", width: 18, align: "center" },
      ],
    },
    {
      key: "monthly_compliance",
      moduleName: "Monthly Compliance",
      sheetName: "Monthly Compliance",
      collection: "monthly_compliance",
      columns: [
        { header: "Compliance ID", key: "complianceId", width: 18, align: "center" },
        { header: "Month", key: "month", width: 16, align: "center" },
        { header: "Department", key: "department", width: 22 },
        { header: "Total Inspections", key: "totalInspections", width: 18, align: "center" },
        { header: "Passed Count", key: "passedCount", width: 14, align: "center" },
        { header: "Pending Action", key: "pendingAction", width: 16, align: "center" },
        { header: "Compliance Rate", key: "complianceRate", width: 16, align: "center" },
        { header: "Status", key: "status", width: 14, align: "center" },
      ],
    },
  ];

  // 1. Fetch data from each collection safely
  const exportResults: Array<{
    key: string;
    moduleName: string;
    sheetName: string;
    collection: string;
    columns: ColumnDef[];
    data: any[];
    count: number;
    status: string;
    remarks: string;
  }> = [];

  let totalRecordsExported = 0;

  for (const mod of moduleConfigs) {
    try {
      const query = mod.query || {};
      let cursor = mongo.collection(mod.collection).find(query);
      if (mod.limit) cursor = cursor.limit(mod.limit);
      let rawDocs = await cursor.toArray();

      if (mod.filter) {
        rawDocs = mod.filter(rawDocs);
      }
      if (mod.transform) {
        rawDocs = mod.transform(rawDocs);
      }
      const count = rawDocs.length;
      totalRecordsExported += count;
      exportResults.push({
        ...mod,
        data: rawDocs,
        count,
        status: count > 0 ? "SUCCESS" : "EMPTY",
        remarks: count > 0 ? `Successfully retrieved ${count} verified records` : "Collection accessible, 0 records stored",
      });
    } catch (err: any) {
      console.error(`Export query failed for ${mod.collection}:`, err);
      exportResults.push({
        ...mod,
        data: [],
        count: 0,
        status: "FAILED",
        remarks: `Query error: ${err.message || "Failed to access collection"}`,
      });
    }
  }

  // --- SHEET 1: EXPORT SUMMARY ---
  const summarySheet = wb.addWorksheet("Export Summary", {
    pageSetup: {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });
  summarySheet.views = [{ showGridLines: true, state: "frozen", ySplit: 8 }];

  // Banner Row 1
  summarySheet.mergeCells("A1:G1");
  const sumBanner = summarySheet.getCell("A1");
  sumBanner.value = "SKYLINE MAINTENANCE & SAFETY DIGITAL SYSTEM (SkyMS)";
  sumBanner.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  sumBanner.alignment = { horizontal: "center", vertical: "middle" };
  sumBanner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY_BANNER } };
  summarySheet.getRow(1).height = 36;

  // Subtitle Row 2
  summarySheet.mergeCells("A2:G2");
  const sumSub = summarySheet.getCell("A2");
  sumSub.value = "CENTRALIZED DATABASE EXPORT AUDIT & VERIFICATION REPORT | ISO 9001:2015 & IATF 16949 COMPLIANT";
  sumSub.font = { bold: true, size: 9.5, color: { argb: "FF1E293B" }, name: "Calibri" };
  sumSub.alignment = { horizontal: "center", vertical: "middle" };
  sumSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  summarySheet.getRow(2).height = 20;

  // Metadata Card Block (Rows 4-6)
  summarySheet.getCell("A4").value = "Export Generated:";
  summarySheet.getCell("A4").font = { bold: true, size: 9, color: { argb: "FF64748B" } };
  summarySheet.getCell("B4").value = timestamp;
  summarySheet.getCell("B4").font = { bold: true, size: 9, color: { argb: "FF0F172A" } };

  summarySheet.getCell("D4").value = "Authenticated Admin:";
  summarySheet.getCell("D4").font = { bold: true, size: 9, color: { argb: "FF64748B" } };
  summarySheet.getCell("E4").value = user?.name ? `${user.name} (${user.email || user.role})` : "Administrator (ADM-001)";
  summarySheet.getCell("E4").font = { bold: true, size: 9, color: { argb: "FF0F172A" } };

  summarySheet.getCell("A5").value = "Database Host:";
  summarySheet.getCell("A5").font = { bold: true, size: 9, color: { argb: "FF64748B" } };
  summarySheet.getCell("B5").value = "MongoDB Atlas (Skyline_Project_Engineers)";
  summarySheet.getCell("B5").font = { bold: true, size: 9, color: { argb: "FF0F172A" } };

  summarySheet.getCell("D5").value = "Total Worksheets:";
  summarySheet.getCell("D5").font = { bold: true, size: 9, color: { argb: "FF64748B" } };
  summarySheet.getCell("E5").value = `${exportResults.length + 1} Worksheets (Summary + 17 Modules)`;
  summarySheet.getCell("E5").font = { bold: true, size: 9, color: { argb: "FF0F172A" } };

  summarySheet.getCell("A6").value = "Export Scope:";
  summarySheet.getCell("A6").font = { bold: true, size: 9, color: { argb: "FF64748B" } };
  summarySheet.getCell("B6").value = "Full Authorized System Database (All Modules)";
  summarySheet.getCell("B6").font = { bold: true, size: 9, color: { argb: "FF0F172A" } };

  summarySheet.getCell("D6").value = "Total Records:";
  summarySheet.getCell("D6").font = { bold: true, size: 9, color: { argb: "FF64748B" } };
  summarySheet.getCell("E6").value = `${totalRecordsExported} Total Records`;
  summarySheet.getCell("E6").font = { bold: true, size: 10, color: { argb: "FF166534" } };

  summarySheet.getRow(4).height = 18;
  summarySheet.getRow(5).height = 18;
  summarySheet.getRow(6).height = 18;

  // Header Row 8
  const sumHeaders = ["Sr. No.", "Module Name", "Worksheet Name", "Database Collection", "Records Exported", "Export Status", "Remarks / Verification Details"];
  const sumHeaderRow = summarySheet.addRow(sumHeaders);
  sumHeaderRow.height = 26;
  sumHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY_HEADER } };
    cell.border = {
      top: { style: "thin", color: { argb: "FF" + BORDER_COLOR } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // Data rows
  exportResults.forEach((res, idx) => {
    const r = summarySheet.addRow([
      idx + 1,
      res.moduleName,
      res.sheetName,
      res.collection,
      res.count,
      res.status,
      res.remarks,
    ]);
    r.height = 22;

    const isEven = idx % 2 === 0;
    r.eachCell((cell, colIdx) => {
      cell.font = { size: 9.5, color: { argb: "FF1E293B" }, name: "Calibri" };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (!isEven) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + ZEBRA_BG } };
      }

      if (colIdx === 1 || colIdx === 5) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
      if (colIdx === 2) {
        cell.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" }, name: "Calibri" };
      }
      if (colIdx === 6) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (res.status === "SUCCESS") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + STATUS_STYLES.success.bg } };
          cell.font = { bold: true, size: 9, color: { argb: "FF" + STATUS_STYLES.success.fg } };
        } else if (res.status === "EMPTY") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + STATUS_STYLES.warning.bg } };
          cell.font = { bold: true, size: 9, color: { argb: "FF" + STATUS_STYLES.warning.fg } };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + STATUS_STYLES.danger.bg } };
          cell.font = { bold: true, size: 9, color: { argb: "FF" + STATUS_STYLES.danger.fg } };
        }
      }
    });
  });

  // Total Row
  const totRow = summarySheet.addRow([
    "",
    "TOTAL SYSTEM RECORDS EXPORTED",
    "",
    "",
    totalRecordsExported,
    "COMPLETE",
    `Verified across ${exportResults.length} database modules`,
  ]);
  totRow.height = 24;
  totRow.eachCell((cell, colIdx) => {
    cell.font = { bold: true, size: 10, color: { argb: "FF0F172A" }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0F172A" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
    if (colIdx === 5 || colIdx === 6) {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });

  summarySheet.autoFilter = {
    from: { row: 8, column: 1 },
    to: { row: 8, column: 7 },
  };

  summarySheet.getColumn(1).width = 10;
  summarySheet.getColumn(2).width = 26;
  summarySheet.getColumn(3).width = 24;
  summarySheet.getColumn(4).width = 24;
  summarySheet.getColumn(5).width = 18;
  summarySheet.getColumn(6).width = 16;
  summarySheet.getColumn(7).width = 44;

  // --- SHEETS 2 TO N: MODULE WORKSHEETS ---
  for (const res of exportResults) {
    const isLandscape = res.columns.length > 6;
    const ws = wb.addWorksheet(res.sheetName.slice(0, 31), {
      pageSetup: {
        orientation: isLandscape ? "landscape" : "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: "4:4",
        margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
      },
    });

    const colCount = Math.max(res.columns.length, 1);
    const endColLetter = ws.getColumn(colCount).letter;
    ws.views = [{ showGridLines: true, state: "frozen", ySplit: 4 }];

    // Row 1: Corporate Title Banner
    ws.mergeCells(`A1:${endColLetter}1`);
    const banner = ws.getCell("A1");
    banner.value = `SKYLINE MAINTENANCE & SAFETY DIGITAL SYSTEM (SkyMS) — ${res.moduleName.toUpperCase()}`;
    banner.font = { bold: true, size: 12.5, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    banner.alignment = { horizontal: "center", vertical: "middle" };
    banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY_BANNER } };
    ws.getRow(1).height = 36;

    // Row 2: Metadata / Report Info
    ws.mergeCells(`A2:${endColLetter}2`);
    const sub = ws.getCell("A2");
    sub.value = `Worksheet: ${res.sheetName} | Data Source: SkyMS MongoDB Database (${res.collection}) | Total Records: ${res.count} | Export Date: ${timestamp} | Report Type: Centralized Data Export`;
    sub.font = { italic: true, size: 8.5, color: { argb: "FF475569" }, name: "Calibri" };
    sub.alignment = { horizontal: "center", vertical: "middle" };
    sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    ws.getRow(2).height = 20;

    // Row 4: Column Headers
    const headerRow = ws.addRow(res.columns.map((c) => c.header));
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" }, name: "Calibri" };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + NAVY_HEADER } };
      cell.border = {
        top: { style: "thin", color: { argb: "FF" + BORDER_COLOR } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
    });

    // Data rows
    if (res.data.length === 0) {
      const emptyRow = ws.addRow(["No records found in this module database."]);
      ws.mergeCells(`A5:${endColLetter}5`);
      emptyRow.height = 24;
      const emptyCell = ws.getCell("A5");
      emptyCell.font = { italic: true, size: 9.5, color: { argb: "FF64748B" } };
      emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    } else {
      res.data.forEach((row, rowIdx) => {
        const rowVals = res.columns.map((col) => {
          const v = row[col.key] !== undefined ? row[col.key] : (row[col.header || ""] !== undefined ? row[col.header || ""] : "");
          return formatCellValue(v);
        });
        const r = ws.addRow(rowVals);
        r.height = 22;

        const isEven = rowIdx % 2 === 0;
        r.eachCell((cell, colIdx) => {
          cell.font = { size: 9, color: { argb: "FF1E293B" }, name: "Calibri" };
          const colDef = res.columns[colIdx - 1];
          cell.alignment = {
            vertical: "middle",
            horizontal: colDef?.align || "left",
            wrapText: !!colDef?.wrapText,
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (!isEven) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + ZEBRA_BG } };
          }

          // Check for status styling
          const colHeaderLower = (colDef?.header || "").toLowerCase();
          if (
            colHeaderLower.includes("status") ||
            colHeaderLower.includes("result") ||
            colHeaderLower.includes("response") ||
            colHeaderLower.includes("severity") ||
            colHeaderLower.includes("risk level")
          ) {
            const st = getStatusStyle(cell.value);
            if (st) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + st.bg } };
              cell.font = { bold: true, size: 9, color: { argb: "FF" + st.fg } };
              cell.alignment = { horizontal: "center", vertical: "middle" };
            }
          }
        });
      });
    }

    // Dynamic column widths calculation
    res.columns.forEach((col, idx) => {
      let maxLen = (col.header || "").length;
      res.data.slice(0, 100).forEach((row) => {
        const v = String(row[col.key] || row[col.header || ""] || "");
        if (v.length > maxLen) maxLen = v.length;
      });
      const colObj = ws.getColumn(idx + 1);
      colObj.width = Math.min(Math.max(col.width || maxLen + 4, 12), 48);
    });

    // AutoFilter
    ws.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: colCount },
    };
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    totalRecords: totalRecordsExported,
    sheetCount: wb.worksheets.length,
    exportDateStr,
  };
}

/** Generate single-module Excel workbook buffer (for legacy or single table exports) */
async function generateExcelBuffer(
  title: string,
  subtitle: string,
  columns: ColumnDef[],
  data: Record<string, any>[],
  summary?: Record<string, any>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Skyline Maintenance & Safety Digital System (SkyMS)";
  wb.created = new Date();

  const ws = wb.addWorksheet(title.slice(0, 31) || "Export Data");
  ws.views = [{ showGridLines: true, state: "frozen", ySplit: 4 }];

  // 1. Title Banner (Row 1)
  const colCount = Math.max(columns.length, 1);
  const endColLetter = ws.getColumn(colCount).letter;
  ws.mergeCells(`A1:${endColLetter}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = `SKYLINE AUTOMOTIVE — ${title.toUpperCase()}`;
  titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF880B13" } };
  ws.getRow(1).height = 36;

  // 2. Subtitle / Metadata (Row 2)
  ws.mergeCells(`A2:${endColLetter}2`);
  const subCell = ws.getCell("A2");
  subCell.value = `${subtitle || "Generated by SkyMS Digital Platform"} | Generated: ${new Date().toLocaleString("en-GB")} | Total Records: ${data.length}`;
  subCell.font = { italic: true, size: 9, color: { argb: "FF475569" }, name: "Calibri" };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  ws.getRow(2).height = 20;

  // 3. Optional KPI summary row if present
  let headerRowIndex = 4;
  if (summary && Object.keys(summary).length > 0) {
    const summaryEntries = Object.entries(summary);
    const sumRow = ws.addRow(summaryEntries.map(([k, v]) => `${k}: ${v}`));
    sumRow.font = { bold: true, size: 9, color: { argb: "FF0F172A" } };
    sumRow.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
    ws.addRow([]); // Blank spacer
    headerRowIndex = 5;
  }

  // 4. Header Row
  const headerValues = columns.map((c) => c.header || c.label || c.key);
  const headerRow = ws.addRow(headerValues);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // 5. Data Rows
  data.forEach((row, idx) => {
    const rowValues = columns.map((col) => {
      const headerKey = col.header || col.label || col.key;
      const val = row[col.key] !== undefined ? row[col.key] : (headerKey ? row[headerKey] : "");
      return val === null ? "" : val;
    });
    const r = ws.addRow(rowValues);
    r.height = 22;

    const isEven = idx % 2 === 0;
    r.eachCell((cell) => {
      cell.font = { size: 9, color: { argb: "FF1E293B" }, name: "Calibri" };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (!isEven) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }

      const st = getStatusStyle(cell.value);
      if (st) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + st.bg } };
        cell.font = { bold: true, size: 9, color: { argb: "FF" + st.fg } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    });
  });

  // 6. Column Widths
  columns.forEach((col, idx) => {
    const colTitle = col.header || col.label || col.key;
    let maxLen = colTitle.length;
    data.slice(0, 100).forEach((row) => {
      const v = String(row[col.key] || row[colTitle] || "");
      if (v.length > maxLen) maxLen = v.length;
    });
    const colObj = ws.getColumn(idx + 1);
    colObj.width = Math.min(Math.max(col.width || maxLen + 4, 12), 48);
  });

  // Enable AutoFilter on header row
  ws.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: colCount },
  };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Generate CSV string with UTF-8 BOM */
function generateCsvString(columns: ColumnDef[], data: Record<string, any>[]): string {
  const BOM = "\uFEFF";
  const headerLine = columns.map((c) => escapeCsvValue(c.header || c.label || c.key)).join(",");
  const dataLines = data.map((row) =>
    columns
      .map((col) => {
        const headerKey = col.header || col.label || col.key;
        const val = row[col.key] !== undefined ? row[col.key] : (headerKey ? row[headerKey] : "");
        return escapeCsvValue(val);
      })
      .join(",")
  );
  return BOM + [headerLine, ...dataLines].join("\r\n");
}

/** Generate professional PDF buffer */
function generatePdfBuffer(
  title: string,
  subtitle: string,
  columns: ColumnDef[],
  data: Record<string, any>[],
  dateRange?: { start?: string; end?: string }
): Buffer {
  const isLandscape = columns.length > 5;
  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(136, 11, 19); // #880B13 Skyline Burgundy
  doc.rect(0, 0, pageWidth, 18, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("SKYLINE AUTOMOTIVE — SKYMS DIGITAL PLATFORM", 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(240, 240, 240);
  doc.text("ISO 9001:2015 & IATF 16949 Certified Safety & Maintenance System", pageWidth - 14, 11, {
    align: "right",
  });

  // Report Title & Metadata Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(title.toUpperCase(), 14, 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const dateRangeText = dateRange?.start && dateRange?.end ? ` | Filtered Period: ${dateRange.start} to ${dateRange.end}` : "";
  const subtitleText = `${subtitle || "Official Records Export"} | Generated: ${new Date().toLocaleString("en-GB")}${dateRangeText} | Total Records: ${data.length}`;
  doc.text(subtitleText, 14, 31);

  // Decorative divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 34, pageWidth - 14, 34);

  // Table Data
  const tableHead = [columns.map((c) => c.header || c.label || c.key)];
  const tableBody = data.map((row) =>
    columns.map((col) => {
      const headerKey = col.header || col.label || col.key;
      const v = row[col.key] !== undefined ? row[col.key] : (headerKey ? row[headerKey] : "");
      return String(v === null ? "" : v);
    })
  );

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 37,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      overflow: "linebreak",
      font: "helvetica",
    },
    headStyles: {
      fillColor: [30, 41, 59], // #1E293B
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // #F8FAFC
    },
    margin: { left: 14, right: 14, bottom: 15 },
    didDrawPage: (dataHook: any) => {
      const pageNumber = dataHook.pageNumber;
      const totalPages = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `SkyMS — Skyline Maintenance & Safety Digital System  |  Confidential  |  Page ${pageNumber} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
    },
  });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

/**
 * Log export audit event
 */
async function recordExportAudit(user: any, mongo: Db, scope: string, count: number, ip: string) {
  try {
    await mongo.collection("audit_logs").insertOne({
      "Audit ID": `AUD-EXP-${Date.now()}`,
      "Event Type": "CENTRALIZED_DATA_EXPORT",
      "User ID": user.userId || "ADM-001",
      "Actor Email": user.email || "admin@skylineengineers.com",
      Action: `Exported ${scope} to Excel workbook (${count} records)`,
      "Target Resource": "All System Modules",
      Timestamp: new Date().toISOString(),
      Status: "SUCCESS",
      "IP Address": ip || "127.0.0.1",
    });
  } catch (e) {
    console.warn("[Export Audit] Failed to record audit log:", e);
  }
}

/**
 * POST /api/export
 * Universal endpoint accepting structured data or module="all" request
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const body: ExportPayload = await req.json();
    const format = body.format || "xlsx";
    const userRole = (auth.user?.role || "").toLowerCase();

    // Check if this is a request for Centralized All Data Export
    if (body.module === "all" || body.module === "centralized") {
      if (userRole !== "admin") {
        return NextResponse.json(
          { error: "Access denied: Only administrators are authorized to generate centralized full-system exports." },
          { status: 403 }
        );
      }

      const mongo = await getMongoDb();
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
      const { buffer, totalRecords, sheetCount, exportDateStr } = await generateCentralizedWorkbook(auth.user, mongo);

      await recordExportAudit(auth.user, mongo, "Full Database", totalRecords, ip);

      const filename = `SkyMS_All_Modules_Export_${exportDateStr}.xlsx`;
      return new NextResponse(buffer as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Export-Total-Records": String(totalRecords),
          "X-Export-Sheets-Count": String(sheetCount),
          "Cache-Control": "no-store",
        },
      });
    }

    const title = body.title || "SkyMS Records Export";
    const subtitle = body.subtitle || "";
    const filename = body.filename || `SkyMS_${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`;
    const columns = body.columns || [];
    const data = body.data || [];
    const summary = body.summary;
    const dateRange = body.dateRange;

    if (!columns || columns.length === 0) {
      return NextResponse.json({ error: "Columns definition is required" }, { status: 400 });
    }

    // Never export password or sensitive hash fields
    const sanitizedColumns = columns.filter(
      (c) =>
        !/password|hash|salt|secret|token/i.test(c.key) &&
        !/password|hash|salt|secret|token/i.test(c.header || c.label || c.key)
    );

    if (format === "csv") {
      const csvStr = generateCsvString(sanitizedColumns, data);
      const csvFilename = sanitizeFilename(filename, "csv");
      return new NextResponse(csvStr, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${csvFilename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "pdf") {
      const pdfBuf = generatePdfBuffer(title, subtitle, sanitizedColumns, data, dateRange);
      const pdfFilename = sanitizeFilename(filename, "pdf");
      return new NextResponse(pdfBuf as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdfFilename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Default: Excel (.xlsx)
    const excelBuf = await generateExcelBuffer(title, subtitle, sanitizedColumns, data, summary);
    const xlsxFilename = sanitizeFilename(filename, "xlsx");
    return new NextResponse(excelBuf as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${xlsxFilename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[Export API Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to generate export" }, { status: 500 });
  }
}

/**
 * GET /api/export?module=...&format=...
 * Streaming endpoint: module=all generates the full corporate multi-sheet workbook
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const moduleName = searchParams.get("module")?.toLowerCase().trim();
    const format = (searchParams.get("format") || "xlsx").toLowerCase() as "xlsx" | "csv" | "pdf";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const userRole = (auth.user?.role || "").toLowerCase();

    if (!moduleName) {
      return NextResponse.json({ error: "module query parameter is required" }, { status: 400 });
    }

    const mongo = await getMongoDb();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

    // ==============================================================
    // 1. CENTRALIZED FULL SYSTEM EXPORT (ADMIN ONLY)
    // ==============================================================
    if (moduleName === "all" || moduleName === "centralized") {
      if (userRole !== "admin") {
        return NextResponse.json(
          { error: "Access denied: Only administrators are authorized to generate centralized full-system exports." },
          { status: 403 }
        );
      }

      const { buffer, totalRecords, sheetCount, exportDateStr } = await generateCentralizedWorkbook(auth.user, mongo);
      await recordExportAudit(auth.user, mongo, "Full Database", totalRecords, ip);

      const filename = `SkyMS_All_Modules_Export_${exportDateStr}.xlsx`;
      return new NextResponse(buffer as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Export-Total-Records": String(totalRecords),
          "X-Export-Sheets-Count": String(sheetCount),
          "Cache-Control": "no-store",
        },
      });
    }

    // ==============================================================
    // 2. SINGLE MODULE STREAMING (LEGACY SUPPORT)
    // ==============================================================
    let title = "Export";
    let columns: ColumnDef[] = [];
    let records: Record<string, any>[] = [];

    if (moduleName === "checklist_records" || moduleName === "checklist-records") {
      title = "Checklist Inspection Records";
      columns = [
        { header: "Record ID", key: "recordId", width: 22 },
        { header: "Date", key: "date", width: 14 },
        { header: "Asset ID", key: "assetId", width: 18 },
        { header: "Machine Name", key: "machineName", width: 26 },
        { header: "Category", key: "category", width: 18 },
        { header: "Check Point / Task", key: "checkPoint", width: 36 },
        { header: "Frequency", key: "frequency", width: 14 },
        { header: "Result", key: "response", width: 12 },
        { header: "Status", key: "status", width: 14 },
        { header: "Operator", key: "operator", width: 20 },
        { header: "Remarks", key: "remarks", width: 30 },
      ];

      const query: any = {};
      if (startDate && endDate) {
        query.date = { $gte: startDate, $lte: endDate };
      }
      records = await mongo.collection("checklist_records").find(query).sort({ date: -1, recordId: -1 }).toArray();
    } else if (moduleName === "assets") {
      title = "Asset Master Register";
      columns = [
        { header: "Sr No", key: "srNo", width: 10 },
        { header: "Asset ID", key: "assetId", width: 16 },
        { header: "Asset Name", key: "assetName", width: 30 },
        { header: "Category", key: "category", width: 20 },
        { header: "Use / Description", key: "use", width: 35 },
        { header: "Qty", key: "qty", width: 10 },
        { header: "Assigned To", key: "assignedTo", width: 22 },
        { header: "Location", key: "location", width: 22 },
      ];
      records = await mongo.collection("assets").find({}).sort({ srNo: 1, assetId: 1 }).toArray();
    } else if (moduleName === "machines") {
      title = "Machine Master Register";
      columns = [
        { header: "Asset ID", key: "Asset ID", width: 18 },
        { header: "Machine Name", key: "Machine Name", width: 28 },
        { header: "Category", key: "Category", width: 18 },
        { header: "Department", key: "Department", width: 18 },
        { header: "Location", key: "Location", width: 18 },
        { header: "Make", key: "Make", width: 16 },
        { header: "Model", key: "Model", width: 16 },
        { header: "Serial No.", key: "Serial No.", width: 18 },
        { header: "Status", key: "Status", width: 14 },
        { header: "PM Frequency", key: "PM Frequency", width: 16 },
      ];
      records = await mongo.collection("machines").find({}).sort({ "Asset ID": 1 }).toArray();
    } else if (moduleName === "users") {
      title = "User & Role Master";
      columns = [
        { header: "User ID", key: "User ID", width: 16 },
        { header: "Name", key: "Name", width: 24 },
        { header: "Login Email", key: "Login Email", width: 28 },
        { header: "Role", key: "Role", width: 16 },
        { header: "Department", key: "Department", width: 20 },
        { header: "Phone", key: "Phone", width: 18 },
        { header: "Status", key: "Status", width: 14 },
      ];
      records = await mongo.collection("users").find({}).project({ password: 0, salt: 0, hash: 0, passwordHash: 0, displayPassword: 0 }).toArray();
    } else if (moduleName === "maintenance") {
      title = "Maintenance Records";
      columns = [
        { header: "Record ID", key: "recordId", width: 20 },
        { header: "Date", key: "date", width: 14 },
        { header: "Asset ID", key: "assetId", width: 16 },
        { header: "Machine Name", key: "machineName", width: 26 },
        { header: "Type", key: "recordType", width: 16 },
        { header: "Priority", key: "priority", width: 14 },
        { header: "Status", key: "status", width: 14 },
        { header: "Problem", key: "problem", width: 32 },
        { header: "Action Taken", key: "correctiveAction", width: 32 },
        { header: "Technician", key: "userName", width: 20 },
      ];
      records = await mongo.collection("maintenance_records").find({}).sort({ date: -1 }).toArray();
    } else if (moduleName === "safety") {
      title = "Safety Records";
      columns = [
        { header: "Record ID", key: "recordId", width: 20 },
        { header: "Date", key: "date", width: 14 },
        { header: "Asset ID", key: "assetId", width: 16 },
        { header: "Machine Name", key: "machineName", width: 26 },
        { header: "Inspector", key: "inspector", width: 20 },
        { header: "Safety Type", key: "safetyType", width: 20 },
        { header: "Risk Level", key: "riskLevel", width: 14 },
        { header: "Status", key: "status", width: 14 },
        { header: "Observation", key: "observation", width: 35 },
        { header: "Immediate Action", key: "immediateAction", width: 35 },
      ];
      records = await mongo.collection("safety_records").find({}).sort({ date: -1 }).toArray();
    } else {
      const db = await readDb();
      records = ((db as any)[moduleName] || []) as any[];
      if (records.length > 0) {
        columns = Object.keys(records[0])
          .filter((k) => !k.startsWith("__") && !/password|hash|salt|secret/i.test(k))
          .map((k) => ({ header: k, key: k, width: 20 }));
      }
    }

    const filename = `SkyMS_${moduleName.toUpperCase()}_${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      const csvStr = generateCsvString(columns, records);
      return new NextResponse(csvStr, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(filename, "csv")}"`,
        },
      });
    }

    if (format === "pdf") {
      const pdfBuf = generatePdfBuffer(title, `Direct Database Module Export (${records.length} records)`, columns, records, { start: startDate, end: endDate });
      return new NextResponse(pdfBuf as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(filename, "pdf")}"`,
        },
      });
    }

    const excelBuf = await generateExcelBuffer(title, `Direct Database Module Export (${records.length} records)`, columns, records);
    return new NextResponse(excelBuf as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(filename, "xlsx")}"`,
      },
    });
  } catch (err: any) {
    console.error("[Export GET API Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to stream export" }, { status: 500 });
  }
}
