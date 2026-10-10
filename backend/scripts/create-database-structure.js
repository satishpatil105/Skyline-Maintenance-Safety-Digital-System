const { MongoClient } = require("mongodb");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const possiblePaths = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, ".env"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "backend", ".env"),
    path.join(process.cwd(), "frontend", ".env")
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

let rawUri = process.env.MONGODB_URI || "mongodb://localhost:27017/skyms";
let uri = rawUri.trim();
if (uri.includes("/Skyline Maintenance & Safety")) {
  uri = uri.replace("/Skyline Maintenance & Safety", "");
}

const maskedUri = uri.replace(/(mongodb\+srv:\/\/[^:]+:)([^@]+)(@.+)/, "$1******$3");

function normalizeVal(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    if (v.richText) return v.richText.map(rt => rt.text || "").join("").trim();
  }
  return String(v).trim();
}

// 14 Core SkyMS Collections Definition with Purpose & Index Configuration
const REQUIRED_COLLECTIONS = [
  {
    name: "users",
    purpose: "User authentication, role-based access control (Admin, Manager, Technician, Safety Officer), profiles & credentials",
    indexes: [
      { key: { email: 1 }, unique: true, sparse: true },
      { key: { "Login Email": 1 }, sparse: true },
      { key: { role: 1 } },
      { key: { status: 1 } }
    ]
  },
  {
    name: "employees",
    purpose: "Employee directory, staff master records, department affiliations, contact details & job roles",
    indexes: [
      { key: { employeeId: 1 }, unique: true, sparse: true },
      { key: { "Employee ID": 1 }, sparse: true },
      { key: { department: 1 } },
      { key: { status: 1 } }
    ]
  },
  {
    name: "machines",
    purpose: "Machine / Asset master records, specifications, manufacturer details, locations & QR code targets",
    indexes: [
      { key: { machineId: 1 }, unique: true, sparse: true },
      { key: { "Asset ID": 1 }, sparse: true },
      { key: { status: 1 } },
      { key: { location: 1 } },
      { key: { department: 1 } }
    ]
  },
  {
    name: "checklist_master",
    purpose: "Master checklist library with inspection categories, checkpoints, criteria, frequencies & standards across 16 categories",
    indexes: [
      { key: { templateId: 1 }, unique: true, sparse: true },
      { key: { "Template ID": 1 }, sparse: true },
      { key: { category: 1 } },
      { key: { machineType: 1 } },
      { key: { frequency: 1 } }
    ]
  },
  {
    name: "maintenance_checklists",
    purpose: "Operational checklist logs, technician execution history, daily/weekly inspection records & supervisor sign-offs",
    indexes: [
      { key: { logId: 1 }, unique: true, sparse: true },
      { key: { "Log ID": 1 }, sparse: true },
      { key: { machineId: 1 } },
      { key: { date: -1 } },
      { key: { status: 1 } }
    ]
  },
  {
    name: "maintenance_records",
    purpose: "Preventive and corrective maintenance work orders, repair logs, scheduled servicing & technician actions",
    indexes: [
      { key: { recordId: 1 }, unique: true, sparse: true },
      { key: { "Record ID": 1 }, sparse: true },
      { key: { machineId: 1 } },
      { key: { status: 1 } },
      { key: { priority: 1 } },
      { key: { scheduledDate: -1 } }
    ]
  },
  {
    name: "breakdowns",
    purpose: "Unplanned machine breakdown reports, root cause analysis, downtime tracking & resolution logs",
    indexes: [
      { key: { breakdownId: 1 }, unique: true, sparse: true },
      { key: { "Breakdown ID": 1 }, sparse: true },
      { key: { machineId: 1 } },
      { key: { status: 1 } },
      { key: { severity: 1 } },
      { key: { reportedDate: -1 } }
    ]
  },
  {
    name: "spare_parts",
    purpose: "Spare parts inventory, part numbers, stock levels, minimum thresholds, bin locations & supplier pricing",
    indexes: [
      { key: { partId: 1 }, unique: true, sparse: true },
      { key: { "Part ID": 1 }, sparse: true },
      { key: { "Part Number": 1 }, sparse: true },
      { key: { category: 1 } },
      { key: { stockQuantity: 1 } }
    ]
  },
  {
    name: "safety_inspections",
    purpose: "Safety audits, Fire Safety, HIRA (Hazard Identification & Risk Assessment), Environmental checks & General inspections",
    indexes: [
      { key: { inspectionId: 1 }, unique: true, sparse: true },
      { key: { "Record ID": 1 }, sparse: true },
      { key: { type: 1 } },
      { key: { inspectionDate: -1 } },
      { key: { status: 1 } }
    ]
  },
  {
    name: "safety_incidents",
    purpose: "Workplace accident reports, near-miss logs, injury records, root-cause investigations & CAPA actions",
    indexes: [
      { key: { incidentId: 1 }, unique: true, sparse: true },
      { key: { "Incident ID": 1 }, sparse: true },
      { key: { severity: 1 } },
      { key: { incidentDate: -1 } },
      { key: { status: 1 } }
    ]
  },
  {
    name: "training_records",
    purpose: "Safety & maintenance employee training sessions, toolbox talks, certifications & attendance records",
    indexes: [
      { key: { trainingId: 1 }, unique: true, sparse: true },
      { key: { "Training ID": 1 }, sparse: true },
      { key: { courseName: 1 } },
      { key: { trainingDate: -1 } }
    ]
  },
  {
    name: "documents",
    purpose: "Standard operating procedures (SOP), machine manuals, compliance certifications & digital media links",
    indexes: [
      { key: { docId: 1 }, unique: true, sparse: true },
      { key: { category: 1 } },
      { key: { uploadDate: -1 } }
    ]
  },
  {
    name: "notifications",
    purpose: "Automated system alerts, preventive maintenance reminders, overdue inspection notices & task assignments",
    indexes: [
      { key: { notifId: 1 }, unique: true, sparse: true },
      { key: { userId: 1 } },
      { key: { isRead: 1 } },
      { key: { createdAt: -1 } }
    ]
  },
  {
    name: "audit_logs",
    purpose: "Immutable compliance audit trail, user activity history, system changes & security logs",
    indexes: [
      { key: { logId: 1 }, unique: true, sparse: true },
      { key: { action: 1 } },
      { key: { timestamp: -1 } },
      { key: { userId: 1 } }
    ]
  },
  {
    name: "source_excel_data",
    purpose: "Raw Excel source backup archive and sheet metadata layer for traceability",
    indexes: [
      { key: { sourceFile: 1 } },
      { key: { sheetName: 1 } },
      { key: { rowHash: 1 }, sparse: true }
    ]
  }
];

async function scanExcelStructureOnly() {
  console.log("================================================================================");
  console.log("                  STEP 1: SCANNING EXCEL WORKBOOK STRUCTURE                     ");
  console.log("================================================================================");

  const candidateDirs = [
    "C:\\Users\\ADMIN\\OneDrive\\Desktop\\data",
    path.resolve(__dirname, "..", "data"),
    path.resolve(process.cwd(), "backend", "data"),
    path.resolve(process.cwd(), "data")
  ];

  let scannedAny = false;
  const discoveredSheets = [];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith(".xlsx") || f.endsWith(".xls") || f.endsWith(".xlsm"));
    if (files.length === 0) continue;

    console.log(`\nSource Directory: ${dir}`);
    console.log(`Excel Files Found: ${files.length}\n`);

    for (const file of files) {
      const filePath = path.join(dir, file);
      console.log(` Workbook: [${file}]`);
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.readFile(filePath);
        workbook.eachSheet((worksheet) => {
          let headers = [];
          const firstRow = worksheet.getRow(1);
          if (firstRow && firstRow.values) {
            headers = firstRow.values.map(v => normalizeVal(v)).filter(Boolean);
          }
          discoveredSheets.push({
            file,
            sheetName: worksheet.name,
            headers
          });
          console.log(`   ├── Worksheet: "${worksheet.name}"`);
          console.log(`   │   └── Headers (${headers.length}): [${headers.slice(0, 8).join(", ")}${headers.length > 8 ? "..." : ""}]`);
        });
        scannedAny = true;
      } catch (err) {
        console.warn(`   └── [WARN] Could not read ${file}: ${err.message}`);
      }
    }
  }

  if (!scannedAny) {
    console.log("No Excel files found in primary paths, using defined SkyMS data schema.");
  }
  return discoveredSheets;
}

async function createDatabaseStructure() {
  console.log("\n================================================================================");
  console.log("               STEP 2: CREATING MONGODB DATABASE STRUCTURE                      ");
  console.log("================================================================================");
  console.log(`MongoDB Cluster:  ${maskedUri}`);
  console.log(`Target Database:  skyms\n`);

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✓ Successfully connected to MongoDB Atlas Cluster0!");

    const db = client.db("skyms");

    // Clean existing collections to ensure a completely clean, 0-document state
    const existingCols = await db.listCollections().toArray();
    if (existingCols.length > 0) {
      console.log(`\nCleaning ${existingCols.length} existing collection(s)...`);
      for (const col of existingCols) {
        await db.collection(col.name).drop();
        console.log(`  - Dropped [${col.name}]`);
      }
    }

    console.log(`\nCreating ${REQUIRED_COLLECTIONS.length} required collections (SCHEMA ONLY, 0 DOCUMENTS)...\n`);

    for (const colDef of REQUIRED_COLLECTIONS) {
      // 1. Explicitly create the empty collection
      await db.createCollection(colDef.name);

      // 2. Configure indexes
      const col = db.collection(colDef.name);
      for (const idx of colDef.indexes) {
        const { key, ...options } = idx;
        try {
          await col.createIndex(key, options);
        } catch (e) {
          // Index creation on empty collection
        }
      }

      // 3. Verify document count is strictly 0
      const count = await col.countDocuments();
      console.log(` ✓ Collection [${colDef.name}] created successfully | Document Count: ${count}`);
    }

    // STEP 3: Final Verification & Output Table
    console.log("\n================================================================================");
    console.log("                     FINAL VERIFICATION & COLLECTION AUDIT                      ");
    console.log("================================================================================");
    console.log(`Database: skyms`);
    console.log(`Total Collections Created: ${REQUIRED_COLLECTIONS.length}\n`);

    const tableRows = [];
    let totalDocsAcrossDb = 0;

    for (const colDef of REQUIRED_COLLECTIONS) {
      const col = db.collection(colDef.name);
      const count = await col.countDocuments();
      totalDocsAcrossDb += count;
      tableRows.push({
        "COLLECTION NAME": colDef.name,
        "PURPOSE": colDef.purpose,
        "DOCUMENT COUNT": count
      });
    }

    console.log("--------------------------------------------------------------------------------");
    console.log(String("COLLECTION NAME").padEnd(26) + " | " + String("DOCUMENT COUNT").padEnd(16) + " | " + "PURPOSE");
    console.log("--------------------------------------------------------------------------------");
    for (const r of tableRows) {
      console.log(
        String(r["COLLECTION NAME"]).padEnd(26) + " | " +
        String(r["DOCUMENT COUNT"]).padEnd(16) + " | " +
        r["PURPOSE"]
      );
    }
    console.log("--------------------------------------------------------------------------------");
    console.log(`TOTAL DOCUMENTS IN DATABASE [skyms]: ${totalDocsAcrossDb}`);
    console.log("================================================================================\n");

    if (totalDocsAcrossDb === 0) {
      console.log(">>> VERIFICATION PASSED: Database 'skyms' has all collections with 0 documents. <<<");
    } else {
      console.error(">>> VERIFICATION FAILED: Documents found in database! <<<");
    }

  } catch (err) {
    console.error("Error creating database structure:", err.message);
  } finally {
    await client.close();
  }
}

async function run() {
  await scanExcelStructureOnly();
  await createDatabaseStructure();
}

run();
