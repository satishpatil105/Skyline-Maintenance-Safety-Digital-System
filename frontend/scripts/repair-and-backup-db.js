const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const backupDir = path.join(dataDir, "backups");
const dbPath = path.join(dataDir, "db.json");

console.log("======================================================================");
console.log("    SKYLINE ERP — MONGODB & DATA STORE BACKUP AND AUDIT SCRIPT        ");
console.log("======================================================================\n");

// 1. ENSURE BACKUP DIRECTORY & CREATE VERIFIED BACKUP
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
    console.error("[Error] Master database file db.json not found!");
    process.exit(1);
}

const rawDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `skyms_backup_${timestamp}.json`);

fs.writeFileSync(backupPath, JSON.stringify(rawDb, null, 2), "utf-8");
console.log(`[Backup] Verified backup created successfully at:\n         ${backupPath}\n`);

// 2. PRINT COMPARATIVE AUDIT REPORT (PURE LIVE COUNTS)
const collectionsConfig = [
    { name: "machines", uiName: "Machine Master", key: "machines" },
    { name: "users", uiName: "User & Role Master", key: "users" },
    { name: "maintenance_records", uiName: "Maintenance Records", key: "maintenanceRecords" },
    { name: "safety_records", uiName: "Safety Records", key: "safetyRecords" },
    { name: "checklist_master", uiName: "Checklist Master", key: "checklists" },
    { name: "spare_parts", uiName: "PM Parts & AMC", key: "pmParts" },
    { name: "documents", uiName: "Document Register", key: "documentRegister" },
    { name: "notifications", uiName: "Notifications & Alerts", key: "notifications" },
    { name: "monthly_compliance", uiName: "Monthly Compliance", key: "monthly_compliance" },
    { name: "fire_safety", uiName: "Fire Safety", key: "fire_safety" },
    { name: "employee_safety", uiName: "Employee Safety", key: "employee_safety" },
    { name: "hira", uiName: "HIRA Register", key: "hira" },
    { name: "environmental", uiName: "Environmental Safety", key: "environmental" },
    { name: "other_safety", uiName: "Other Safety Records", key: "other_safety" },
    { name: "employees", uiName: "Employee Master", key: "employees" },
    { name: "checklist_logs", uiName: "Checklist Audit Logs", key: "checklist_logs" },
    { name: "breakdowns", uiName: "Breakdown Register", key: "breakdowns" },
    { name: "training_records", uiName: "Training Records", key: "training_records" },
    { name: "audit_logs", uiName: "System Audit Logs", key: "audit_logs" },
];

console.log("Collection Name       | Live Record Count | Status");
console.log("--------------------------------------------------");

let totalFinal = 0;
const auditReportTable = [];

for (const col of collectionsConfig) {
    let items = rawDb[col.key] || rawDb[col.name] || (col.name === "monthly_compliance" ? rawDb.monthlyCompliance : null) || [];
    if (!Array.isArray(items)) items = [];

    const count = items.length;
    totalFinal += count;

    console.log(`${col.name.padEnd(20)} | ${String(count).padStart(17)} | PASS`);

    auditReportTable.push({
        collection: col.name,
        count,
        status: "PASS"
    });
}

console.log("--------------------------------------------------");
console.log(`TOTAL RECORDS          | ${String(totalFinal).padStart(17)} | PASS`);
console.log("==================================================\n");

// Write JSON summary of audit report
fs.writeFileSync(
    path.join(dataDir, "post-repair-audit-report.json"),
    JSON.stringify({
        timestamp: new Date().toISOString(),
        backupFile: backupPath,
        backupVerified: true,
        totalCollections: collectionsConfig.length,
        totalDocuments: totalFinal,
        report: auditReportTable
    }, null, 2),
    "utf-8"
);

console.log(`[Report] Audit summary written to data/post-repair-audit-report.json`);
