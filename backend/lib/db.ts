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

// ------------------------------------------------------------------ mapping
// The app works with typed rows; the store works with tabs of cell text.
// Each row remembers its sheet row number in "__row" so a save can turn the
// difference into "update row 7" / "add a row" / "delete row 12".

/** Overlay the app's own login settings onto each user row (synced with MongoDB / access map). */
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
        mergeAccess(users, access);
        return { machines, users, maintenanceRecords, safetyRecords };
      } catch {}
    }
  }

  return { machines: [], users: [], maintenanceRecords: [], safetyRecords: [] };
}

/**
 * Read all data directly from MongoDB Atlas (skyms database) with resilient fallback.
 */
export async function readDb(): Promise<Database> {
  ensureNotificationScheduler();
  let mongoDb;
  try {
    mongoDb = await getMongoDb();
  } catch (err) {
    console.warn("[Database] MongoDB Atlas connection unreachable, loading local data store:", (err as Error)?.message);
  }

  if (mongoDb) {
    try {
      const [machines, users, maintenanceRecords, safetyRecords] = await Promise.all([
        mongoDb.collection("machines").find({}).toArray(),
        mongoDb.collection("users").find({}).toArray(),
        mongoDb.collection("maintenance_records").find({}).toArray(),
        mongoDb.collection("safety_records").find({}).toArray(),
      ]);

      if (machines.length > 0 || users.length > 0) {
        const access = await readAccess();
        const cleanMachines = machines.map((m) => {
          const { _id, ...rest } = m;
          return rest as unknown as Machine;
        });
        const cleanUsers = users.map((u: any) => {
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

        const cleanMaintenance = maintenanceRecords.map((m) => {
          const { _id, ...rest } = m;
          return rest as unknown as MaintenanceRecord;
        });
        const cleanSafety = safetyRecords.map((s) => {
          const { _id, ...rest } = s;
          return rest as unknown as SafetyRecord;
        });

        mergeAccess(cleanUsers, access);

        return {
          machines: cleanMachines,
          users: cleanUsers,
          maintenanceRecords: cleanMaintenance,
          safetyRecords: cleanSafety,
        };
      }
    } catch (queryErr) {
      console.warn("[Database] MongoDB Atlas query error, loading fallback:", queryErr);
    }
  }

  return loadJsonFallback();
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
        };
        fs.writeFileSync(p, JSON.stringify(toSave, null, 2), "utf8");
      }
    }
  } catch {}

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
        await mongoDb.collection("machines").updateOne(
          { "Asset ID": m["Asset ID"] },
          { $set: m },
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
  if (!assetId || !String(assetId).trim()) {
    return { success: false, message: "Please enter an Asset ID." };
  }

  const db = await readDb();
  const raw = String(assetId).trim();
  const search = normalize(raw);

  let machine = (db.machines || []).find((m: any) => {
    const aid = normalize(m["Asset ID"] || m.assetId || m["Machine ID"] || m.machineId || m.machineCode || "");
    return aid === search;
  });

  if (!machine) {
    machine = (db.machines || []).find((m: any) => {
      const name = normalize(m["Machine Name"] || m.machineName || m.name || "");
      const qr = normalize(m["QR Link"] || m["QR Legacy Link"] || "");
      const serial = normalize(m["Serial No."] || m["Serial No"] || m.serialNo || "");
      return (
        name === search ||
        serial === search ||
        (qr && (qr === search || qr.endsWith(`/${search}`) || qr.includes(`/machine/${search}`)))
      );
    });
  }

  if (!machine && search.length >= 4) {
    machine = (db.machines || []).find((m: any) => {
      const aid = normalize(m["Asset ID"] || m.assetId || m["Machine ID"] || "");
      return aid && (aid.includes(search) || search.includes(aid));
    });
  }

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
  if (!assetId || !String(assetId).trim()) return null;
  const db = await readDb();
  const raw = String(assetId).trim();
  const search = normalize(raw);

  let machine = (db.machines || []).find((m: any) => {
    const aid = normalize(m["Asset ID"] || m.assetId || m["Machine ID"] || m.machineId || m.machineCode || "");
    return aid === search;
  });

  if (!machine) {
    machine = (db.machines || []).find((m: any) => {
      const name = normalize(m["Machine Name"] || m.machineName || m.name || "");
      const qr = normalize(m["QR Link"] || m["QR Legacy Link"] || "");
      const serial = normalize(m["Serial No."] || m["Serial No"] || m.serialNo || "");
      return (
        name === search ||
        serial === search ||
        (qr && (qr === search || qr.endsWith(`/${search}`) || qr.includes(`/machine/${search}`)))
      );
    });
  }

  if (!machine && search.length >= 4) {
    machine = (db.machines || []).find((m: any) => {
      const aid = normalize(m["Asset ID"] || m.assetId || m["Machine ID"] || "");
      return aid && (aid.includes(search) || search.includes(aid));
    });
  }

  if (!machine) return null;

  const canonId = normalize(machine["Asset ID"] || "");

  // Sheets filled in by hand may have no "Created At", so fall back to Date.
  const stamp = (r: { createdAt?: string; date?: string }) => r.createdAt || r.date || "";
  const newestFirst = <T extends { createdAt?: string; date?: string }>(a: T, b: T) =>
    stamp(b).localeCompare(stamp(a));

  return {
    machine,
    maintenance: (db.maintenanceRecords || [])
      .filter((r) => {
        const rId = normalize(r.assetId || (r as any)["Asset ID"] || "");
        return (canonId && rId === canonId) || (search && rId === search);
      })
      .sort(newestFirst),
    safety: (db.safetyRecords || [])
      .filter((r) => {
        const rId = normalize(r.assetId || (r as any)["Asset ID"] || "");
        return (canonId && rId === canonId) || (search && rId === search);
      })
      .sort(newestFirst),
  };
}
