const { MongoClient } = require("mongodb");
const ExcelJS = require("exceljs");
const crypto = require("crypto");
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

function generateHash(content) {
  return crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

function normalizeVal(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  if (typeof v === "object") {
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    if (v.richText) return v.richText.map(rt => rt.text || "").join("").trim();
  }
  return String(v).trim();
}

function isUserSheet(sheetName, headers = []) {
  const s = sheetName.toLowerCase().replace(/^\s*\d+\s*[.)-]?\s*/, "").trim();
  const raw = sheetName.toLowerCase();
  const h = headers.map(x => x.toLowerCase()).join(" ");

  if (s === "users" || s === "user master" || raw.includes("3. user") || raw.includes("1. user") || s === "user") return true;
  if (h.includes("login email") && h.includes("password")) return true;
  return false;
}

function classifySheet(sheetName, headers = []) {
  const s = sheetName.toLowerCase().replace(/^\s*\d+\s*[.)-]?\s*/, "").trim();
  const raw = sheetName.toLowerCase().trim();
  const h = headers.map(x => x.toLowerCase()).join(" ");

  // 1. Strict Sheet Name Classification
  if (s.startsWith("maintenance") || s.includes("maintenance record") || raw.includes("4. maintenance")) {
    return "maintenance_records";
  }
  if (s.startsWith("checklist") || s.includes("checklist master") || raw.includes("2. checklist")) {
    return "checklist_master";
  }
  if (s.startsWith("machine") || s.includes("machine master") || raw.includes("1. machine")) {
    return "machines";
  }
  if (s.startsWith("pm part") || s.includes("parts") || s.includes("spare") || raw.includes("6. pm parts")) {
    return "spare_parts";
  }
  if (s.startsWith("document") || s.includes("register") || raw.includes("7. document")) {
    return "documents";
  }
  if (s.startsWith("notification") || s.includes("alert") || raw.includes("8. notification")) {
    return "notifications";
  }
  if (s.startsWith("employee") && !s.includes("safety")) {
    return "employees";
  }
  if (s.startsWith("training")) {
    return "training_records";
  }
  if (s.startsWith("breakdown")) {
    return "breakdowns";
  }
  if (s.startsWith("monthly tracking") || s.includes("checklist log") || s.includes("tracking") || raw.includes("10. monthly tracking")) {
    return "maintenance_checklists";
  }
  if (
    s.includes("fire safety") ||
    s.includes("hira") ||
    s.includes("environmental") ||
    s.includes("other safety") ||
    s.includes("employee safety") ||
    s.includes("safety record") ||
    raw.includes("5. safety") ||
    raw.includes("10. fire") ||
    raw.includes("11. employee") ||
    raw.includes("12. hira") ||
    raw.includes("13. env") ||
    raw.includes("14. other")
  ) {
    return "safety_inspections";
  }
  if (s.includes("incident") || s.includes("injury") || s.includes("near miss")) {
    return "safety_incidents";
  }

  // 2. Header Fallback
  if (h.includes("problem / request") || (h.includes("action taken") && h.includes("parts replaced"))) {
    return "maintenance_records";
  }
  if (h.includes("check item") || h.includes("standard criteria") || h.includes("template id")) {
    return "checklist_master";
  }
  if (h.includes("part number") || h.includes("unit of measure") || h.includes("stock quantity")) {
    return "spare_parts";
  }
  if (h.includes("criticality") || h.includes("power rating") || (h.includes("machine name") && h.includes("asset id"))) {
    return "machines";
  }
  if (h.includes("hazards identified") || h.includes("risk level") || h.includes("inspection type")) {
    return "safety_inspections";
  }

  return "safety_inspections";
}

async function runExcelMigrationExcludingUsers() {
  console.log("================================================================================");
  console.log("      SKYMS — IMPORT ALL EXCEL DATA INTO MONGODB (EXCLUDING USERS)              ");
  console.log("================================================================================");
  console.log(`Cluster:  ${maskedUri}`);
  console.log(`Database: skyms\n`);

  const candidateDirs = [
    "C:\\Users\\ADMIN\\OneDrive\\Desktop\\data",
    path.resolve(__dirname, "..", "data"),
    path.resolve(process.cwd(), "backend", "data"),
    path.resolve(process.cwd(), "data")
  ];

  const businessData = {
    employees: new Map(),
    machines: new Map(),
    checklist_master: new Map(),
    maintenance_checklists: new Map(),
    maintenance_records: new Map(),
    breakdowns: new Map(),
    spare_parts: new Map(),
    safety_inspections: new Map(),
    safety_incidents: new Map(),
    training_records: new Map(),
    documents: new Map(),
    notifications: new Map(),
    audit_logs: new Map()
  };

  const sheetSummary = [];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith(".xlsx") || f.endsWith(".xls") || f.endsWith(".xlsm"));
    for (const file of files) {
      const filePath = path.join(dir, file);
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.readFile(filePath);
        console.log(`\nWorkbook: [${file}]`);

        workbook.eachSheet((worksheet) => {
          let headers = [];
          const sheetRows = [];

          worksheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
            if (rowNum === 1) {
              headers = row.values.map(v => normalizeVal(v)).filter(Boolean);
            } else {
              const rowData = {};
              let hasVal = false;
              row.values.forEach((v, idx) => {
                const h = headers[idx - 1];
                if (h) {
                  const nv = normalizeVal(v);
                  rowData[h] = nv;
                  if (nv !== "") hasVal = true;
                }
              });
              if (hasVal) {
                sheetRows.push({ rowNumber: rowNum, rowData });
              }
            }
          });

          // Skip Dashboard or empty sheets
          if (worksheet.name.toLowerCase().includes("dashboard") || sheetRows.length === 0) {
            console.log(` ⏭  Skipping: "${worksheet.name}" (${sheetRows.length} rows)`);
            return;
          }

          // Strict Users check -> SKIP to keep previous users intact and avoid duplicates
          if (isUserSheet(worksheet.name, headers)) {
            console.log(` ⏭  SKIPPED: "${worksheet.name}" (Users already inserted — skipping to prevent duplicates)`);
            return;
          }

          const targetCol = classifySheet(worksheet.name, headers);
          console.log(` ✓ Reading: "${worksheet.name}" (${sheetRows.length} rows) ➔ Target: [${targetCol}]`);

          let count = 0;
          for (const item of sheetRows) {
            const row = item.rowData;
            const rowHash = generateHash({ file, sheet: worksheet.name, rowNumber: item.rowNumber, row });

            // Unique key generation per collection to guarantee NO row is dropped
            let key = "";
            if (targetCol === "maintenance_records") {
              key = row["Record ID"] || row["recordId"] || `${row["Asset ID"] || ""}_${row["Date"] || ""}_${item.rowNumber}`;
            } else if (targetCol === "machines") {
              key = row["Asset ID"] || row["AssetID"] || row["Machine Name"] || `mach_${item.rowNumber}`;
            } else if (targetCol === "checklist_master") {
              key = row["Template ID"] || row["Checklist ID"] || `chk_${worksheet.name}_${item.rowNumber}`;
            } else if (targetCol === "spare_parts") {
              key = row["Part ID"] || row["Part Number"] || row["Item Code"] || `part_${item.rowNumber}`;
            } else if (targetCol === "safety_inspections") {
              key = row["Record ID"] || `insp_${worksheet.name}_${item.rowNumber}`;
            } else if (targetCol === "safety_incidents") {
              key = row["Record ID"] || row["Incident ID"] || `inc_${item.rowNumber}`;
            } else if (targetCol === "documents") {
              key = row["Document ID"] || `doc_${item.rowNumber}`;
            } else if (targetCol === "notifications") {
              key = row["Alert ID"] || `notif_${item.rowNumber}`;
            } else if (targetCol === "maintenance_checklists") {
              key = row["Log ID"] || `log_${item.rowNumber}`;
            } else if (targetCol === "breakdowns") {
              key = row["Breakdown ID"] || `bd_${item.rowNumber}`;
            } else if (targetCol === "employees") {
              key = row["Employee ID"] || `emp_${item.rowNumber}`;
            } else {
              key = row["Record ID"] || `rec_${item.rowNumber}`;
            }

            const doc = {
              ...row,
              _sourceFile: file,
              _sourceSheet: worksheet.name,
              _rowNumber: item.rowNumber,
              _importedAt: new Date().toISOString()
            };

            if (targetCol === "safety_inspections") {
              doc.inspectionCategory = worksheet.name;
            }

            businessData[targetCol].set(String(key), doc);
            count++;
          }

          sheetSummary.push({
            sheetName: worksheet.name,
            rows: sheetRows.length,
            targetCollection: targetCol
          });
        });

      } catch (err) {
        console.warn(`[WARN] Reading ${file}: ${err.message}`);
      }
    }
  }

  // Connect to MongoDB Atlas
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("\n✓ Connected to MongoDB Atlas successfully!");

    const db = client.db("skyms");

    // 1. DELETE / DROP source_excel_data as requested
    try {
      await db.collection("source_excel_data").drop();
      console.log("✓ Dropped & deleted collection: [source_excel_data]");
    } catch (e) {
      // Collection did not exist or already dropped
    }

    // 2. Insert data for each business collection (preserving existing users)
    console.log("\n================================================================================");
    console.log("                  INSERTING DATA INTO MONGODB COLLECTIONS                       ");
    console.log("================================================================================");

    for (const [colName, map] of Object.entries(businessData)) {
      const docs = Array.from(map.values());
      const col = db.collection(colName);

      if (docs.length > 0) {
        // Clear previous records in this collection for fresh sync
        await col.deleteMany({});
        const res = await col.insertMany(docs);
        console.log(` ✓ Collection [${colName.padEnd(24)}] : Inserted ${res.insertedCount} documents`);
      } else {
        console.log(` - Collection [${colName.padEnd(24)}] : 0 documents`);
      }
    }

    // 3. Final Verification Report
    const usersCount = await db.collection("users").countDocuments();

    console.log("\n================================================================================");
    console.log("                     FINAL DATABASE STATUS & AUDIT REPORT                       ");
    console.log("================================================================================");
    console.log(String("COLLECTION NAME").padEnd(28) + " | " + String("DOCUMENTS").padEnd(12) + " | " + "STATUS");
    console.log("--------------------------------------------------------------------------------");

    const collections = await db.listCollections().toArray();
    let totalDocs = 0;

    for (const c of collections) {
      if (c.name === "source_excel_data") continue; // Deleted
      const col = db.collection(c.name);
      const count = await col.countDocuments();
      totalDocs += count;
      let status = "✓ DATA INSERTED";
      if (c.name === "users") {
        status = `✓ RETAINED (${count} EXISTING USERS)`;
      } else if (count === 0) {
        status = "EMPTY (0)";
      }
      console.log(
        String(c.name).padEnd(28) + " | " +
        String(count).padEnd(12) + " | " +
        status
      );
    }

    console.log("--------------------------------------------------------------------------------");
    console.log(`TOTAL DOCUMENTS IN [skyms]: ${totalDocs}`);
    console.log("================================================================================\n");

  } catch (err) {
    console.error("Migration error:", err.message);
  } finally {
    await client.close();
  }
}

runExcelMigrationExcludingUsers();
