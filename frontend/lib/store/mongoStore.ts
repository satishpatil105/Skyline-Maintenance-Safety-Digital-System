import { getMongoDb } from "../mongodb";
import type { Store, StoreOp, TabData, StoreRow } from "./types";
import { TABLE_LIST, type TableDef } from "../tables";
import { CATEGORIES, headersFor } from "../safetyDeptConfig";

const ALL_MASTER_COLLECTIONS: { col: string; sheet: string; defaultHeaders: string[] }[] = [
  { col: "machines", sheet: "Machine Master", defaultHeaders: ["Asset ID", "Machine Name", "Category", "Department", "Location", "Criticality", "Status"] },
  { col: "users", sheet: "User Master", defaultHeaders: ["User ID", "Name", "Role", "Department / Machine", "Mobile", "Active", "Login Email"] },
  { col: "maintenance_records", sheet: "Maintenance Records", defaultHeaders: ["Record ID", "Date", "Asset ID", "Machine / Equipment", "Priority", "Status", "Action Taken"] },
  { col: "safety_records", sheet: "Safety Records", defaultHeaders: ["Safety Record ID", "Date", "Asset ID", "Machine Name", "Risk Level", "Status", "Observation / Issue"] },
  { col: "checklist_master", sheet: "2. Checklist Master", defaultHeaders: ["Template ID", "Category", "Check Point", "Standard / Requirement", "Frequency", "Active"] },
  { col: "spare_parts", sheet: "6. PM Parts AMC", defaultHeaders: ["partId", "partName", "machineName", "category", "stockQty", "minQty", "unitCost", "vendor", "status"] },
  { col: "documents", sheet: "7. Document Register", defaultHeaders: ["docId", "title", "category", "machine", "version", "issueDate", "approvedBy", "status"] },
  { col: "notifications", sheet: "8. Notifications", defaultHeaders: ["alertId", "title", "category", "machine", "severity", "date", "status"] },
  { col: "monthly_compliance", sheet: "10. Monthly Tracking", defaultHeaders: ["complianceId", "month", "department", "totalInspections", "passedCount", "pendingAction", "complianceRate", "status"] },
  { col: "fire_safety", sheet: "10. Fire Safety", defaultHeaders: ["Equipment ID", "Equipment Type", "Location / Area", "Last Inspection Date", "Next Due Date", "Pressure Gauge Status", "Physical Condition", "Inspector Name", "Compliance Status"] },
  { col: "employee_safety", sheet: "11. Employee Safety", defaultHeaders: ["Record ID", "Employee Name", "Department", "Event Type", "Date of Incident", "Action Taken", "Risk Severity", "Status"] },
  { col: "hira", sheet: "12. HIRA", defaultHeaders: ["HIRA ID", "Process / Activity", "Identified Hazard", "Initial Risk Rating", "Control Measure", "Residual Risk Rating", "Assigned Responsibility", "Review Frequency"] },
  { col: "environmental", sheet: "13. Environmental", defaultHeaders: ["Audit ID", "Environmental Aspect", "Target Standard", "Observed Metric", "Audit Date", "Compliance Officer", "Status"] },
  { col: "other_safety", sheet: "14. Other Safety", defaultHeaders: ["Item ID", "Safety Inspection Item", "Category", "Location", "Audit Status", "Remarks"] },
];

function collectionForTab(tabName: string): string {
  const s = tabName.toLowerCase().replace(/^\s*\d+\s*[.)-]?\s*/, "").trim();
  if (s.includes("user")) return "users";
  if (s.includes("machine")) return "machines";
  if (s.includes("maintenance")) return "maintenance_records";
  if (s.includes("checklist")) return "checklist_master";
  if (s.includes("fire")) return "fire_safety";
  if (s.includes("employee safety")) return "employee_safety";
  if (s.includes("hira")) return "hira";
  if (s.includes("environmental")) return "environmental";
  if (s.includes("other safety")) return "other_safety";
  if (s.includes("safety record") || s.includes("safety")) return "safety_records";
  if (s.includes("part") || s.includes("amc")) return "spare_parts";
  if (s.includes("document")) return "documents";
  if (s.includes("notif")) return "notifications";
  if (s.includes("month") || s.includes("compliance")) return "monthly_compliance";
  if (s.includes("employee") && !s.includes("safety")) return "employees";
  if (s.includes("breakdown")) return "breakdowns";
  return "safety_inspections";
}

function normalizeKey(s: string): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export class MongoStore implements Store {
  kind: "mongodb" = "mongodb";

  describe(): { kind: "mongodb"; label: string } {
    return { kind: "mongodb", label: "MongoDB Atlas (Database: skyms)" };
  }

  async readAll(opts?: { fresh?: boolean }): Promise<TabData[]> {
    const tabs: TabData[] = [];
    const loadedTabKeys = new Set<string>();

    let db;
    try {
      db = await Promise.race([
        getMongoDb(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("MongoDB connection timeout")), 8000)
        ),
      ]);
    } catch (err) {
      console.warn("[MongoStore] MongoDB Atlas unavailable, reading cached data:", (err as Error)?.message);
    }

    if (db) {
      try {
        // 1. Query registered table definitions in MongoDB
        for (const table of TABLE_LIST) {
          const colName = collectionForTab(table.sheet);
          const col = db.collection(colName);
          const docs = await col.find({}).toArray();

          if (docs.length > 0) {
            const headers = table.columns.map((c) => c.label);
            const keys = table.columns.map((c) => c.key);

            const rows: StoreRow[] = docs.map((doc: any, index: number) => {
              const cells = keys.map((key) => {
                if (doc[key] !== undefined && doc[key] !== null) return String(doc[key]).trim();
                const colDef = table.columns.find((c) => c.key === key);
                if (colDef && doc[colDef.label] !== undefined && doc[colDef.label] !== null) {
                  return String(doc[colDef.label]).trim();
                }
                return "";
              });
              return { row: index + 2, cells };
            });

            tabs.push({ name: table.sheet, headers, rows });
            loadedTabKeys.add(normalizeKey(table.sheet));
            loadedTabKeys.add(normalizeKey(table.id));
            loadedTabKeys.add(normalizeKey(table.dbKey));
          }
        }

        // 2. Query all remaining MongoDB master collections dynamically
        for (const masterCol of ALL_MASTER_COLLECTIONS) {
          const normName = normalizeKey(masterCol.sheet);
          if (!loadedTabKeys.has(normName)) {
            const col = db.collection(masterCol.col);
            const docs = await col.find({}).toArray();
            if (docs.length > 0) {
              const headers = Object.keys(docs[0] || {}).filter((k) => k !== "_id" && k !== "__row");
              const rows: StoreRow[] = docs.map((doc: any, index: number) => ({
                row: index + 2,
                cells: headers.map((h) => String(doc[h] ?? "").trim()),
              }));
              tabs.push({ name: masterCol.sheet, headers: headers.length > 0 ? headers : masterCol.defaultHeaders, rows });
              loadedTabKeys.add(normName);
              loadedTabKeys.add(normalizeKey(masterCol.col));
            }
          }
        }

        // 3. Query any other collections dynamically from MongoDB database
        const collections = await db.listCollections().toArray();
        for (const colInfo of collections) {
          const colName = colInfo.name;
          if (colName.startsWith("system.")) continue;
          const normCol = normalizeKey(colName);
          if (!loadedTabKeys.has(normCol)) {
            const docs = await db.collection(colName).find({}).limit(500).toArray();
            if (docs.length > 0) {
              const headers = Object.keys(docs[0] || {}).filter((k) => k !== "_id" && k !== "__row");
              const rows: StoreRow[] = docs.map((doc: any, index: number) => ({
                row: index + 2,
                cells: headers.map((h) => String(doc[h] ?? "").trim()),
              }));
              tabs.push({ name: colName, headers, rows });
              loadedTabKeys.add(normCol);
            }
          }
        }
      } catch (err) {
        console.warn("[MongoStore] MongoDB query error:", err);
      }
    }

    // Merge fallback data from local db.json for any tables not yet loaded
    try {
      const fs = await import("fs");
      const path = await import("path");
      const possiblePaths = [
        path.join(process.cwd(), "data", "db.json"),
        path.join(process.cwd(), "..", "data", "db.json"),
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
          const findRawArray = (name: string): any[] => {
            const reqNorm = normalizeKey(name);
            for (const [k, v] of Object.entries(raw)) {
              if (k === "allSheets") continue;
              if (Array.isArray(v) && normalizeKey(k) === reqNorm) return v;
            }
            if (raw.allSheets && typeof raw.allSheets === "object") {
              for (const [k, v] of Object.entries(raw.allSheets)) {
                if (Array.isArray(v) && normalizeKey(k) === reqNorm) return v;
              }
            }
            return [];
          };

          for (const table of TABLE_LIST) {
            const normKey = normalizeKey(table.sheet);
            if (!loadedTabKeys.has(normKey)) {
              const sheetRows = findRawArray(table.sheet) || findRawArray(table.id) || findRawArray(table.dbKey);
              if (sheetRows.length > 0) {
                const headers = table.columns.map((c) => c.label);
                const keys = table.columns.map((c) => c.key);
                const rows: StoreRow[] = sheetRows.map((doc: any, index: number) => {
                  const cells = keys.map((key) => {
                    if (doc[key] !== undefined && doc[key] !== null) return String(doc[key]).trim();
                    const colDef = table.columns.find((c) => c.key === key);
                    if (colDef && doc[colDef.label] !== undefined && doc[colDef.label] !== null) {
                      return String(doc[colDef.label]).trim();
                    }
                    return "";
                  });
                  return { row: index + 2, cells };
                });
                tabs.push({ name: table.sheet, headers, rows });
                loadedTabKeys.add(normKey);
              }
            }
          }

          // Merge all custom sheet keys from db.json
          const allSources = { ...raw, ...(raw.allSheets || {}) };
          delete allSources["allSheets"];

          for (const [sheetName, sheetRows] of Object.entries(allSources)) {
            const reqNorm = normalizeKey(sheetName);
            if (!loadedTabKeys.has(reqNorm)) {
              const rowsList = Array.isArray(sheetRows) ? (sheetRows as any[]) : [];
              if (rowsList.length > 0) {
                const headers = Object.keys(rowsList[0] || {}).filter((k) => k !== "_id" && k !== "__row");
                const rows: StoreRow[] = rowsList.map((doc: any, index: number) => ({
                  row: index + 2,
                  cells: headers.map((h) => String(doc[h] ?? "").trim()),
                }));
                tabs.push({ name: sheetName, headers, rows });
                loadedTabKeys.add(reqNorm);
              }
            }
          }
          break;
        }
      }
    } catch (e) {
      console.error("[MongoStore] db.json merge error:", e);
    }

    return tabs;
  }

  async apply(ops: StoreOp[]): Promise<void> {
    const db = await getMongoDb();

    for (const op of ops) {
      const colName = collectionForTab(op.tab);
      const col = db.collection(colName);

      if (op.type === "append") {
        const table = TABLE_LIST.find(
          (t) => t.sheet.toLowerCase() === op.tab.toLowerCase() || collectionForTab(t.sheet) === colName
        );
        const doc: Record<string, string> = {
          _importedAt: new Date().toISOString(),
        };

        if (table) {
          table.columns.forEach((colDef, idx) => {
            if (op.cells[idx] !== undefined) {
              doc[colDef.key] = op.cells[idx];
              doc[colDef.label] = op.cells[idx];
            }
          });
        } else {
          op.cells.forEach((val, idx) => {
            doc[`field_${idx}`] = val;
          });
        }

        await col.insertOne(doc);
      } else if (op.type === "update") {
        const table = TABLE_LIST.find(
          (t) => t.sheet.toLowerCase() === op.tab.toLowerCase() || collectionForTab(t.sheet) === colName
        );

        const deptCat = CATEGORIES.find(
          (c) =>
            c.tab.toLowerCase() === op.tab.toLowerCase() ||
            normalizeKey(c.tab) === normalizeKey(op.tab) ||
            collectionForTab(c.tab) === colName ||
            op.tab.toLowerCase().includes(c.id)
        );

        const updateDoc: Record<string, string> = {
          _lastUpdated: new Date().toISOString(),
        };

        if (table) {
          table.columns.forEach((colDef, idx) => {
            if (op.cells[idx] !== undefined) {
              updateDoc[colDef.key] = op.cells[idx];
              updateDoc[colDef.label] = op.cells[idx];
            }
          });
        } else if (deptCat) {
          const catHeaders = headersFor(deptCat);
          catHeaders.forEach((h, idx) => {
            if (op.cells[idx] !== undefined) {
              updateDoc[h] = op.cells[idx];
            }
          });
        } else {
          // Dynamic fallback
          op.cells.forEach((val, idx) => {
            updateDoc[`field_${idx}`] = val;
          });
        }

        // Search cells for status and record ID
        const knownStatuses = ["Open", "In Progress", "Resolved", "Completed", "Closed", "Under Review"];
        for (const cell of op.cells) {
          if (typeof cell === "string") {
            const trimmed = cell.trim();
            const matchedStatus = knownStatuses.find((s) => s.toLowerCase() === trimmed.toLowerCase());
            if (matchedStatus) {
              updateDoc["Status"] = matchedStatus;
              updateDoc["status"] = matchedStatus;
            }
          }
        }

        // Find key value for matching record in DB
        let recordIdVal = "";
        for (const cell of op.cells) {
          if (typeof cell === "string" && /^(FIRE|EMP|HIRA|ENV|OTH|SAF)-/i.test(cell.trim())) {
            recordIdVal = cell.trim();
            break;
          }
        }

        if (recordIdVal) {
          await col.updateOne(
            {
              $or: [
                { "Record ID": recordIdVal },
                { recordId: recordIdVal },
                { "Safety Record ID": recordIdVal },
                { "Equipment ID / Tag": recordIdVal },
                { id: recordIdVal },
              ],
            },
            { $set: updateDoc },
            { upsert: true }
          );
        }
      } else if (op.type === "delete") {
        const table = TABLE_LIST.find(
          (t) => t.sheet.toLowerCase() === op.tab.toLowerCase() || collectionForTab(t.sheet) === colName
        );
        if (table) {
          const keyField = (table as any).keyColumn || table.columns[0]?.key || "id";
          const keyColDef = table.columns.find((c) => c.key === keyField);
          const keyIndex = table.columns.findIndex((c) => c.key === keyField);

          if (keyIndex !== -1 && op.expected[keyIndex]) {
            const keyVal = op.expected[keyIndex];
            await col.deleteOne({
              $or: [
                { [keyField]: keyVal },
                keyColDef ? { [keyColDef.label]: keyVal } : {},
              ],
            });
          }
        }
      }
    }
  }
}
