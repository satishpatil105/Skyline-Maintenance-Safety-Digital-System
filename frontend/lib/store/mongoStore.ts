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
  { col: "notifications", sheet: "8. Notifications", defaultHeaders: ["Notification ID", "Date", "Notification Type", "Asset ID", "Machine / Equipment", "Message", "Priority", "Assigned To", "Status", "Due Date", "Created By", "Closed Date", "Remarks", "Created At", "Last Updated"] },
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

  private cachedTabs: TabData[] | null = null;
  private lastFetchTime = 0;

  async readAll(opts?: { fresh?: boolean }): Promise<TabData[]> {
    if (!opts?.fresh && this.cachedTabs && Date.now() - this.lastFetchTime < 5000) {
      return this.cachedTabs;
    }

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
        // Query registered tables in parallel
        const tableResults = await Promise.all(
          TABLE_LIST.map(async (table) => {
            const colName = collectionForTab(table.sheet);
            const docs = await db!.collection(colName).find({}).toArray().catch(() => []);
            return { table, docs };
          })
        );

        for (const { table, docs } of tableResults) {
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

        // Query remaining master collections in parallel
        const remainingMasterCols = ALL_MASTER_COLLECTIONS.filter(
          (m) => !loadedTabKeys.has(normalizeKey(m.sheet))
        );
        const masterResults = await Promise.all(
          remainingMasterCols.map(async (masterCol) => {
            const docs = await db!.collection(masterCol.col).find({}).toArray().catch(() => []);
            return { masterCol, docs };
          })
        );

        for (const { masterCol, docs } of masterResults) {
          const normName = normalizeKey(masterCol.sheet);
          if (!loadedTabKeys.has(normName)) {
            let headers = masterCol.defaultHeaders;
            if (docs.length > 0) {
              const keys = Object.keys(docs[0] || {}).filter((k) => k !== "_id" && k !== "__row" && !k.startsWith("_"));
              if (keys.length > 0 && !keys.every((k) => k.startsWith("field_"))) {
                headers = keys;
              }
            }
            const rows: StoreRow[] = docs.map((doc: any, index: number) => {
              const cells = headers.map((h, hIdx) => {
                if (doc[h] !== undefined && doc[h] !== null) return String(doc[h]).trim();
                if (doc[`field_${hIdx}`] !== undefined) return String(doc[`field_${hIdx}`]).trim();
                return "";
              });
              return { row: index + 2, cells };
            });
            tabs.push({ name: masterCol.sheet, headers, rows });
            if (docs.length > 0) {
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
            const rowsList = Array.isArray(sheetRows) ? (sheetRows as any[]) : [];
            if (rowsList.length === 0) continue;

            const existingTab = tabs.find((t) => normalizeKey(t.name) === reqNorm || (reqNorm.includes("notif") && normalizeKey(t.name).includes("notif")));
            if (existingTab && existingTab.rows.length === 0) {
              const headers = existingTab.headers;
              existingTab.rows = rowsList.map((doc: any, index: number) => ({
                row: index + 2,
                cells: headers.map((h, hIdx) => {
                  if (doc[h] !== undefined && doc[h] !== null) return String(doc[h]).trim();
                  if (doc[normalizeKey(h)] !== undefined) return String(doc[normalizeKey(h)]).trim();
                  if (doc[`field_${hIdx}`] !== undefined) return String(doc[`field_${hIdx}`]).trim();
                  return "";
                }),
              }));
              loadedTabKeys.add(reqNorm);
              continue;
            }

            if (!loadedTabKeys.has(reqNorm)) {
              const headers = Object.keys(rowsList[0] || {}).filter((k) => k !== "_id" && k !== "__row");
              const rows: StoreRow[] = rowsList.map((doc: any, index: number) => ({
                row: index + 2,
                cells: headers.map((h) => String(doc[h] ?? "").trim()),
              }));
              tabs.push({ name: sheetName, headers, rows });
              loadedTabKeys.add(reqNorm);
            }
          }
          break;
        }
      }
    } catch (e) {
      console.error("[MongoStore] db.json merge error:", e);
    }

    this.cachedTabs = tabs;
    this.lastFetchTime = Date.now();
    return tabs;
  }

  async apply(ops: StoreOp[]): Promise<void> {
    if (!this.cachedTabs) {
      this.cachedTabs = await this.readAll();
    }

    // 1. Update in-memory cachedTabs immediately
    if (this.cachedTabs) {
      for (const op of ops) {
        const normTab = normalizeKey(op.tab);
        let tab = this.cachedTabs.find((t) => normalizeKey(t.name) === normTab);
        if (!tab) {
          const masterCol = ALL_MASTER_COLLECTIONS.find((m) => normalizeKey(m.sheet) === normTab || m.col === collectionForTab(op.tab));
          tab = {
            name: op.tab,
            headers: masterCol ? masterCol.defaultHeaders : ["Notification ID", "Date", "Notification Type", "Asset ID", "Machine / Equipment", "Message", "Priority", "Assigned To", "Status", "Due Date", "Created By", "Closed Date", "Remarks", "Created At", "Last Updated"],
            rows: [],
          };
          this.cachedTabs.push(tab);
        }

        if (op.type === "append") {
          tab.rows.push({
            row: tab.rows.length + 2,
            cells: [...op.cells],
          });
        } else if (op.type === "update") {
          const rowIdx = tab.rows.findIndex((r) => r.row === op.row);
          if (rowIdx >= 0) {
            tab.rows[rowIdx].cells = [...op.cells];
          } else {
            // Find by matching ID in cells
            const idCell = op.cells.find((c) => typeof c === "string" && /^(NTF|ALT|SAF|MNT|CHK|PRT|DOC)-/i.test(c.trim()));
            if (idCell) {
              const match = tab.rows.find((r) => r.cells.some((c) => String(c).trim().toLowerCase() === idCell.trim().toLowerCase()));
              if (match) {
                match.cells = [...op.cells];
              }
            }
          }
        } else if (op.type === "delete") {
          const rowIdx = tab.rows.findIndex((r) => r.row === op.row);
          if (rowIdx >= 0) {
            tab.rows.splice(rowIdx, 1);
          }
        }
      }
      this.lastFetchTime = Date.now();
    }

    // 2. Persist notifications to local db.json
    try {
      const fs = await import("fs");
      const path = await import("path");
      const dbPath = path.join(process.cwd(), "data", "db.json");
      if (fs.existsSync(dbPath)) {
        const raw = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
        const notifTab = this.cachedTabs?.find((t) => normalizeKey(t.name).includes("notif"));
        if (notifTab && notifTab.rows.length > 0) {
          raw.notifications = notifTab.rows.map((r) => {
            const obj: Record<string, string> = {};
            notifTab.headers.forEach((h, idx) => {
              obj[h] = r.cells[idx] ?? "";
            });
            return obj;
          });
          fs.writeFileSync(dbPath, JSON.stringify(raw, null, 2), "utf-8");
        }
      }
    } catch (fsErr) {
      console.warn("[MongoStore] Error syncing to db.json:", fsErr);
    }

    // 3. Asynchronously sync to MongoDB Atlas with timeout protection
    try {
      const db = await Promise.race([
        getMongoDb(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("MongoDB apply timeout after 6s")), 6000)
        ),
      ]);

      if (!db) return;

      for (const op of ops) {
        const colName = collectionForTab(op.tab);
        const col = db.collection(colName);

        const currentTab = this.cachedTabs?.find(
          (t) => t.name.toLowerCase() === op.tab.toLowerCase() || normalizeKey(t.name) === normalizeKey(op.tab)
        );

        if (op.type === "append") {
          const table = TABLE_LIST.find(
            (t) => t.sheet.toLowerCase() === op.tab.toLowerCase() || collectionForTab(t.sheet) === colName
          );
          const masterCol = ALL_MASTER_COLLECTIONS.find(
            (m) => m.sheet.toLowerCase() === op.tab.toLowerCase() || m.col === colName || normalizeKey(m.sheet) === normalizeKey(op.tab)
          );
          const doc: Record<string, string> = {
            _importedAt: new Date().toISOString(),
          };

          if (currentTab && currentTab.headers && currentTab.headers.length > 0) {
            currentTab.headers.forEach((h, idx) => {
              if (op.cells[idx] !== undefined) {
                doc[h] = op.cells[idx];
              }
            });
          } else if (table) {
            table.columns.forEach((colDef, idx) => {
              if (op.cells[idx] !== undefined) {
                doc[colDef.key] = op.cells[idx];
                doc[colDef.label] = op.cells[idx];
              }
            });
          } else if (masterCol) {
            masterCol.defaultHeaders.forEach((header, idx) => {
              if (op.cells[idx] !== undefined) {
                doc[header] = op.cells[idx];
              }
            });
          } else {
            op.cells.forEach((val, idx) => {
              doc[`field_${idx}`] = val;
            });
          }

          // Auto-alias common notification fields so reader matches regardless of column schema
          if (colName === "notifications") {
            const titleVal = doc["Title"] || doc["Alert Title"] || doc["Message"] || doc["Problem"] || doc["Observation"];
            if (titleVal) {
              doc["Title"] = titleVal;
              doc["Alert Title"] = titleVal;
              doc["Message"] = titleVal;
            }
            const idVal = doc["Notification ID"] || doc["Alert ID"] || doc["id"];
            if (idVal) {
              doc["Notification ID"] = idVal;
              doc["Alert ID"] = idVal;
              doc["id"] = idVal;
            }
            const prioVal = doc["Priority"] || doc["Severity"] || doc["Risk Level"];
            if (prioVal) {
              doc["Priority"] = prioVal;
              doc["Severity"] = prioVal;
            }
            const dateVal = doc["Date"] || doc["Date & Time"] || doc["Due Date"];
            if (dateVal) {
              doc["Date"] = dateVal;
              doc["Date & Time"] = dateVal;
              doc["Due Date"] = dateVal;
            }
            const machVal = doc["Source / Machine"] || doc["Machine / Equipment"] || doc["Machine Name"];
            if (machVal) {
              doc["Source / Machine"] = machVal;
              doc["Machine / Equipment"] = machVal;
            }
            const deptVal = doc["Target Department"] || doc["Assigned To"];
            if (deptVal) {
              doc["Target Department"] = deptVal;
              doc["Assigned To"] = deptVal;
            }

            const notifId = doc["Notification ID"] || doc["Alert ID"] || doc["id"];
            if (notifId) {
              await col.updateOne(
                { $or: [{ "Notification ID": notifId }, { "Alert ID": notifId }, { id: notifId }] },
                { $set: doc },
                { upsert: true }
              );
              continue;
            }
          }

          await col.insertOne(doc);
        } else if (op.type === "update") {
          const table = TABLE_LIST.find(
            (t) => t.sheet.toLowerCase() === op.tab.toLowerCase() || collectionForTab(t.sheet) === colName
          );
          const masterCol = ALL_MASTER_COLLECTIONS.find(
            (m) => m.sheet.toLowerCase() === op.tab.toLowerCase() || m.col === colName || normalizeKey(m.sheet) === normalizeKey(op.tab)
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

          if (currentTab && currentTab.headers && currentTab.headers.length > 0) {
            currentTab.headers.forEach((h, idx) => {
              if (op.cells[idx] !== undefined) {
                updateDoc[h] = op.cells[idx];
              }
            });
          } else if (table) {
            table.columns.forEach((colDef, idx) => {
              if (op.cells[idx] !== undefined) {
                updateDoc[colDef.key] = op.cells[idx];
                updateDoc[colDef.label] = op.cells[idx];
              }
            });
          } else if (masterCol) {
            masterCol.defaultHeaders.forEach((header, idx) => {
              if (op.cells[idx] !== undefined) {
                updateDoc[header] = op.cells[idx];
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
            if (typeof cell === "string" && /^(FIRE|EMP|HIRA|ENV|OTH|SAF|NTF|ALT|CHK|PRT|DOC)-/i.test(cell.trim())) {
              recordIdVal = cell.trim();
              break;
            }
          }

          if (recordIdVal) {
            await col.updateOne(
              {
                $or: [
                  { "Notification ID": recordIdVal },
                  { "Alert ID": recordIdVal },
                  { alertId: recordIdVal },
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
            const keyIndex = table.columns.findIndex((c) => c.key === keyField);

            if (keyIndex !== -1 && op.expected[keyIndex]) {
              const keyVal = op.expected[keyIndex];
              await col.deleteOne({
                $or: [
                  { [keyField]: keyVal },
                  { [table.columns[keyIndex].label]: keyVal },
                  { id: keyVal },
                ],
              });
            }
          }
        }
      }
    } catch (mongoErr) {
      console.warn("[MongoStore.apply] MongoDB Atlas sync deferred/timeout:", (mongoErr as Error)?.message);
    }
  }
}

