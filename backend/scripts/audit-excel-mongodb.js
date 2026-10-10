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
    path.join(process.cwd(), "backend", ".env")
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

console.log("================================================================================");
console.log("             SKYMS COMPLETE EXCEL vs MONGODB READ-ONLY AUDIT                    ");
console.log("================================================================================");
console.log(`Cluster: ${maskedUri}`);
console.log(`Database: skyms`);
console.log(`Source Folder: ${path.resolve(__dirname, "..", "data")}\n`);

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

function classifySheet(sheetName, headers = []) {
  const s = sheetName.toLowerCase().replace(/^\s*\d+\s*[.)-]?\s*/, "").trim();
  const h = headers.map(x => x.toLowerCase()).join(" ");

  if (s.includes("checklist") && (s.includes("master") || s.includes("2."))) return "checklist_master";
  if (s.includes("machine") || h.includes("asset id")) return "machines";
  if (s.includes("user") || (h.includes("login email") && h.includes("password"))) return "users";
  if (s.includes("employee") || (h.includes("employee id") && h.includes("department"))) return "employees";
  if (s.includes("breakdown") || h.includes("breakdown id") || h.includes("downtime")) return "breakdowns";
  if (s.includes("spare") || s.includes("part") || h.includes("part number")) return "spare_parts";
  if (s.includes("training") || h.includes("trainer") || h.includes("attendees")) return "training_records";
  if (s.includes("checklist") || s.includes("log") || h.includes("log id")) return "maintenance_checklists";
  if (s.includes("maintenance") && (s.includes("record") || h.includes("problem / request") || h.includes("corrective action"))) return "maintenance_records";
  if (s.includes("incident") || s.includes("injury") || s.includes("near miss") || h.includes("injury type")) return "safety_incidents";
  if (s.includes("fire") || s.includes("hira") || s.includes("environmental") || s.includes("safety") || s.includes("inspection")) return "safety_inspections";
  if (s.includes("notif") || s.includes("alert")) return "notifications";
  if (s.includes("audit") || s.includes("history")) return "audit_logs";
  return "unmapped";
}

async function runReadOnlyAudit() {
  const dataDir = path.resolve(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    console.error(`Data directory not found: ${dataDir}`);
    return;
  }

  // 1. SCAN ALL EXCEL FILES
  const excelInventory = [];
  const allExcelRows = [];
  const files = fs.readdirSync(dataDir);
  const excelFiles = files.filter(f => f.endsWith(".xlsx") || f.endsWith(".xls") || f.endsWith(".xlsm"));

  for (const f of excelFiles) {
    const fullPath = path.join(dataDir, f);
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(fullPath);
    } catch (e) {
      continue;
    }

    wb.eachSheet((ws) => {
      let headers = [];
      const rows = [];
      ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
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
            const record = {
              file: f,
              sheet: ws.name,
              rowNumber: rowNum,
              targetCollection: classifySheet(ws.name, headers),
              data: rowData
            };
            rows.push(record);
            allExcelRows.push(record);
          }
        }
      });

      excelInventory.push({
        file: f,
        sheet: ws.name,
        rowsCount: rows.length,
        columnsCount: headers.length,
        headers,
        targetCollection: classifySheet(ws.name, headers)
      });
    });
  }

  // 2. READ MONGODB COLLECTIONS
  console.log("Connecting to MongoDB Atlas (READ-ONLY mode)...");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log(" Connected to MongoDB Atlas successfully!\n");
    const db = client.db("skyms");

    const mongoCollectionsList = await db.listCollections().toArray();
    const mongoInventory = [];
    const allMongoDocuments = {};

    for (const colMeta of mongoCollectionsList) {
      const colName = colMeta.name;
      const docs = await db.collection(colName).find({}).toArray();
      const systemDocs = docs.filter(d => d._init === true || d.system === "SkyMS" && d.status === "ready");
      const businessDocs = docs.filter(d => d._init !== true && !(d.system === "SkyMS" && d.status === "ready"));

      mongoInventory.push({
        collection: colName,
        totalDocs: docs.length,
        businessDocs: businessDocs.length,
        systemDocs: systemDocs.length
      });

      allMongoDocuments[colName] = docs;
    }

    // 3. ROW-BY-ROW COMPARISON
    const matchedRecords = [];
    const missingInMongo = [];
    const dataDifferences = [];
    const duplicates = [];

    const matchedMongoDocIds = new Set();

    for (const excelRow of allExcelRows) {
      const targetCol = excelRow.targetCollection;
      const rowData = excelRow.data;

      let identifier = "";
      if (targetCol === "checklist_master") identifier = rowData["Template ID"] || rowData["Checklist ID"] || rowData["templateId"] || `${rowData["Category"]}_${rowData["Check Point"]}`;
      else if (targetCol === "machines") identifier = rowData["Asset ID"] || rowData["Machine Name"];
      else if (targetCol === "users") identifier = rowData["Login Email"] || rowData["User ID"];
      else if (targetCol === "employees") identifier = rowData["Employee ID"] || rowData["User ID"] || rowData["Login Email"];
      else if (targetCol === "maintenance_records") identifier = rowData["Record ID"] || rowData["recordId"] || `${rowData["Asset ID"]}_${rowData["Date"]}`;
      else identifier = rowData["Record ID"] || rowData["id"] || rowData["Asset ID"] || rowData["Template ID"] || "";

      const colDocs = allMongoDocuments[targetCol] || [];
      const matchingDoc = colDocs.find(d => {
        if (targetCol === "checklist_master") return d["Template ID"] === identifier || d["Checklist ID"] === identifier;
        if (targetCol === "machines") return d["Asset ID"] === identifier;
        if (targetCol === "users") return d["Login Email"] === identifier || d["User ID"] === identifier;
        if (targetCol === "employees") return d["employeeId"] === identifier || d["Employee ID"] === identifier;
        if (targetCol === "maintenance_records") return d["Record ID"] === identifier || d["recordId"] === identifier;
        return d["Record ID"] === identifier || d["recordId"] === identifier || d["id"] === identifier;
      });

      if (matchingDoc) {
        matchedMongoDocIds.add(String(matchingDoc._id));
        matchedRecords.push({
          excelFile: excelRow.file,
          sheet: excelRow.sheet,
          rowNumber: excelRow.rowNumber,
          identifier,
          collection: targetCol,
          mongoId: String(matchingDoc._id),
          status: "MATCH"
        });

        // Check for field differences
        for (const [k, v] of Object.entries(rowData)) {
          if (matchingDoc[k] !== undefined && String(matchingDoc[k]).trim() !== String(v).trim()) {
            dataDifferences.push({
              identifier,
              field: k,
              excelValue: v,
              mongoValue: String(matchingDoc[k])
            });
          }
        }
      } else {
        missingInMongo.push({
          excelFile: excelRow.file,
          sheet: excelRow.sheet,
          rowNumber: excelRow.rowNumber,
          identifier,
          targetCollection: targetCol,
          data: rowData
        });
      }
    }

    // Identify MongoDB Only documents
    const mongoOnly = [];
    for (const [colName, docs] of Object.entries(allMongoDocuments)) {
      if (colName === "source_excel_data") continue;
      for (const d of docs) {
        if (!matchedMongoDocIds.has(String(d._id)) && !d._init) {
          mongoOnly.push({
            collection: colName,
            documentId: String(d._id),
            data: d
          });
        }
      }
    }

    // 4. CHECKLIST MASTER SPECIAL AUDIT
    const checklistMasterRows = allExcelRows.filter(r => r.targetCollection === "checklist_master");
    const checklistMasterDocs = allMongoDocuments["checklist_master"] || [];
    const checklistSystemDocs = checklistMasterDocs.filter(d => d._init === true);
    const checklistBusinessDocs = checklistMasterDocs.filter(d => !d._init);
    const checklistMatched = checklistMasterRows.filter(r => {
      const id = r.data["Template ID"] || r.data["Checklist ID"];
      return checklistBusinessDocs.some(d => d["Template ID"] === id || d["Checklist ID"] === id);
    });

    // 5. CALCULATE TOTALS & DATA COMPLETENESS
    const totalExcelRows = allExcelRows.length;
    const completeness = totalExcelRows > 0 ? Math.round((matchedRecords.length / totalExcelRows) * 100) : 100;
    const finalStatus = missingInMongo.length === 0 ? "PASS" : "FAIL";

    // 6. SAVE COMPLETE MACHINE-READABLE AUDIT REPORT (JSON & XLSX)
    const reportData = {
      timestamp: new Date().toISOString(),
      database: "skyms",
      summary: {
        excelFilesCount: excelFiles.length,
        worksheetsCount: excelInventory.length,
        totalExcelRows,
        mongoCollectionsCount: mongoInventory.length,
        matchedCount: matchedRecords.length,
        missingCount: missingInMongo.length,
        differencesCount: dataDifferences.length,
        mongoOnlyCount: mongoOnly.length,
        dataCompleteness: `${completeness}%`,
        finalStatus
      },
      checklistMasterSpecialAudit: {
        excelRows: checklistMasterRows.length,
        mongoBusinessDocs: checklistBusinessDocs.length,
        mongoSystemDocs: checklistSystemDocs.length,
        matched: checklistMatched.length,
        missing: checklistMasterRows.length - checklistMatched.length
      },
      excelInventory,
      mongoInventory,
      missingInMongo,
      dataDifferences,
      mongoOnly
    };

    const auditJsonPath = path.join(dataDir, "excel-mongodb-audit.json");
    fs.writeFileSync(auditJsonPath, JSON.stringify(reportData, null, 2));

    // Create Multi-Sheet Excel Audit File
    const auditWb = new ExcelJS.Workbook();

    // Sheet 1: Summary
    const wsSummary = auditWb.addWorksheet("Summary");
    wsSummary.addRow(["Metric", "Value"]);
    wsSummary.addRow(["Excel Files", excelFiles.length]);
    wsSummary.addRow(["Worksheets", excelInventory.length]);
    wsSummary.addRow(["Total Excel Rows", totalExcelRows]);
    wsSummary.addRow(["MongoDB Collections", mongoInventory.length]);
    wsSummary.addRow(["Matched Records", matchedRecords.length]);
    wsSummary.addRow(["Missing In MongoDB", missingInMongo.length]);
    wsSummary.addRow(["Data Differences", dataDifferences.length]);
    wsSummary.addRow(["MongoDB Only Records", mongoOnly.length]);
    wsSummary.addRow(["Data Completeness", `${completeness}%`]);
    wsSummary.addRow(["Final Status", finalStatus]);

    // Sheet 2: Excel Inventory
    const wsInv = auditWb.addWorksheet("Excel Inventory");
    wsInv.addRow(["File", "Sheet", "Rows", "Columns", "Target Collection", "Headers"]);
    excelInventory.forEach(inv => wsInv.addRow([inv.file, inv.sheet, inv.rowsCount, inv.columnsCount, inv.targetCollection, inv.headers.join(", ")]));

    // Sheet 3: MongoDB Inventory
    const wsMongoInv = auditWb.addWorksheet("MongoDB Inventory");
    wsMongoInv.addRow(["Collection", "Total Docs", "Business Docs", "System Docs"]);
    mongoInventory.forEach(mi => wsMongoInv.addRow([mi.collection, mi.totalDocs, mi.businessDocs, mi.systemDocs]));

    // Sheet 4: Matched Records
    const wsMatched = auditWb.addWorksheet("Matched");
    wsMatched.addRow(["File", "Sheet", "Row", "Identifier", "Collection", "Mongo Document ID", "Status"]);
    matchedRecords.slice(0, 5000).forEach(m => wsMatched.addRow([m.excelFile, m.sheet, m.rowNumber, m.identifier, m.collection, m.mongoId, m.status]));

    // Sheet 5: Missing in MongoDB
    const wsMissing = auditWb.addWorksheet("Missing in MongoDB");
    wsMissing.addRow(["File", "Sheet", "Row", "Identifier", "Target Collection", "Data"]);
    missingInMongo.forEach(ms => wsMissing.addRow([ms.excelFile, ms.sheet, ms.rowNumber, ms.identifier, ms.targetCollection, JSON.stringify(ms.data)]));

    const auditXlsxPath = path.join(dataDir, "excel-mongodb-audit.xlsx");
    await auditWb.xlsx.writeFile(auditXlsxPath);

    // 7. PRINT TERMINAL REPORT
    console.log("================================================================================");
    console.log("                       EXCEL SOURCE INVENTORY                                   ");
    console.log("================================================================================");
    excelInventory.forEach(inv => {
      console.log(`FILE: ${inv.file} | SHEET: ${inv.sheet} | ROWS: ${inv.rowsCount} | TARGET: [${inv.targetCollection}]`);
    });

    console.log("\n================================================================================");
    console.log("                       MONGODB COLLECTIONS INVENTORY                            ");
    console.log("================================================================================");
    mongoInventory.forEach(mi => {
      console.log(`COLLECTION: [${mi.collection.padEnd(24, " ")}] | TOTAL DOCS: ${String(mi.totalDocs).padEnd(5, " ")} | BUSINESS: ${String(mi.businessDocs).padEnd(5, " ")} | SYSTEM: ${mi.systemDocs}`);
    });

    console.log("\n================================================================================");
    console.log("                      CHECKLIST MASTER SPECIAL AUDIT                            ");
    console.log("================================================================================");
    console.log(`Excel Checklist Master Rows:            ${checklistMasterRows.length}`);
    console.log(`MongoDB Business Documents:             ${checklistBusinessDocs.length}`);
    console.log(`MongoDB System Placeholders:            ${checklistSystemDocs.length}`);
    console.log(`Matched Records:                        ${checklistMatched.length}`);
    console.log(`Missing in MongoDB:                     ${checklistMasterRows.length - checklistMatched.length}`);

    console.log("\n================================================================================");
    console.log("                   SKYMS EXCEL vs MONGODB AUDIT SUMMARY                         ");
    console.log("================================================================================");
    console.log(`Excel Files:                     ${excelFiles.length}`);
    console.log(`Excel Worksheets:                ${excelInventory.length}`);
    console.log(`Total Excel Source Rows:         ${totalExcelRows}`);
    console.log(`MongoDB Collections Discovered:  ${mongoInventory.length}`);
    console.log(`Matched Records:                 ${matchedRecords.length}`);
    console.log(`Missing in MongoDB:              ${missingInMongo.length}`);
    console.log(`Data Differences:                ${dataDifferences.length}`);
    console.log(`MongoDB Only Records:            ${mongoOnly.length}`);
    console.log(`DATA COMPLETENESS:               ${completeness}%`);
    console.log(`FINAL AUDIT STATUS:              ${finalStatus}`);
    console.log("================================================================================");
    console.log(`Audit Reports Written:`);
    console.log(` - ${auditJsonPath}`);
    console.log(` - ${auditXlsxPath}`);
    console.log("================================================================================");

  } catch (err) {
    console.error("Audit Runtime Error:", err.message);
  } finally {
    await client.close();
  }
}

runReadOnlyAudit();
