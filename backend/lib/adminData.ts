import crypto from "crypto";
import { emailKey, readAccess, writeAccess, type AccessEntry } from "./access";
import {
  ASSET_ID_PATTERN,
  addMachine,
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

type Row = Record<string, string>;

export interface AdminResult {
  success: boolean;
  message: string;
  status?: number;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

/**
 * The columns the admin sees for a table: exactly the ones in the workbook's
 * sheet (in sheet order, including any the app doesn't know about), plus, for
 * users, the app's own login settings. Secrets are never included.
 */
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
  const db = await readDb();
  const rows = (db[table.dbKey] as unknown as Row[]).map((row) => {
    const out: Row = { ...row };
    delete (out as Record<string, unknown>).__row;
    for (const secret of table.secretKeys) delete out[secret];
    // How the dashboard points at this row again when editing/deleting it.
    out["__id"] = `${rowNumberOf(row)}|${rowFingerprint(row, db.columns?.[id] ?? [])}|${row[table.idKey] ?? ""}`;
    if (id === "users") {
      out["Password"] = row["Display Password"] || (row["Password Hash"] ? "••••••••" : "Not set");
      out["Display Password"] = row["Display Password"] || "";
      out["Current Password"] = row["Display Password"] || (row["Password Hash"] ? "••••••••" : "");
    }
    return out;
  });
  return {
    table: id,
    idKey: table.idKey,
    columns: visibleColumns(table, db.columns?.[id] ?? []),
    rows,
  };
}

/** Copy only the editable, defined sheet columns present in `input`. */
function pickColumns(table: TableDef, input: Row): Row {
  const out: Row = {};
  for (const col of table.columns) {
    if (col.key === table.idKey || table.secretKeys.includes(col.key)) continue;
    if (col.key in input) out[col.key] = clean(input[col.key], col.type === "textarea" ? 5000 : 500);
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
  const rows = db[table.dbKey] as unknown as Row[];
  const composite = id.match(/^(\d+)\|([0-9a-f]{8})\|([\s\S]*)$/);

  if (composite) {
    const index = rows.findIndex((r) => rowNumberOf(r) === Number(composite[1]));
    if (
      index === -1 ||
      rowFingerprint(rows[index], db.columns?.[table.id] ?? []) !== composite[2] ||
      normalize(rows[index][table.idKey]) !== normalize(composite[3])
    ) {
      throw new ConflictError();
    }
    return index;
  }
  return rows.findIndex((r) => normalize(r[table.idKey]) === normalize(id));
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

  const table = TABLES[id];

  return withDbLock(async () => {
    const db = await readDb();

    if (id === "users") return createUser(db, input);

    // maintenance / safety records
    const records = db[table.dbKey] as unknown as Row[];
    const assetId = clean(input["assetId"]);
    if (!assetId) return { success: false, message: "Asset ID is required.", status: 400 };
    if (!db.machines.some((m) => normalize(m["Asset ID"]) === normalize(assetId))) {
      return { success: false, message: `No machine with Asset ID ${assetId}.`, status: 400 };
    }

    let recordId = clean(input["recordId"]);
    if (recordId) {
      if (records.some((r) => normalize(r.recordId) === normalize(recordId))) {
        return { success: false, message: `Record ID ${recordId} already exists.`, status: 400 };
      }
    } else {
      recordId = uniqueRecordId(id === "maintenance" ? "MNT" : "SAF", records.map((r) => r.recordId));
    }

    const now = new Date().toISOString();
    const row: Row = { ...pickColumns(table, input), recordId, assetId };
    row.createdAt = row.createdAt || now;
    row.lastUpdated = now;
    if (!row.machineName) {
      row.machineName =
        db.machines.find((m) => normalize(m["Asset ID"]) === normalize(assetId))?.["Machine Name"] ?? "";
    }

    records.push(row);
    await writeDb(db);
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

    const records = db[table.dbKey] as unknown as Row[];
    const changes = pickColumns(table, input);
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
    return { success: true, message: `${cap(table.singular)} updated.`, status: 200 };
  });
}

/** Edit a machine row (works for rows that have no Asset ID yet, e.g. vendor-only stubs). */
async function updateMachineRow(db: Database, index: number, input: Row): Promise<AdminResult> {
  const existing = db.machines[index] as unknown as Row;
  const changes = pickColumns(TABLES.machines, input);

  if ("Machine Name" in changes && !changes["Machine Name"]) {
    return { success: false, message: "Machine Name is required.", status: 400 };
  }

  // The Asset ID is permanent (QR codes use it), except when the row has none yet.
  if (!existing["Asset ID"]) {
    const assetId = clean(input["Asset ID"], 200);
    if (assetId) {
      if (!ASSET_ID_PATTERN.test(assetId)) {
        return { success: false, message: "Asset ID may only use letters, numbers, dots, dashes and underscores (2-40 characters).", status: 400 };
      }
      if (db.machines.some((m) => normalize(m["Asset ID"]) === normalize(assetId))) {
        return { success: false, message: `Asset ID ${assetId} already exists.`, status: 400 };
      }
      changes["Asset ID"] = assetId;
    }
  }

  db.machines[index] = {
    ...existing,
    ...changes,
    "Last Updated": new Date().toISOString(),
  } as unknown as Database["machines"][number];
  await writeDb(db);
  return { success: true, message: "Machine updated.", status: 200 };
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

  const finalEmail = email || (userId ? `${normalize(userId)}@skyline.local` : "");
  db.users.push({ ...sheet, "Login Email": finalEmail, "User ID": userId } as UserRecord);
  await writeDb(db);

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

  db.users[index] = { ...existing, ...sheet } as UserRecord;
  await writeDb(db);

  if (email) access[emailKey(email)] = entry;
  if (userId) access[emailKey(userId)] = entry;
  await writeAccess(access);
  return { success: true, message: "User updated successfully.", status: 200 };
}
