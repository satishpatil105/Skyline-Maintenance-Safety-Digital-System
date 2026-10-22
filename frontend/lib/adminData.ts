import crypto from "crypto";
import { emailKey, readAccess, writeAccess, type AccessEntry } from "./access";
import {
  ASSET_ID_PATTERN,
  addMachine,
  addAsset,
  isAdminUser,
  normalize,
  readDb,
  rowNumberOf,
  uniqueRecordId,
  withDbLock,
  writeDb,
} from "./db";
import { MIN_PASSWORD_LENGTH, hashPassword } from "./password";
import { ConflictError } from "./store";
import { TABLES, type ColumnDef, type TableDef } from "./tables";
import type { Database, TableId, UserRecord } from "./types";
import { syncUserAssignedMachines, syncMachineAssignedUsers } from "./assignments";

type Row = Record<string, string>;

export interface AdminResult {
  success: boolean;
  message: string;
  status?: number;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

export function visibleColumns(table: TableDef, sheetKeys: string[]): ColumnDef[] {
  const columns: ColumnDef[] = sheetKeys
    .filter((key) => !table.secretKeys.includes(key))
    .map((key) => table.columns.find((c) => c.key === key) ?? { key, label: key });

  if (table.id === "users") {
    columns.push(...table.virtualColumns.filter((c) => !table.secretKeys.includes(c.key)));
    columns.push({ key: "Password", label: "Password" });
  }
  return columns;
}

/** All rows for a table, safe to send to the browser. */
export async function listTable(id: TableId) {
  const table = TABLES[id];
  const db = await readDb(true);
  const sheetKeys = table.columns.map((c) => c.key);
  const rows = ((db[table.dbKey] || []) as unknown as Row[]).map((row, idx) => {
    const out: Row = { ...row };
    delete (out as Record<string, unknown>).__row;
    for (const secret of table.secretKeys) delete out[secret];
    // How the dashboard points at this row again when editing/deleting it.
    const rowNum = rowNumberOf(row) ?? (idx + 2);
    out["__id"] = `${rowNum}|${rowFingerprint(row, sheetKeys)}|${row[table.idKey] ?? ""}`;
    if (id === "users") {
      out["Password"] = row["Display Password"] || (row["Password Hash"] ? "••••••••" : "Not set");
      out["Display Password"] = row["Display Password"] || "";
      out["Current Password"] = row["Display Password"] || (row["Password Hash"] ? "••••••••" : "");

      let assigned = (row as any).assignedMachines || row["Assigned Machines"] || [];
      if (typeof assigned === "string") {
        assigned = assigned.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
      out["Assigned Machines"] = Array.isArray(assigned) ? assigned.join(", ") : "";
      (out as any).assignedMachines = Array.isArray(assigned) ? assigned : [];
    }
    if (id === "machines" || id === "assets") {
      const aid = out["Asset ID"] || out["assetId"] || "";
      if (!out["QR Link"] && aid) {
        out["QR Link"] = `http://localhost:3000/machine/${encodeURIComponent(aid)}`;
      }
      if (!out["Serial No."] && out["Serial No"]) {
        out["Serial No."] = out["Serial No"];
      }

      let rawAssigned = (row as any).assignedUsers;
      if (!Array.isArray(rawAssigned) || rawAssigned.length === 0) {
        if (row["Assigned Users"]) {
          rawAssigned = typeof row["Assigned Users"] === "string"
            ? row["Assigned Users"].split(",").map((s: string) => s.trim()).filter(Boolean)
            : Array.isArray(row["Assigned Users"]) ? row["Assigned Users"] : [];
        }
      }
      const userList = Array.isArray(rawAssigned)
        ? Array.from(new Set(rawAssigned.map(String).map((s) => s.trim()).filter(Boolean)))
        : [];
      out["Assigned Users"] = userList.join(", ");
      (out as any).assignedUsers = userList;

      // Enrich with user records from User Management
      const userMap = new Map((db.users || []).map((u) => [
        String(u["User ID"] || u.userId || u["Login Email"] || "").trim().toUpperCase(),
        {
          userId: String(u["User ID"] || u.userId || "").trim(),
          name: String(u.Name || u.name || "").trim(),
          role: String(u.Role || u.role || "Operator").trim(),
          email: String(u["Login Email"] || u.email || "").trim(),
        }
      ]));
      (out as any).assignedUserDetails = userList.map((id) =>
        userMap.get(id.toUpperCase()) || { userId: id, name: id, role: "Operator", email: "" }
      );
    }
    return out;
  });
  return {
    table: id,
    idKey: table.idKey,
    columns: visibleColumns(table, sheetKeys),
    rows,
  };
}

/** Copy only the editable, defined sheet columns present in `input`. */
function pickColumns(table: TableDef, input: Row): Row {
  const out: Row = {};
  for (const col of table.columns) {
    if (col.key === table.idKey || table.secretKeys.includes(col.key)) continue;
    const candidates = [
      col.key,
      col.label,
      ...(col.aliases || []),
      col.key.toLowerCase(),
      col.label.toLowerCase(),
    ];
    for (const [inKey, inVal] of Object.entries(input)) {
      if (candidates.some((c) => c.toLowerCase() === inKey.toLowerCase())) {
        out[col.key] = clean(inVal, col.type === "textarea" ? 5000 : 500);
        break;
      }
    }
  }
  return out;
}

/** A short fingerprint of a row's sheet cells; changes whenever any cell changes. */
function rowFingerprint(row: Row, sheetKeys: string[]): string {
  const cells = sheetKeys.map((k) => String(row[k] ?? "").trim());
  return crypto.createHash("sha1").update(JSON.stringify(cells)).digest("hex").slice(0, 8);
}

/**
 * Find a row. The dashboard addresses rows as "<sheet row>|<fingerprint>|<id>":
 * real sheets have blank or repeated IDs (users with no email, records that
 * all use a date as "Record ID"...), so the ID alone can't say which row is
 * meant. The fingerprint must still match the row at that position, otherwise
 * the sheet changed underneath us (a row was deleted or edited, so a
 * different person may now sit there) and the save is refused instead of
 * hitting the wrong row. A plain ID (used by API callers) still works: first match.
 */
function findIndex(db: Database, table: TableDef, id: string): number {
  const rows = (db[table.dbKey] || []) as unknown as Row[];

  // 1. Direct PK match (e.g. Asset ID, Login Email, Record ID)
  const directIdx = rows.findIndex((r) => normalize(r[table.idKey]) === normalize(id));
  if (directIdx !== -1) return directIdx;

  // 1b. Check common alternative primary keys / aliases
  const altIdx = rows.findIndex(
    (r) =>
      normalize(r.recordId) === normalize(id) ||
      normalize(r["Record ID"]) === normalize(id) ||
      normalize(r["Maintenance ID"]) === normalize(id) ||
      normalize(r["Breakdown Ticket"]) === normalize(id) ||
      normalize(r["Safety Record ID"]) === normalize(id) ||
      normalize(r["Asset ID"]) === normalize(id) ||
      normalize(r.assetId) === normalize(id) ||
      normalize(r["Login Email"]) === normalize(id)
  );
  if (altIdx !== -1) return altIdx;

  // 2. Composite ID: "<row>|<fingerprint>|<id>"
  const composite = id.match(/^([^|]*)\|([0-9a-f]{8})\|([\s\S]*)$/);
  if (composite) {
    const rawId = composite[3];
    if (rawId) {
      const idx = rows.findIndex(
        (r) =>
          normalize(r[table.idKey]) === normalize(rawId) ||
          normalize(r.recordId) === normalize(rawId) ||
          normalize(r["Record ID"]) === normalize(rawId) ||
          normalize(r["Maintenance ID"]) === normalize(rawId) ||
          normalize(r["Asset ID"]) === normalize(rawId)
      );
      if (idx !== -1) return idx;
    }

    const rowNum = Number(composite[1]);
    if (!Number.isNaN(rowNum)) {
      const idx = rows.findIndex((r, i) => (rowNumberOf(r) ?? (i + 2)) === rowNum);
      if (idx !== -1) return idx;
    }
  }

  return -1;
}

function yesNo(value: string | undefined, fallback: "Yes" | "No" | ""): string {
  const v = normalize(value);
  if (v === "yes") return "Yes";
  if (v === "no") return "No";
  return fallback;
}

/** There must always be at least one active admin who can log in. */
function hasUsableAdmin(users: UserRecord[]): boolean {
  return users.some((u) => isAdminUser(u) && Boolean(u["Password Hash"]));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- create

export async function createRow(id: TableId, input: Row): Promise<AdminResult> {
  if (id === "machines") {
    const result = await addMachine(input);
    return { ...result, status: result.success ? 201 : 400 };
  }
  if (id === "assets") {
    const result = await addAsset(input);
    return { ...result, status: result.success ? 201 : 400 };
  }

  const table = TABLES[id];

  return withDbLock(async () => {
    const db = await readDb();

    if (id === "users") return createUser(db, input);

    // maintenance / safety records
    const records = db[table.dbKey] as unknown as Row[];
    const assetId = clean(
      input["assetId"] ||
      input["Asset ID"] ||
      input["Asset ID / Machine"] ||
      input["Machine / Asset"] ||
      input["machine"]
    );
    if (!assetId) return { success: false, message: "Asset ID is required.", status: 400 };

    const matchingMachine = db.machines.find(
      (m) =>
        normalize(m["Asset ID"]) === normalize(assetId) ||
        normalize(m["Machine Name"]) === normalize(assetId) ||
        (m["Asset ID"] && assetId.toLowerCase().includes(m["Asset ID"].toLowerCase()))
    );
    if (!matchingMachine) {
      return { success: false, message: `No machine with Asset ID ${assetId}.`, status: 400 };
    }
    const resolvedAssetId = matchingMachine["Asset ID"];

    let recordId = clean(
      input["recordId"] ||
      input["Record ID"] ||
      input["Maintenance ID"] ||
      input["Safety Record ID"] ||
      input["Breakdown Ticket"] ||
      input["Ticket ID"]
    );
    if (recordId) {
      if (records.some((r) => normalize(r.recordId) === normalize(recordId))) {
        return { success: false, message: `Record ID ${recordId} already exists.`, status: 400 };
      }
    } else {
      recordId = uniqueRecordId(id === "maintenance" ? "BD" : "SAF", records.map((r) => r.recordId));
    }

    const now = new Date().toISOString();
    const row: Row = { ...pickColumns(table, input), recordId, assetId: resolvedAssetId };
    row.createdAt = row.createdAt || now;
    row.lastUpdated = now;
    if (!row.machineName) {
      row.machineName = matchingMachine["Machine Name"] || resolvedAssetId;
    }
    if (id === "maintenance") {
      row.problem = row.problem || clean(input["Issue"] || input["problem"] || input["Problem / Request"] || input["Problem"] || input["Description"]);
      row.correctiveAction = row.correctiveAction || clean(input["Action Taken"] || input["correctiveAction"] || input["actionTaken"] || input["Corrective Action"]);
      row.date = row.date || clean(input["Date"] || input["date"]) || now.slice(0, 10);
      row.status = row.status || clean(input["Status"] || input["status"]) || "Open";
      row.priority = row.priority || clean(input["Priority"] || input["priority"]) || "Medium";
      row.submittedBy = row.submittedBy || clean(input["Submitted By"] || input["submittedBy"] || input["Technician"]) || "Admin";
      row.technicianName = row.technicianName || row.submittedBy;
      row.recordType = row.recordType || "Breakdown Ticket";
    }

    records.push(row);
    await writeDb(db);

    // Sync maintenance create directly to breakdowns collection in MongoDB Atlas
    if (id === "maintenance") {
      try {
        const { getMongoDb } = await import("./mongodb");
        const mDb = await getMongoDb().catch(() => null);
        if (mDb) {
          const isClosed = normalize(row.status) === "completed" || normalize(row.status) === "closed" || normalize(row.status) === "resolved";
          await mDb.collection("breakdowns").insertOne({
            "Breakdown Ticket": recordId,
            "Machine Asset": `${row.machineName || row.assetId} (${row.assetId})`,
            "Breakdown Issue": row.problem || "Machine Breakdown",
            "Reported Date": row.date || now.slice(0, 10),
            "Resolved Date": isClosed ? (row.completionDate || row.date || now.slice(0, 10)) : "-",
            "Downtime (Hours)": row.downtime || "0",
            "Root Cause": row.rootCause || "Under Investigation",
            "Action Taken": row.correctiveAction || "",
            "Status": row.status || "Open",
            "Priority": row.priority || "Medium",
            "Reported By": `${row.userName || row.submittedBy} (${row.userId || "ADMIN"})`,
            "createdAt": now,
            "lastUpdated": now,
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("Could not sync to breakdowns collection", err);
      }
    }

    return { success: true, message: `${cap(table.singular)} ${recordId} created.`, status: 201 };
  });
}

// ---------------------------------------------------------------- update

export async function updateRow(
  id: TableId,
  rowId: string,
  input: Row,
  actorEmail: string
): Promise<AdminResult> {
  const table = TABLES[id];

  return withDbLock(async () => {
    const db = await readDb();
    const index = findIndex(db, table, rowId);
    if (index === -1) return { success: false, message: "Row not found.", status: 404 };

    if (id === "users") return updateUser(db, index, input, actorEmail);
    if (id === "machines") return updateMachineRow(db, index, input);
    if (id === "assets") return updateAssetRow(db, index, input);

    const records = db[table.dbKey] as unknown as Row[];
    const changes = pickColumns(table, input);

    if (id === "maintenance") {
      if (input["Issue"] && !changes.problem) changes.problem = clean(input["Issue"]);
      if (input["Action Taken"] && !changes.correctiveAction) changes.correctiveAction = clean(input["Action Taken"]);
      if (input["Date"] && !changes.date) changes.date = clean(input["Date"]);
      if (input["Status"] && !changes.status) changes.status = clean(input["Status"]);
      if (input["Priority"] && !changes.priority) changes.priority = clean(input["Priority"]);
      if (input["Submitted By"] && !changes.submittedBy) changes.submittedBy = clean(input["Submitted By"]);
      if (input["Asset ID"] && !changes.assetId) changes.assetId = clean(input["Asset ID"]);
      if (input["Machine Name"] && !changes.machineName) changes.machineName = clean(input["Machine Name"]);
    }

    // Only check the Asset ID when it is being changed, so older rows that
    // already have a bad/blank one can still be edited or cleaned up.
    const newAssetId = changes.assetId;
    if (
      newAssetId !== undefined &&
      normalize(newAssetId) !== normalize(records[index].assetId) &&
      !db.machines.some((m) => normalize(m["Asset ID"]) === normalize(newAssetId))
    ) {
      return { success: false, message: `No machine with Asset ID ${newAssetId}.`, status: 400 };
    }

    records[index] = {
      ...records[index],
      ...changes,
      lastUpdated: new Date().toISOString(),
    };
    await writeDb(db);

    // Sync maintenance update to breakdowns collection in MongoDB Atlas
    if (id === "maintenance") {
      const rec = records[index];
      const recId = rec.recordId || rec["Record ID"] || rec["Maintenance ID"];
      if (recId) {
        try {
          const { getMongoDb } = await import("./mongodb");
          const mDb = await getMongoDb().catch(() => null);
          if (mDb) {
            const isClosed = normalize(rec.status) === "completed" || normalize(rec.status) === "closed" || normalize(rec.status) === "resolved";
            await mDb.collection("breakdowns").updateOne(
              { "Breakdown Ticket": recId },
              {
                $set: {
                  "Machine Asset": `${rec.machineName || rec.assetId} (${rec.assetId})`,
                  "Breakdown Issue": rec.problem || "Machine Breakdown",
                  "Status": rec.status || "Open",
                  "Priority": rec.priority || "Medium",
                  "Downtime (Hours)": rec.downtime || "0",
                  "Root Cause": rec.rootCause || "Under Investigation",
                  "Action Taken": rec.correctiveAction || "",
                  "Resolved Date": isClosed ? (rec.completionDate || rec.date || new Date().toISOString().slice(0, 10)) : "-",
                  "lastUpdated": new Date().toISOString(),
                }
              }
            ).catch(() => {});
          }
        } catch (err) {
          console.warn("Could not sync update to breakdowns collection", err);
        }
      }
    }

    return { success: true, message: `${cap(table.singular)} updated.`, status: 200 };
  });
}

/** Edit a machine row (works for rows that have no Asset ID yet, e.g. vendor-only stubs). */
async function updateMachineRow(db: Database, index: number, input: Row): Promise<AdminResult> {
  const existing = db.machines[index] as unknown as Row;
  const changes = pickColumns(TABLES.machines, input);

  const machineName = clean(
    input["Machine Name"] ||
    input["machineName"] ||
    input["Name"] ||
    input["Asset Name"] ||
    changes["Machine Name"] ||
    existing["Machine Name"]
  );
  if (!machineName) {
    return { success: false, message: "Machine Name is required.", status: 400 };
  }
  changes["Machine Name"] = machineName;

  // Ensure Serial No. is kept properly
  const serialNo = clean(input["Serial No."] || input["Serial No"] || input["serialNo"] || changes["Serial No."]);
  if (serialNo) {
    changes["Serial No."] = serialNo;
    changes["Serial No"] = serialNo;
  }

  // The Asset ID is permanent (QR codes use it), except when the row has none yet.
  if (!existing["Asset ID"]) {
    const assetId = clean(input["Asset ID"] || input["assetId"], 200);
    if (assetId) {
      if (!ASSET_ID_PATTERN.test(assetId)) {
        return { success: false, message: "Asset ID may only use letters, numbers, dots, dashes, slashes, spaces and underscores (2-50 characters).", status: 400 };
      }
      if (db.machines.some((m) => normalize(m["Asset ID"]) === normalize(assetId))) {
        return { success: false, message: `Asset ID ${assetId} already exists.`, status: 400 };
      }
      changes["Asset ID"] = assetId;
    }
  }

  const assetIdKey = (existing as any)["Asset ID"] || changes["Asset ID"] || clean(input["Asset ID"] || input["assetId"], 200);

  // Synchronize assigned users if provided in input or preserve existing
  const rawAssignedUsers = (input as any).assignedUsers !== undefined
    ? (input as any).assignedUsers
    : input["Assigned Users"];

  let userIds: string[];
  if (rawAssignedUsers !== undefined) {
    const parsed = Array.isArray(rawAssignedUsers)
      ? rawAssignedUsers.map((u: any) => String(u).trim()).filter(Boolean)
      : String(rawAssignedUsers || "").split(",").map((s) => s.trim()).filter(Boolean);
    userIds = Array.from(new Set(parsed));

    if (assetIdKey) {
      await syncMachineAssignedUsers(assetIdKey, userIds, "System Administrator").catch((e) =>
        console.warn("Could not sync assigned users for machine", e)
      );
    }
  } else {
    // Preserve existing assignments
    const existingRaw = existing.assignedUsers || existing["Assigned Users"] || [];
    const parsed = Array.isArray(existingRaw)
      ? existingRaw.map((u: any) => String(u).trim()).filter(Boolean)
      : String(existingRaw || "").split(",").map((s) => s.trim()).filter(Boolean);
    userIds = Array.from(new Set(parsed));
  }

  const updatedMachine = {
    ...existing,
    ...changes,
    assignedUsers: userIds,
    "Assigned Users": userIds.join(", "),
    "Last Updated": new Date().toISOString(),
  };

  db.machines[index] = updatedMachine as unknown as Database["machines"][number];
  await writeDb(db);

  // Directly sync single machine update to MongoDB Atlas for immediate persistence
  try {
    const { getMongoDb } = await import("./mongodb");
    const mongoDb = await getMongoDb().catch(() => null);
    if (mongoDb && assetIdKey) {
      const { sanitizeMongoDoc } = await import("./db");
      await mongoDb.collection("machines").updateOne(
        {
          $or: [
            { "Asset ID": assetIdKey },
            { assetId: assetIdKey },
            { "Machine ID": assetIdKey },
          ],
        },
        { $set: sanitizeMongoDoc(updatedMachine) },
        { upsert: true }
      ).catch(() => {});
    }
  } catch (err) {
    console.warn("Could not direct-sync machine update to Atlas", err);
  }

  return { success: true, message: "Asset details updated successfully.", status: 200 };
}

/** Edit an asset row in Asset Master (strictly independent from Machine Master). */
async function updateAssetRow(db: Database, index: number, input: Row): Promise<AdminResult> {
  if (!db.assets) db.assets = [];
  const existing = db.assets[index] as unknown as Row;
  if (!existing) {
    return { success: false, message: "Asset not found.", status: 404 };
  }
  const changes = pickColumns(TABLES.assets, input);

  const assetName = clean(
    input["Asset Name"] ||
    input["assetName"] ||
    input["Machine Name"] ||
    input["machineName"] ||
    input["Name"] ||
    changes["Asset Name"] ||
    existing["Asset Name"]
  );
  if (!assetName) {
    return { success: false, message: "Asset Name is required.", status: 400 };
  }
  changes["Asset Name"] = assetName;
  changes["Machine Name"] = assetName;

  // Ensure Serial No. is kept properly
  const serialNo = clean(input["Serial No."] || input["Serial No"] || input["serialNo"] || changes["Serial No."]);
  if (serialNo) {
    changes["Serial No."] = serialNo;
    changes["Serial No"] = serialNo;
  }

  // The Asset ID is permanent, except when the row has none yet.
  if (!existing["Asset ID"]) {
    const assetId = clean(input["Asset ID"] || input["assetId"], 200);
    if (assetId) {
      if (!ASSET_ID_PATTERN.test(assetId)) {
        return { success: false, message: "Asset ID may only use letters, numbers, dots, dashes, slashes, spaces and underscores (2-50 characters).", status: 400 };
      }
      if (db.assets.some((a) => normalize(a["Asset ID"]) === normalize(assetId))) {
        return { success: false, message: `Asset ID ${assetId} already exists in Asset Master.`, status: 400 };
      }
      changes["Asset ID"] = assetId;
    }
  }

  const updatedAsset = {
    ...existing,
    ...changes,
    "Last Updated": new Date().toISOString(),
  };

  db.assets[index] = updatedAsset as unknown as NonNullable<Database["assets"]>[number];
  await writeDb(db);

  // Directly sync single asset update to MongoDB Atlas for immediate persistence
  try {
    const { getMongoDb } = await import("./mongodb");
    const mongoDb = await getMongoDb().catch(() => null);
    if (mongoDb) {
      const assetIdKey = (updatedAsset as any)["Asset ID"] || (existing as any)["Asset ID"];
      if (assetIdKey) {
        const { sanitizeMongoDoc } = await import("./db");
        await mongoDb.collection("assets").updateOne(
          {
            $or: [
              { "Asset ID": assetIdKey },
              { assetId: assetIdKey },
              { "Machine ID": assetIdKey },
            ],
          },
          { $set: sanitizeMongoDoc(updatedAsset) },
          { upsert: true }
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Could not direct-sync asset update to Atlas", err);
  }

  return { success: true, message: "Asset details updated successfully.", status: 200 };
}

// ---------------------------------------------------------------- delete

export async function deleteRow(
  id: TableId,
  rowId: string,
  actorEmail: string
): Promise<AdminResult> {
  const table = TABLES[id];

  return withDbLock(async () => {
    const db = await readDb();
    const index = findIndex(db, table, rowId);
    if (index === -1) return { success: false, message: "Row not found.", status: 404 };

    const userEmail = id === "users" ? db.users[index]["Login Email"] : "";
    if (id === "users") {
      if (userEmail && emailKey(userEmail) === emailKey(actorEmail)) {
        return { success: false, message: "You can't delete your own account.", status: 400 };
      }
      const remaining = db.users.filter((_, i) => i !== index);
      if (!hasUsableAdmin(remaining)) {
        return { success: false, message: "You can't delete the last admin.", status: 400 };
      }
    }

    const deletedItem = ((db[table.dbKey] || []) as unknown as Row[])[index];
    const pkVal = deletedItem?.[table.idKey] || deletedItem?.["Asset ID"] || deletedItem?.assetId;

    const { getMongoDb } = await import("./mongodb");
    const mDb = await getMongoDb().catch(() => null);
    if (mDb && pkVal) {
      let col = "";
      if (id === "machines") col = "machines";
      else if (id === "assets") col = "assets";
      else if (id === "users") col = "users";
      else if (id === "maintenance") col = "maintenance_records";
      else if (id === "safety") col = "safety_records";
      if (col) {
        if (id === "machines" || id === "assets") {
          await mDb.collection(col).deleteMany({
            $or: [
              { "Asset ID": pkVal },
              { assetId: pkVal },
              { "Machine ID": pkVal },
            ],
          }).catch(() => {});
        } else {
          await mDb.collection(col).deleteOne({ [table.idKey]: pkVal }).catch(() => {});
        }
        if (id === "maintenance") {
          await mDb.collection("breakdowns").deleteOne({ "Breakdown Ticket": pkVal }).catch(() => {});
        }
      }
    }

    if (!db[table.dbKey]) (db as any)[table.dbKey] = [];
    (db[table.dbKey] as unknown[]).splice(index, 1);
    await writeDb(db);

    if (id === "users" && userEmail) {
      const access = await readAccess();
      delete access[emailKey(userEmail)];
      await writeAccess(access);
    }
    return { success: true, message: `${cap(table.singular)} deleted.`, status: 200 };
  });
}

// ---------------------------------------------------------------- users
// A user is two things: a row in the sheet (name, phone, Active, the
// Maintenance/Safety permissions...) and a login entry the app keeps itself
// (password, Admin access, Add/Edit Machine).

/** Normalise the Yes/No fields the admin typed into the sheet part of a user row. */
function sheetPart(input: Row, existing?: UserRecord): Partial<UserRecord> | string {
  const picked = pickColumns(TABLES.users, input) as Partial<UserRecord>;

  for (const key of ["Active", "Can Submit Maintenance", "Can Submit Safety", "Can Approve Close"] as const) {
    if (key in picked) picked[key] = yesNo(picked[key], "");
  }
  if (!existing) {
    // New users: active, and no permissions unless granted.
    picked.Active = picked.Active || "Yes";
    for (const key of ["Can Submit Maintenance", "Can Submit Safety", "Can Approve Close"] as const) {
      picked[key] = picked[key] || "No";
    }
  }
  return picked;
}

/** The app's own login settings for a user, after applying the form input. */
function accessPart(input: Row, existing?: AccessEntry): AccessEntry | string {
  const password = String(input["__password"] ?? "").trim();
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  const has = (k: string) => k in input;

  return {
    accessLevel: has("App Access")
      ? normalize(input["App Access"]) === "admin" ? "Admin" : "User"
      : existing?.accessLevel ?? "User",
    passwordHash: password ? hashPassword(password) : existing?.passwordHash ?? "",
    displayPassword: password ? password : existing?.displayPassword ?? "",
    canAddMachine: has("Can Add Machine") ? yesNo(input["Can Add Machine"], "No") === "Yes" : existing?.canAddMachine ?? false,
    canEditMachine: has("Can Edit Machine") ? yesNo(input["Can Edit Machine"], "No") === "Yes" : existing?.canEditMachine ?? false,
  };
}

/** What the merged user looks like once its login settings are applied. */
function withAccess(user: UserRecord, entry: AccessEntry): UserRecord {
  return {
    ...user,
    "App Access": entry.accessLevel,
    "Password Hash": entry.passwordHash,
    "Display Password": entry.displayPassword ?? "",
    "Can Add Machine": entry.canAddMachine ? "Yes" : "No",
    "Can Edit Machine": entry.canEditMachine ? "Yes" : "No",
  };
}

async function createUser(db: Database, input: Row): Promise<AdminResult> {
  const email = clean(input["Login Email"], 200);
  const userId = clean(input["User ID"], 100);
  if (!email && !userId) {
    return { success: false, message: "User ID or Login Email is required.", status: 400 };
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return { success: false, message: "Enter a valid email address.", status: 400 };
  }
  if (email && db.users.some((u) => normalize(u["Login Email"]) === normalize(email))) {
    return { success: false, message: `${email} already exists.`, status: 400 };
  }
  if (userId && db.users.some((u) => normalize(u["User ID"]) === normalize(userId))) {
    return { success: false, message: `User ID ${userId} already exists.`, status: 400 };
  }
  if (!String(input["__password"] ?? "").trim()) {
    return { success: false, message: "Set a password for the new user.", status: 400 };
  }

  const sheet = sheetPart(input);
  const entry = accessPart(input);
  if (typeof sheet === "string") return { success: false, message: sheet, status: 400 };
  if (typeof entry === "string") return { success: false, message: entry, status: 400 };

  const finalEmail = email || "";
  const newUserRec: UserRecord = {
    ...sheet,
    "Login Email": finalEmail,
    "User ID": userId,
  } as UserRecord;

  // Process assigned machines if provided
  const rawAssignedMachines = (input as any).assignedMachines !== undefined
    ? (input as any).assignedMachines
    : input["Assigned Machines"];
  if (rawAssignedMachines !== undefined) {
    const machineIds = Array.isArray(rawAssignedMachines)
      ? rawAssignedMachines.map((m: any) => String(m).trim()).filter(Boolean)
      : String(rawAssignedMachines || "").split(",").map((s) => s.trim()).filter(Boolean);

    // Validate machine existence
    for (const mId of machineIds) {
      const exists = (db.machines || []).some(
        (m) => normalize(m["Asset ID"]) === normalize(mId) || normalize(m["Machine Name"]) === normalize(mId)
      );
      if (!exists) {
        return { success: false, message: `No machine found with Asset ID or Name "${mId}".`, status: 400 };
      }
    }

    newUserRec.assignedMachines = machineIds;
    newUserRec["Assigned Machines"] = machineIds.join(", ");
  }

  db.users.push(newUserRec);
  await writeDb(db);

  // Sync bidirectional links to machines
  if (newUserRec.assignedMachines && newUserRec.assignedMachines.length > 0) {
    await syncUserAssignedMachines(userId || finalEmail, newUserRec.assignedMachines, "System Administrator").catch((e) =>
      console.warn("Could not sync assigned machines for new user", e)
    );
  }

  const access = await readAccess();
  if (finalEmail) access[emailKey(finalEmail)] = entry;
  if (userId) access[emailKey(userId)] = entry;
  await writeAccess(access);
  return { success: true, message: `User ${userId || finalEmail} created.`, status: 201 };
}

async function updateUser(
  db: Database,
  index: number,
  input: Row,
  actorEmail: string
): Promise<AdminResult> {
  const existing = db.users[index];
  const access = await readAccess();

  const sheet = sheetPart(input, existing);
  if (typeof sheet === "string") return { success: false, message: sheet, status: 400 };

  // Allow filling in Login Email or User ID if missing
  if (!existing["Login Email"]) {
    const proposed = clean(input["Login Email"], 200);
    if (proposed) {
      if (!EMAIL_PATTERN.test(proposed)) {
        return { success: false, message: "Enter a valid email address.", status: 400 };
      }
      if (db.users.some((u) => normalize(u["Login Email"]) === normalize(proposed))) {
        return { success: false, message: `${proposed} already exists.`, status: 400 };
      }
      sheet["Login Email"] = proposed;
    }
  }
  const email = sheet["Login Email"] ?? existing["Login Email"];
  const userId = sheet["User ID"] ?? existing["User ID"];
  const key = emailKey(email || userId || "");

  const wantsLogin = Boolean(String(input["__password"] ?? "").trim()) || normalize(input["App Access"]) === "admin";
  if (!key && wantsLogin) {
    return { success: false, message: "Enter a Login Email or User ID for this user first; logins are tied to it.", status: 400 };
  }

  const existingEntry = (email ? access[emailKey(email)] : undefined) ?? (userId ? access[emailKey(userId)] : undefined);
  const entry = accessPart(input, existingEntry);
  if (typeof entry === "string") return { success: false, message: entry, status: 400 };

  const updated = withAccess({ ...existing, ...sheet } as UserRecord, entry);
  const isSelf = Boolean(email) && emailKey(email) === emailKey(actorEmail);

  if (isSelf && !isAdminUser(updated)) {
    return { success: false, message: "You can't remove your own admin access or deactivate yourself.", status: 400 };
  }

  const next = db.users.map((u, i) => (i === index ? updated : u));
  if (!hasUsableAdmin(next)) {
    return { success: false, message: "There must be at least one active admin with a password.", status: 400 };
  }

  // Handle assigned machines sync if passed
  const rawAssignedMachines = (input as any).assignedMachines !== undefined
    ? (input as any).assignedMachines
    : input["Assigned Machines"];
  if (rawAssignedMachines !== undefined) {
    const machineIds = Array.isArray(rawAssignedMachines)
      ? rawAssignedMachines.map((m: any) => String(m).trim()).filter(Boolean)
      : String(rawAssignedMachines || "").split(",").map((s) => s.trim()).filter(Boolean);

    // Validate machine existence
    for (const mId of machineIds) {
      const exists = (db.machines || []).some(
        (m) => normalize(m["Asset ID"]) === normalize(mId) || normalize(m["Machine Name"]) === normalize(mId)
      );
      if (!exists) {
        return { success: false, message: `No machine found with Asset ID or Name "${mId}".`, status: 400 };
      }
    }

    sheet.assignedMachines = machineIds;
    sheet["Assigned Machines"] = machineIds.join(", ");
    await syncUserAssignedMachines(userId || email, machineIds, actorEmail).catch((e) =>
      console.warn("Could not sync assigned machines for user update", e)
    );
  }

  db.users[index] = { ...existing, ...sheet } as UserRecord;
  await writeDb(db);

  if (email) access[emailKey(email)] = entry;
  if (userId) access[emailKey(userId)] = entry;
  await writeAccess(access);
  return { success: true, message: "User updated successfully.", status: 200 };
}
