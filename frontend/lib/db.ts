import crypto from "crypto";
import { emailKey, readAccess, writeAccess, type AccessMap } from "./access";
import { DATA_DIR } from "./config";
import { ensureNotificationScheduler } from "./notifyBoot";
import { hashPassword } from "./password";
import {
  PERMISSIONS,
  type Database,
  type Machine,
  type MaintenanceRecord,
  type Permission,
  type SafetyRecord,
  type TableId,
  type UserRecord,
} from "./types";

export { DATA_DIR };

// State lives on globalThis so every route bundle shares one lock.
interface DbState {
  lock: Promise<unknown>;
  seeding?: Promise<void>;
}
const globalState = globalThis as unknown as { __skylineDb?: DbState };
const state: DbState = (globalState.__skylineDb ??= { lock: Promise.resolve() });
/**
 * Serializes every read-modify-write in this server so two simultaneous
 * requests can't overwrite each other. Each locked task starts from a fresh
 * read of the workbook (people may have edited it directly in Excel).
 */

export function withDbLock<T>(task: () => Promise<T>): Promise<T> {
  const run = state.lock.then(task, task);
  state.lock = run.catch(() => undefined);
  return run;
}

export function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function mergeAccess(users: UserRecord[], access: AccessMap): void {
  for (const user of users) {
    const emailK = emailKey(user["Login Email"]);
    const idK = emailKey(user["User ID"] ?? "");
    const entry = (emailK ? access[emailK] : undefined) ?? (idK ? access[idK] : undefined);
    user["App Access"] = entry?.accessLevel ?? "User";
    user["Password Hash"] = entry?.passwordHash ?? "";
    user["Display Password"] = entry?.displayPassword ?? (entry?.passwordHash ? "••••••••" : "");
    user["Can Add Machine"] = entry?.canAddMachine ? "Yes" : "No";
    user["Can Edit Machine"] = entry?.canEditMachine ? "Yes" : "No";
  }
}

/** Unique record row identifier. */
export function rowNumberOf(row: unknown): number | undefined {
  const n = (row as { __row?: unknown })?.__row;
  return typeof n === "number" ? n : undefined;
}

import { getMongoDb } from "./mongodb";

const DEFAULT_CHECKLISTS: Array<Record<string, string>> = [];
const DEFAULT_PM_PARTS: Array<Record<string, string>> = [];
const DEFAULT_DOCUMENTS: Array<Record<string, string>> = [];

async function loadJsonFallback(): Promise<Database> {
  const fs = await import("fs");
  const path = await import("path");
  const access = await readAccess();
  const possiblePaths = [
    path.join(DATA_DIR, "db.json"),
    path.join(process.cwd(), "data", "db.json"),
    path.join(process.cwd(), "..", "data", "db.json"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
        const machines = (raw.machines || []) as Machine[];
        const users = (raw.users || []) as UserRecord[];
        const maintenanceRecords = (raw.maintenanceRecords || []) as MaintenanceRecord[];
        const safetyRecords = (raw.safetyRecords || []) as SafetyRecord[];
        const checklists = (raw.checklists && raw.checklists.length > 0 ? raw.checklists : raw.checklistMaster || DEFAULT_CHECKLISTS) as Array<Record<string, string>>;
        const pmParts = (raw.pmParts && raw.pmParts.length > 0 ? raw.pmParts : DEFAULT_PM_PARTS) as Array<Record<string, string>>;
        const documentRegister = (raw.documentRegister && raw.documentRegister.length > 0 ? raw.documentRegister : DEFAULT_DOCUMENTS) as Array<Record<string, string>>;
        mergeAccess(users, access);
        return { machines, users, maintenanceRecords, safetyRecords, checklists, pmParts, documentRegister };
      } catch { }
    }
  }

  return { machines: [], users: [], maintenanceRecords: [], safetyRecords: [], checklists: DEFAULT_CHECKLISTS, pmParts: DEFAULT_PM_PARTS, documentRegister: DEFAULT_DOCUMENTS };
}

/**
 * Read all data directly from MongoDB Atlas (Skyline_Project_Engineers database) with resilient fallback.
 */
export async function readDb(): Promise<Database> {
  ensureNotificationScheduler();
  let mongoDb;
  try {
    mongoDb = await Promise.race([
      getMongoDb(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MongoDB connection timeout after 8s")), 8000)
      ),
    ]);
  } catch (err) {
    console.warn("[Database] MongoDB Atlas connection unreachable, loading local data store:", (err as Error)?.message);
  }

  if (mongoDb) {
    try {
      const queryPromise = Promise.all([
        mongoDb.collection("machines").find({}).toArray().catch(() => []),
        mongoDb.collection("users").find({}).toArray().catch(() => []),
        mongoDb.collection("maintenance_records").find({}).toArray().catch(() => []),
        mongoDb.collection("safety_records").find({}).toArray().catch(() => []),
        mongoDb.collection("checklist_master").find({}).toArray().catch(() => mongoDb.collection("checklists").find({}).toArray().catch(() => [])),
        mongoDb.collection("spare_parts").find({}).toArray().catch(() => mongoDb.collection("pm_parts").find({}).toArray().catch(() => [])),
        mongoDb.collection("documents").find({}).toArray().catch(() => mongoDb.collection("document_register").find({}).toArray().catch(() => [])),
        mongoDb.collection("notifications").find({}).toArray().catch(() => []),
      ]);

      const [machines, users, maintenanceRecords, safetyRecords, mongoChecklists, mongoPmParts, mongoDocs, mongoNotifs] = await Promise.race([
        queryPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("MongoDB query timeout after 8s")), 8000)
        ),
      ]);

      const access = await readAccess();
      const fallbackDb = await loadJsonFallback();

      let cleanMachines = machines.map((m) => {
        const { _id, ...rest } = m;
        return rest as unknown as Machine;
      });
      if (cleanMachines.length === 0) cleanMachines = fallbackDb.machines;

      let cleanUsers = users.map((u: any) => {
        const { _id, ...rest } = u;
        const userRec = { ...rest } as UserRecord;
        if (!userRec["Login Email"]) {
          userRec["Login Email"] = u["Login Email"] || u.email || u.Email || u.loginEmail || "";
        }
        if (!userRec["User ID"]) {
          userRec["User ID"] = u["User ID"] || u.userId || u.username || u.Username || "";
        }
        if (!userRec.Name) {
          userRec.Name = u.Name || u.name || u["Full Name"] || u.fullName || "";
        }
        if (!userRec.Role) {
          userRec.Role = u.Role || u.role || u.designation || "User";
        }
        if (!userRec.Active) {
          const activeStatus = u.Active || u.active || u.status || "Yes";
          userRec.Active = String(activeStatus).toLowerCase().includes("inact") ? "No" : "Yes";
        }
        if (!userRec["Password Hash"]) {
          userRec["Password Hash"] =
            u["Password Hash"] ||
            u.passwordHash ||
            u.password ||
            u["Password"] ||
            u["Password (Encrypted)"] ||
            "";
        }
        if (!userRec["Department / Machine"]) {
          userRec["Department / Machine"] =
            u["Department / Machine"] || u.department || u.departmentMachine || u["Department"] || "";
        }
        return userRec;
      });
      if (cleanUsers.length === 0) cleanUsers = fallbackDb.users;

      let cleanMaintenance = maintenanceRecords.map((m) => {
        const { _id, ...rest } = m;
        return rest as unknown as MaintenanceRecord;
      });
      if (cleanMaintenance.length === 0) cleanMaintenance = fallbackDb.maintenanceRecords;

      let cleanSafety = safetyRecords.map((s) => {
        const { _id, ...rest } = s;
        return rest as unknown as SafetyRecord;
      });
      if (cleanSafety.length === 0) cleanSafety = fallbackDb.safetyRecords;

      let cleanChecklists = (mongoChecklists || []).map((item: any) => {
        const { _id, ...rest } = item;
        const c = { ...rest } as Record<string, string>;
        if (!c["Asset ID / Machine"]) {
          c["Asset ID / Machine"] = c["Machine / Asset"] || c["Asset ID"] || c["Machine"] || c["Checklist ID"] || c["assetId"] || "";
        }
        if (!c["Check Point"]) {
          c["Check Point"] = c["Check Point / Task"] || c["checkPoint"] || c["Task"] || "";
        }
        if (!c["Status"]) {
          c["Status"] = c["status"] || "Active";
        }
        if (!c["Remarks / Value"]) {
          c["Remarks / Value"] = c["Standard Parameter"] || c["Remarks"] || c["remarks"] || c["Frequency"] || "";
        }
        if (!c["Shift / Date"]) {
          c["Shift / Date"] = c["Created Date"] || c["Date"] || c["date"] || "Today";
        }
        return c;
      });
      if (cleanChecklists.length === 0) cleanChecklists = fallbackDb.checklists ?? DEFAULT_CHECKLISTS;

      let cleanPmParts = (mongoPmParts || []).map((item: any) => {
        const { _id, ...rest } = item;
        const p = { ...rest } as Record<string, string>;
        if (!p["Item / Part ID"]) {
          p["Item / Part ID"] = p["Part ID"] || p["Part Name / Code"] || p["partId"] || "";
        }
        if (!p["Part Name"]) {
          p["Part Name"] = p["Part Name / Code"] || p["partName"] || "";
        }
        if (!p["Machine / Asset"]) {
          p["Machine / Asset"] = p["Machine Model"] || p["Machine / Category"] || p["Machine"] || "";
        }
        if (!p["Vendor / AMC"]) {
          p["Vendor / AMC"] = p["Supplier Name"] || p["AMC Provider"] || p["vendor"] || "Internal";
        }
        if (!p["Quantity"]) {
          p["Quantity"] = p["Stock Quantity"] || p["stock"] || "1";
        }
        if (!p["Expiry / Due Date"]) {
          p["Expiry / Due Date"] = p["AMC Expiry"] || p["dueDate"] || "N/A";
        }
        return p;
      });
      if (cleanPmParts.length === 0) cleanPmParts = fallbackDb.pmParts ?? DEFAULT_PM_PARTS;

      let cleanDocs = (mongoDocs || []).map((item: any) => { const { _id, ...rest } = item; return rest as unknown as Record<string, string>; });
      if (cleanDocs.length === 0) cleanDocs = fallbackDb.documentRegister ?? DEFAULT_DOCUMENTS;

      let cleanNotifs = (mongoNotifs || []).map((item: any) => {
        const { _id, ...rest } = item;
        const n = { ...rest } as Record<string, string>;
        if (!n["Alert ID"]) n["Alert ID"] = n["Notification ID"] || n["alertId"] || "";
        if (!n["Alert Title"]) n["Alert Title"] = n["Title"] || n["title"] || n["Message"] || "";
        if (!n["Severity"]) n["Severity"] = n["Priority"] || n["severity"] || "Warning";
        if (!n["Source / Machine"]) n["Source / Machine"] = n["Target Department"] || n["machineName"] || n["source"] || "System";
        if (!n["Date & Time"]) n["Date & Time"] = n["Date"] || n["timestamp"] || n["date"] || "Today";
        return n;
      });
      if (cleanNotifs.length === 0) cleanNotifs = fallbackDb.notifications ?? [];

      mergeAccess(cleanUsers, access);

      return {
        machines: cleanMachines,
        users: cleanUsers,
        maintenanceRecords: cleanMaintenance,
        safetyRecords: cleanSafety,
        checklists: cleanChecklists,
        pmParts: cleanPmParts,
        documentRegister: cleanDocs,
        notifications: cleanNotifs,
      };
    } catch (queryErr) {
      console.warn("[Database Error] MongoDB Atlas query error, loading fallback:", (queryErr as Error)?.message);
    }
  }

  return loadJsonFallback();
}

/**
 * Sanitize object keys for MongoDB operations to prevent dot-notation errors
 * (e.g. "Serial No." causes "The update path 'Serial No.' contains an empty field name").
 */
export function sanitizeMongoDoc<T extends Record<string, any>>(doc: T): T {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return doc;
  const cleanDoc: Record<string, any> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "_id") {
      cleanDoc[key] = value;
      continue;
    }
    // Replace trailing dot or internal dots in field keys for MongoDB field path safety
    const safeKey = key.replace(/\.+$/, "").replace(/\./g, " ");
    cleanDoc[safeKey] = value;
  }
  return cleanDoc as T;
}

/**
 * Save and synchronize all changes directly into MongoDB Atlas collections.
 */
export async function writeDb(
  db: Database,
  _opts: { createMissingTabs?: boolean } = {}
): Promise<void> {
  // Update local JSON cache immediately
  try {
    const fs = await import("fs");
    const path = await import("path");
    const savePaths = [
      path.join(DATA_DIR, "db.json"),
      path.join(process.cwd(), "data", "db.json"),
    ];
    for (const p of savePaths) {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) {
        const toSave = {
          machines: db.machines,
          users: db.users,
          maintenanceRecords: db.maintenanceRecords,
          safetyRecords: db.safetyRecords,
          checklists: db.checklists,
          pmParts: db.pmParts,
          documentRegister: db.documentRegister,
        };
        fs.writeFileSync(p, JSON.stringify(toSave, null, 2), "utf8");
      }
    }
  } catch { }

  let mongoDb;
  try {
    mongoDb = await getMongoDb();
  } catch (err) {
    console.warn("[writeDb] MongoDB Atlas offline, changes saved locally:", (err as Error)?.message);
    return;
  }

  // 1. Machines collection
  if (db.machines?.length) {
    for (const m of db.machines) {
      if (m["Asset ID"]) {
        const safeM = sanitizeMongoDoc(m);
        await mongoDb.collection("machines").updateOne(
          { "Asset ID": m["Asset ID"] },
          { $set: safeM },
          { upsert: true }
        );
      }
    }
  }

  // 2. Users collection (Single clean User ID and Login Email fields, no duplicate keys)
  if (db.users?.length) {
    for (const u of db.users) {
      const email = String(u["Login Email"] || (u as any).email || "").trim();
      const userId = String(u["User ID"] || (u as any).userId || (u as any).username || "").trim();

      const { _id, userId: _d1, username: _d2, email: _d3, ...rest } = u as any;

      const userDoc: Record<string, any> = {
        ...rest,
        "User ID": userId,
        "Login Email": email,
      };

      const filterConditions = [];
      if (userId) {
        filterConditions.push({ "User ID": userId }, { userId: userId });
      }
      if (email) {
        filterConditions.push({ "Login Email": email }, { email: email });
      }

      if (filterConditions.length > 0) {
        await mongoDb.collection("users").updateOne(
          { $or: filterConditions },
          {
            $set: userDoc,
            $unset: { userId: "", username: "", email: "" }
          },
          { upsert: true }
        );
      }
    }
  }

  // 3. Maintenance records collection
  if (db.maintenanceRecords?.length) {
    for (const mr of db.maintenanceRecords) {
      const recId = mr.recordId || (mr as unknown as Record<string, string>)["Record ID"];
      if (recId) {
        await mongoDb.collection("maintenance_records").updateOne(
          { recordId: recId },
          { $set: mr },
          { upsert: true }
        );
      }
    }
  }

  // 4. Safety records collection
  if (db.safetyRecords?.length) {
    for (const sr of db.safetyRecords) {
      const recId =
        sr.recordId ||
        (sr as unknown as Record<string, string>)["Record ID"] ||
        (sr as unknown as Record<string, string>)["Safety Record ID"];
      if (recId) {
        await mongoDb.collection("safety_records").updateOne(
          { recordId: recId },
          { $set: sr },
          { upsert: true }
        );
      }
    }
  }

  // 5. PM Parts / Spare Parts collection
  const rawDb = db as any;
  if (rawDb.pmParts?.length) {
    for (const p of rawDb.pmParts) {
      const partId = p["Part ID"] || p["Item / Part ID"] || p["partId"] || p["Part Name / Code"];
      if (partId) {
        await mongoDb.collection("spare_parts").updateOne(
          { $or: [{ "Part ID": partId }, { "Part Name / Code": partId }, { partId: partId }] },
          { $set: p },
          { upsert: true }
        );
      }
    }
  }

  // 6. Checklist Master collection
  if (rawDb.checklists?.length) {
    for (const c of rawDb.checklists) {
      const key = c["Template ID"] || c["Check Point"] || c["Check Point / Task"];
      if (key) {
        await mongoDb.collection("checklist_master").updateOne(
          { $or: [{ "Template ID": key }, { "Check Point": key }, { "Check Point / Task": key }] },
          { $set: c },
          { upsert: true }
        );
      }
    }
  }

  // 7. Documents Register collection
  if (rawDb.documentRegister?.length) {
    for (const d of rawDb.documentRegister) {
      const docId = d["Doc ID"] || d["Document Title"] || d["docId"];
      if (docId) {
        await mongoDb.collection("documents").updateOne(
          { $or: [{ "Doc ID": docId }, { "Document Title": docId }] },
          { $set: d },
          { upsert: true }
        );
      }
    }
  }

  // 8. Notifications & Alerts collection
  if (rawDb.notifications?.length) {
    for (const n of rawDb.notifications) {
      const notifId = n["Alert ID"] || n["Notification ID"] || n["alertId"];
      if (notifId) {
        await mongoDb.collection("notifications").updateOne(
          { $or: [{ "Alert ID": notifId }, { "Notification ID": notifId }] },
          { $set: n },
          { upsert: true }
        );
      }
    }
  }
}

/**
 * Delete a specific record from MongoDB Atlas database and local memory.
 */
export async function deleteRecordFromDb(
  colName: string,
  identifier: string | Record<string, any>
): Promise<boolean> {
  try {
    const mongoDb = await getMongoDb();
    if (typeof identifier === "string") {
      const filter: Record<string, any> = {
        $or: [
          { "Asset ID": identifier },
          { "User ID": identifier },
          { "Login Email": identifier },
          { recordId: identifier },
          { "Record ID": identifier },
          { "Safety Record ID": identifier },
          { "Part ID": identifier },
          { "Item / Part ID": identifier },
          { "Part Name / Code": identifier },
          { "Template ID": identifier },
          { "Check Point": identifier },
          { "Doc ID": identifier },
          { "Document Title": identifier },
          { "Alert ID": identifier },
          { "Notification ID": identifier },
          { "Training ID": identifier },
          { "Employee ID": identifier },
          { "HIRA ID": identifier },
          { "Audit ID": identifier },
          { "Breakdown Ticket": identifier },
          { "Equipment ID": identifier },
          { "Item ID": identifier },
          { "Log ID": identifier },
          { complianceId: identifier },
          { id: identifier },
        ]
      };
      await mongoDb.collection(colName).deleteOne(filter);
    } else if (identifier && typeof identifier === "object") {
      await mongoDb.collection(colName).deleteOne(identifier);
    }
    return true;
  } catch (err) {
    console.error(`[deleteRecordFromDb] Error deleting from ${colName}:`, err);
    return false;
  }
}

// --------------------------------------------------------------- admin bootstrap

/**
 * First login when setting up the initial admin. If ADMIN_EMAIL and
 * ADMIN_PASSWORD are set and the person logging in matches them, make them an
 * Admin with that password (adding them to MongoDB users if not present).
 */
export async function bootstrapAdmin(email: string, password: string): Promise<UserRecord | null> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return null;
  if (normalize(email) !== normalize(adminEmail)) return null;

  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return withDbLock(async () => {
    const db = await readDb();
    const access = await readAccess();
    const key = emailKey(adminEmail);
    if (access[key]?.passwordHash) return null;

    let user = db.users.find((u) => normalize(u["Login Email"]) === key);
    if (!user) {
      user = {
        "User ID": "ADM-001",
        Name: "Administrator",
        Role: "Admin",
        Active: "Yes",
        "Login Email": adminEmail,
        "Can Submit Maintenance": "Yes",
        "Can Submit Safety": "Yes",
        "Can Approve Close": "Yes",
      } as UserRecord;
      db.users.push(user);
      await writeDb(db);
    } else if (normalize(user.Active) !== "yes") {
      // The named admin must be able to log in.
      user.Active = "Yes";
      await writeDb(db);
    }

    access[key] = {
      accessLevel: "Admin",
      passwordHash: hashPassword(adminPassword),
      canAddMachine: true,
      canEditMachine: true,
    };
    await writeAccess(access);

    return { ...user, "App Access": "Admin", "Password Hash": access[key].passwordHash } as UserRecord;
  });
}

/** Mirrors findMachineByAssetId() from Code.gs */
export async function findMachineByAssetId(
  assetId: string
): Promise<{ success: boolean; machine?: Machine; message?: string }> {
  if (!assetId) {
    return { success: false, message: "Please enter an Asset ID." };
  }

  const db = await readDb();
  const search = normalize(assetId);

  const machine = db.machines.find(
    (m) => normalize(m["Asset ID"]) === search
  );

  if (!machine) {
    return { success: false, message: "Machine not found: " + assetId };
  }

  return { success: true, machine };
}

/** Mirrors checkUserAuthorization() from Code.gs */
export async function checkUserAuthorization(
  email: string,
  permissionColumn: Permission
): Promise<{ authorized: boolean; message: string }> {
  const normalizedEmail = normalize(email);

  if (!normalizedEmail) {
    return {
      authorized: false,
      message: "Please sign in with your authorized email to continue.",
    };
  }

  const db = await readDb();

  const user = db.users.find(
    (u) => normalize(u["Login Email"]) === normalizedEmail
  );

  if (user && userHasPermission(user, permissionColumn)) {
    return { authorized: true, message: "User authorized successfully." };
  }

  return {
    authorized: false,
    message:
      "You are not authorized for this activity. Please contact your administrator.",
  };
}

/** An Admin is set in the app's login file ("App Access"), by User ID (ADM-...), or by Role. */
export function isAdminUser(user: UserRecord): boolean {
  if (normalize(user.Active) !== "yes") return false;
  const appAccess = normalize(user["App Access"]);
  const role = normalize(user.Role);
  const uid = normalize(user["User ID"]);
  const email = normalize(user["Login Email"]);

  return (
    appAccess === "admin" ||
    role === "admin" ||
    uid === "adm-001" ||
    uid.startsWith("adm-") ||
    email === "mrsatishpatil105@gmail.com" ||
    email.startsWith("admin@")
  );
}

/** Admins can do everything; other users need the matching Yes flag. */
export function userHasPermission(user: UserRecord, permission: Permission): boolean {
  if (normalize(user.Active) !== "yes") return false;
  if (isAdminUser(user)) return true;
  return normalize(user[permission]) === "yes";
}

export function permissionsFor(user: UserRecord): Permission[] {
  return PERMISSIONS.filter((p) => userHasPermission(user, p));
}

/**
 * Find a person by what they typed on the login page: their work email, or
 * their User ID from the User Master tab (e.g. "OP-001"). A User ID that
 * appears on more than one row is refused rather than guessed.
 */
export async function findUserByLogin(identifier: string): Promise<UserRecord | null> {
  const wanted = normalize(identifier);
  if (!wanted) return null;
  const db = await readDb();

  // 1. If identifier contains '@', prioritize matching Login Email / email field
  if (wanted.includes("@")) {
    const byEmail = db.users.find(
      (u: any) =>
        normalize(u["Login Email"]) === wanted ||
        normalize(u.email) === wanted ||
        normalize(u.loginEmail) === wanted
    );
    if (byEmail) return byEmail;
  }

  // 2. Direct match on User ID / userId / username (distinct from email)
  const byUserId = db.users.find(
    (u: any) =>
      (u["User ID"] && normalize(u["User ID"]) === wanted) ||
      (u.userId && normalize(u.userId) === wanted) ||
      (u.username && normalize(u.username) === wanted)
  );
  if (byUserId) return byUserId;

  // 3. Match on Login Email or Name
  const byLoginEmail = db.users.find(
    (u: any) =>
      (u["Login Email"] && normalize(u["Login Email"]) === wanted) ||
      (u.email && normalize(u.email) === wanted) ||
      (u.Name && normalize(u.Name) === wanted)
  );
  if (byLoginEmail) return byLoginEmail;

  // 4. Role alias match (e.g. typing "supervisor", "admin", "operator")
  if (wanted === "supervisor" || wanted === "sp") {
    const sp = db.users.find(
      (u: any) =>
        normalize(u["User ID"]) === "sp-001" ||
        normalize(u.Role) === "supervisor" ||
        normalize(u["App Access"]) === "supervisor"
    );
    if (sp) return sp;
  }
  if (wanted === "admin" || wanted === "adm") {
    const adm = db.users.find(
      (u: any) =>
        normalize(u["User ID"]) === "adm-001" ||
        normalize(u.Role) === "admin" ||
        normalize(u["App Access"]) === "admin"
    );
    if (adm) return adm;
  }
  if (wanted === "operator" || wanted === "op") {
    const op = db.users.find(
      (u: any) =>
        normalize(u["User ID"]) === "op-001" ||
        normalize(u.Role) === "operator"
    );
    if (op) return op;
  }

  return null;
}

export async function findUserByEmail(emailOrUserId: string): Promise<UserRecord | null> {
  const wanted = normalize(emailOrUserId);
  if (!wanted) return null;
  const db = await readDb();
  return (
    db.users.find(
      (u: any) =>
        normalize(u["Login Email"]) === wanted ||
        normalize(u.email) === wanted ||
        (u["User ID"] && normalize(u["User ID"]) === wanted) ||
        (u.userId && normalize(u.userId) === wanted) ||
        (u.username && normalize(u.username) === wanted)
    ) ?? null
  );
}

/** Mirrors createRecordId() from Code.gs */
export function createRecordId(prefix: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  const stamp =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    "-" +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());

  return `${prefix}-${stamp}`;
}

/**
 * Build the Remarks cell: one "Label: value" line each. Entries flagged
 * `always` are written even when empty (the original app always wrote its
 * first three lines); the others only when they have a value.
 */
export function remarksBlock(entries: [label: string, value: string | undefined, always?: boolean][]): string {
  return entries
    .filter(([, value, always]) => always || String(value ?? "").trim())
    .map(([label, value]) => `${label}: ${String(value ?? "").trim()}`)
    .join("\n");
}

/** createRecordId, but never collides with an existing record (same-second saves). */
export function uniqueRecordId(prefix: string, existingIds: string[]): string {
  const taken = new Set(existingIds.map(normalize));
  const base = createRecordId(prefix);
  let id = base;
  for (let n = 2; taken.has(normalize(id)); n++) id = `${base}-${n}`;
  return id;
}

export interface MaintenanceInput {
  assetId: string;
  machineName: string;
  maintenanceType: string;
  maintenanceDate: string;
  userId: string;
  userName: string;
  assignedTo: string;
  technicianName: string;
  priority: string;
  status: string;
  checklistId: string;
  checkPoint: string;
  problem: string;
  rootCause: string;
  correctiveAction: string;
  spareParts: string;
  downtime: string;
  photoEvidence: string;
  remarks: string;
  submittedBy: string;
}

/** Mirrors saveMaintenanceRecord() from Code.gs */
export function saveMaintenanceRecord(input: MaintenanceInput) {
  return withDbLock(() => saveMaintenanceRecordUnlocked(input));
}

async function saveMaintenanceRecordUnlocked(
  input: MaintenanceInput
): Promise<{ success: boolean; message: string; recordId?: string }> {
  const db = await readDb();
  const now = new Date().toISOString();

  const normalizedStatus = normalize(input.status);
  const result: string = normalizedStatus === "completed" ? "Completed" : "Pending";

  const completionDate =
    normalizedStatus === "completed"
      ? input.maintenanceDate || now
      : "";

  const recordId = uniqueRecordId(
    "MNT",
    db.maintenanceRecords.map((r) => r.recordId)
  );

  const record: MaintenanceRecord = {
    recordId,
    recordType: input.maintenanceType || "Maintenance",
    date: input.maintenanceDate || "",
    assetId: input.assetId || "",
    machineName: input.machineName || "",
    userId: input.userId || "",
    userName: input.userName || "",
    submittedBy: input.submittedBy || "System User",
    checklistId: input.checklistId || "MNT-GENERAL",
    checkPoint: input.checkPoint || "Maintenance Inspection",
    result,
    problem: input.problem || "",
    rootCause: input.rootCause || "",
    priority: input.priority || "Medium",
    assignedTo: input.assignedTo || "",
    technicianName: input.technicianName || "",
    status: input.status || "Open",
    correctiveAction: input.correctiveAction || "",
    spareParts: input.spareParts || "",
    downtime: input.downtime || "",
    completionDate,
    photoEvidence: input.photoEvidence || "",
    // The sheet has no columns for these, so (like the original app) they go
    // into Remarks as a block of lines.
    remarks: remarksBlock([
      ["Root Cause", input.rootCause, true],
      ["Spare Parts Used", input.spareParts, true],
      ["Downtime (Hours)", input.downtime, true],
      ["Technician", input.technicianName],
      ["Remarks", input.remarks],
      ["Submitted By", input.submittedBy],
    ]),
    createdAt: now,
    lastUpdated: now,
    closedBy:
      normalizedStatus === "completed"
        ? input.userName || input.assignedTo || input.submittedBy || ""
        : "",
  };

  db.maintenanceRecords.push(record);
  await writeDb(db);

  return {
    success: true,
    message: "Maintenance record saved successfully.\nRecord ID: " + recordId,
    recordId,
  };
}

export interface SafetyInput {
  observation: string;
  assetId: string;
  machineName: string;
  userId: string;
  userName: string;
  inspector: string;
  inspectionType: string;
  result: string;
  riskLevel: string;
  immediateAction: string;
  assignedTo: string;
  targetDate: string;
  status: string;
  correctiveAction: string;
  photoEvidence: string;
  remarks: string;
  submittedBy: string;
}

/** Mirrors saveSafetyRecord() from Code.gs */
export function saveSafetyRecord(input: SafetyInput) {
  return withDbLock(() => saveSafetyRecordUnlocked(input));
}

async function saveSafetyRecordUnlocked(
  input: SafetyInput
): Promise<{ success: boolean; message: string; recordId?: string }> {
  const db = await readDb();
  const now = new Date().toISOString();
  const normalizedStatus = normalize(input.status);

  const recordId = uniqueRecordId(
    "SAF",
    db.safetyRecords.map((r) => r.recordId)
  );

  const record: SafetyRecord = {
    recordId,
    date: now.slice(0, 10),
    assetId: input.assetId || "",
    machineName: input.machineName || "",
    userId: input.userId || "",
    userName: input.userName || input.inspector || "",
    submittedBy: input.submittedBy || "System User",
    safetyType: input.inspectionType || "",
    observation: input.observation || "",
    inspector: input.inspector || "",
    result: input.result || "",
    riskLevel: input.riskLevel || "",
    immediateAction: input.immediateAction || "",
    assignedTo: input.assignedTo || "",
    targetDate: input.targetDate || "",
    status: input.status || "",
    correctiveAction: input.correctiveAction || "",
    photoEvidence: input.photoEvidence || "",
    // No Inspector / Result columns in the sheet: keep them in Remarks.
    remarks: remarksBlock([
      ["Inspection Result", input.result],
      ["Inspector", input.inspector],
      ["Remarks", input.remarks],
      ["Submitted By", input.submittedBy],
    ]),
    createdAt: now,
    lastUpdated: now,
    closedBy:
      normalizedStatus === "closed" || normalizedStatus === "completed"
        ? input.userName || input.assignedTo || input.submittedBy || ""
        : "",
  };

  db.safetyRecords.push(record);
  await writeDb(db);

  return {
    success: true,
    message: "Safety record saved successfully.\nRecord ID: " + recordId,
    recordId,
  };
}

export const ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;

const MACHINE_FIELDS: (keyof Machine)[] = [
  "Machine Name",
  "Category",
  "Department",
  "Location",
  "Make",
  "Model",
  "Serial No.",
  "Criticality",
  "Responsible Person",
  "Status",
  "PM Frequency",
  "AMC Vendor",
  "AMC Contact",
  "AMC Expiry",
  "Installation Date",
];

/** Next free "SKY-MC-###" ID, used when the user leaves Asset ID blank. */
function generateAssetId(existing: Machine[]): string {
  const taken = new Set(existing.map((m) => normalize(m["Asset ID"])));
  let n = existing.length + 1;
  let id = "";
  do {
    id = `SKY-MC-${String(n).padStart(3, "0")}`;
    n++;
  } while (taken.has(normalize(id)));
  return id;
}

/**
 * Register a new machine. The Asset ID is permanent: it is what the machine's
 * QR code points at, so it can never be edited or reused afterwards.
 */
export function addMachine(
  input: Partial<Record<keyof Machine, unknown>>
): Promise<{ success: boolean; message: string; machine?: Machine }> {
  return withDbLock(async () => {
    const clean = (value: unknown) => String(value ?? "").trim().slice(0, 200);

    const machineName = clean(input["Machine Name"]);
    if (!machineName) {
      return { success: false, message: "Machine Name is required." };
    }

    const db = await readDb();
    let assetId = clean(input["Asset ID"]);

    if (assetId) {
      if (!ASSET_ID_PATTERN.test(assetId)) {
        return {
          success: false,
          message:
            "Asset ID may only use letters, numbers, dots, dashes and underscores (2-40 characters).",
        };
      }
      if (db.machines.some((m) => normalize(m["Asset ID"]) === normalize(assetId))) {
        return {
          success: false,
          message: `Asset ID ${assetId} already exists. Each machine needs a unique ID.`,
        };
      }
    } else {
      assetId = generateAssetId(db.machines);
    }

    const machine: Machine = { "Asset ID": assetId, "Machine Name": machineName };
    for (const field of MACHINE_FIELDS) {
      const value = clean(input[field]);
      if (value) {
        (machine as unknown as Record<string, string>)[field] = value;
      }
    }
    if (!machine.Status) machine.Status = "Running";
    machine["Created At"] = machine["Last Updated"] = new Date().toISOString();

    db.machines.push(machine);
    await writeDb(db);

    return {
      success: true,
      message: `Machine added successfully.\nAsset ID: ${assetId}`,
      machine,
    };
  });
}

/** Update an existing machine's details. The Asset ID can never change. */
export function updateMachine(
  assetId: string,
  input: Partial<Record<keyof Machine, unknown>>
): Promise<{ success: boolean; message: string; machine?: Machine }> {
  return withDbLock(async () => {
    const clean = (value: unknown) => String(value ?? "").trim().slice(0, 200);
    const db = await readDb();
    const index = db.machines.findIndex(
      (m) => normalize(m["Asset ID"]) === normalize(assetId)
    );

    if (index === -1) {
      return { success: false, message: "Machine not found: " + assetId };
    }

    // Only the fields that were sent change; a missing name keeps the current one.
    const machineName =
      "Machine Name" in input ? clean(input["Machine Name"]) : clean(db.machines[index]["Machine Name"]);
    if (!machineName) {
      return { success: false, message: "Machine Name is required." };
    }

    // Start from the existing row so extra Excel columns are kept.
    const updated: Machine = { ...db.machines[index], "Machine Name": machineName };
    for (const field of MACHINE_FIELDS) {
      if (field === "Machine Name" || !(field in input)) continue; // only change what was sent
      const value = clean(input[field]);
      if (value) {
        (updated as unknown as Record<string, string>)[field] = value;
      } else {
        delete (updated as unknown as Record<string, string>)[field];
      }
    }

    updated["Last Updated"] = new Date().toISOString();
    db.machines[index] = updated;
    await writeDb(db);

    return {
      success: true,
      message: "Machine details updated successfully.",
      machine: updated,
    };
  });
}

/** Machine plus its most recent maintenance/safety history, for the QR page. */
export async function getMachineProfile(assetId: string) {
  const db = await readDb();
  const search = normalize(assetId);
  const machine =
    db.machines.find((m) => normalize(m["Asset ID"]) === search) ||
    db.machines.find((m) => normalize(m["Machine Name"]) === search) ||
    db.machines.find(
      (m) =>
        normalize(m["Asset ID"]).includes(search) ||
        search.includes(normalize(m["Asset ID"]))
    );
  if (!machine) return null;

  // Sheets filled in by hand may have no "Created At", so fall back to Date.
  const stamp = (r: { createdAt?: string; date?: string }) => r.createdAt || r.date || "";
  const newestFirst = <T extends { createdAt?: string; date?: string }>(a: T, b: T) =>
    stamp(b).localeCompare(stamp(a));

  return {
    machine,
    maintenance: db.maintenanceRecords
      .filter((r) => normalize(r.assetId) === search)
      .sort(newestFirst),
    safety: db.safetyRecords
      .filter((r) => normalize(r.assetId) === search)
      .sort(newestFirst),
  };
}
