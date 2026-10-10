import { getMongoDb } from "../mongodb";
import type { Store, StoreOp, TabData, StoreRow } from "./types";
import { TABLE_LIST, type TableDef } from "../tables";

function collectionForTab(tabName: string): string {
  const s = tabName.toLowerCase().replace(/^\s*\d+\s*[.)-]?\s*/, "").trim();
  if (s.includes("user")) return "users";
  if (s.includes("machine")) return "machines";
  if (s.includes("maintenance")) return "maintenance_records";
  if (s.includes("checklist") && s.includes("master")) return "checklist_master";
  if (s.includes("safety record") || s.includes("safety")) return "safety_records";
  if (s.includes("part") || s.includes("pm parts")) return "spare_parts";
  if (s.includes("document")) return "documents";
  if (s.includes("notif")) return "notifications";
  if (s.includes("employee") && !s.includes("safety")) return "employees";
  if (s.includes("breakdown")) return "breakdowns";
  return "safety_inspections";
}

export class MongoStore implements Store {
  kind: "mongodb" = "mongodb";

  describe(): { kind: "mongodb"; label: string } {
    return { kind: "mongodb", label: "MongoDB Atlas (Database: skyms)" };
  }

  async readAll(opts?: { fresh?: boolean }): Promise<TabData[]> {
    let db;
    try {
      db = await getMongoDb();
    } catch (err) {
      console.warn("[MongoStore] MongoDB Atlas unavailable, reading cached data:", (err as Error)?.message);
    }

    if (db) {
      try {
        const tabs: TabData[] = [];

        for (const table of TABLE_LIST) {
          const colName = collectionForTab(table.sheet);
          const col = db.collection(colName);
          const docs = await col.find({}).toArray();

          const headers = table.columns.map((c) => c.label);
          const keys = table.columns.map((c) => c.key);

          const rows: StoreRow[] = docs.map((doc: any, index: number) => {
            const cells = keys.map((key) => {
              if (doc[key] !== undefined && doc[key] !== null) {
                return String(doc[key]).trim();
              }
              const colDef = table.columns.find((c) => c.key === key);
              if (colDef && doc[colDef.label] !== undefined && doc[colDef.label] !== null) {
                return String(doc[colDef.label]).trim();
              }
              return "";
            });

            return {
              row: index + 2,
              cells,
            };
          });

          tabs.push({
            name: table.sheet,
            headers,
            rows,
          });
        }

        return tabs;
      } catch (err) {
        console.warn("[MongoStore] MongoDB query error, falling back to local dataset:", err);
      }
    }

    // Fallback: Read from local db.json
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
          const allSheets = raw.allSheets || {};
          const tabs: TabData[] = [];

          for (const table of TABLE_LIST) {
            const sheetRows = allSheets[table.sheet] || [];
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
          }

          if (tabs.length > 0) return tabs;
        }
      }
    } catch {}

    return [];
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
        if (table) {
          const updateDoc: Record<string, string> = {
            _lastUpdated: new Date().toISOString(),
          };
          table.columns.forEach((colDef, idx) => {
            if (op.cells[idx] !== undefined) {
              updateDoc[colDef.key] = op.cells[idx];
              updateDoc[colDef.label] = op.cells[idx];
            }
          });

          // Match by key or skip to position
          const keyField = (table as any).keyColumn || table.columns[0]?.key || "id";
          const keyColDef = table.columns.find((c) => c.key === keyField);
          const keyIndex = table.columns.findIndex((c) => c.key === keyField);

          if (keyIndex !== -1 && op.cells[keyIndex]) {
            const keyVal = op.cells[keyIndex];
            await col.updateOne(
              {
                $or: [
                  { [keyField]: keyVal },
                  keyColDef ? { [keyColDef.label]: keyVal } : {},
                ],
              },
              { $set: updateDoc },
              { upsert: true }
            );
          }
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
