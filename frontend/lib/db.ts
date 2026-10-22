import crypto from "crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { emailKey, readAccess, writeAccess, type AccessMap } from "./access";
import { DATA_DIR } from "./config";
import { ensureNotificationScheduler } from "./notifyBoot";
import { hashPassword } from "./password";
import {
  PERMISSIONS,
  type Database,
  type Machine,
  type Asset,
  type MaintenanceRecord,
  type Permission,
  type SafetyRecord,
  type ChecklistRecord,
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

const lockStorage = ((globalThis as any).__skylineDbLockStorage ??= new AsyncLocalStorage<boolean>());

export function withDbLock<T>(task: () => Promise<T>): Promise<T> {
  if (lockStorage.getStore()) {
    return task();
  }
  const run = state.lock.then(
    () => lockStorage.run(true, task),
    () => lockStorage.run(true, task)
  );
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
    if (entry) {
      if (entry.accessLevel) user["App Access"] = entry.accessLevel;
      if (entry.passwordHash) user["Password Hash"] = entry.passwordHash;
      if (entry.displayPassword) user["Display Password"] = entry.displayPassword;
      user["Can Add Machine"] = entry.canAddMachine ? "Yes" : "No";
      user["Can Edit Machine"] = entry.canEditMachine ? "Yes" : "No";
    }
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
        const assets = (raw.assets || []) as Asset[];
        const users = (raw.users || []) as UserRecord[];
        const maintenanceRecords = (raw.maintenanceRecords || []) as MaintenanceRecord[];
        const safetyRecords = (raw.safetyRecords || []) as SafetyRecord[];
        const checklistRecords = (raw.checklistRecords || []) as ChecklistRecord[];
        const checklists = (raw.checklists && raw.checklists.length > 0 ? raw.checklists : raw.checklistMaster || DEFAULT_CHECKLISTS) as Array<Record<string, string>>;
        const pmParts = (raw.pmParts && raw.pmParts.length > 0 ? raw.pmParts : DEFAULT_PM_PARTS) as Array<Record<string, string>>;
        const documentRegister = (raw.documentRegister && raw.documentRegister.length > 0 ? raw.documentRegister : DEFAULT_DOCUMENTS) as Array<Record<string, string>>;
        mergeAccess(users, access);
        return { machines, assets, users, maintenanceRecords, safetyRecords, checklists, checklistRecords, pmParts, documentRegister };
      } catch { }
    }
  }

  return { machines: [], assets: [], users: [], maintenanceRecords: [], safetyRecords: [], checklists: DEFAULT_CHECKLISTS, checklistRecords: [], pmParts: DEFAULT_PM_PARTS, documentRegister: DEFAULT_DOCUMENTS };
}

let cachedDb: { data: Database; timestamp: number } | null = null;
let inFlightReadDbPromise: Promise<Database> | null = null;
const CACHE_TTL_MS = 3000;

export function invalidateDbCache(): void {
  cachedDb = null;
}

export function saveLocalJson(db: Database): void {
  try {
    const fs = require("fs");
    const path = require("path");
    const savePaths = [
      path.join(DATA_DIR, "db.json"),
      path.join(process.cwd(), "data", "db.json"),
      path.join(process.cwd(), "..", "backend", "data", "db.json"),
    ];
    const toSave = {
      machines: db.machines,
      assets: db.assets || [],
      users: db.users,
      maintenanceRecords: db.maintenanceRecords,
      safetyRecords: db.safetyRecords,
      checklists: db.checklists,
      checklistRecords: db.checklistRecords,
      pmParts: db.pmParts,
      documentRegister: db.documentRegister,
    };
    const jsonStr = JSON.stringify(toSave, null, 2);
    for (const p of savePaths) {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(p, jsonStr, "utf8");
      }
    }
  } catch (err) {
    console.warn("[saveLocalJson] Failed to write local json fallback:", err);
  }
}

/**
 * Read all data directly from MongoDB Atlas (Skyline_Project_Engineers database) with resilient fallback and caching.
 */
export async function readDb(forceFresh = false): Promise<Database> {
  const now = Date.now();
  if (!forceFresh && cachedDb && now - cachedDb.timestamp < CACHE_TTL_MS) {
    return cachedDb.data;
  }
  if (!forceFresh && inFlightReadDbPromise) {
    return inFlightReadDbPromise;
  }

  inFlightReadDbPromise = (async () => {
    try {
      const db = await readDbDirect();
      cachedDb = { data: db, timestamp: Date.now() };
      return db;
    } finally {
      inFlightReadDbPromise = null;
    }
  })();

  return inFlightReadDbPromise;
}

async function readDbDirect(): Promise<Database> {
  ensureNotificationScheduler();
  let mongoDb;
  try {
    mongoDb = await Promise.race([
      getMongoDb(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MongoDB connection timeout after 10s")), 10000)
      ),
    ]);
  } catch (err) {
    console.warn("[Database] MongoDB Atlas connection unreachable, loading local data store:", (err as Error)?.message);
  }

  if (mongoDb) {
    try {
      const queryPromise = Promise.all([
        mongoDb.collection("machines").find({}).toArray().catch(() => []),
        mongoDb.collection("assets").find({}).toArray().catch(() => []),
        mongoDb.collection("users").find({}).toArray().catch(() => []),
        mongoDb.collection("maintenance_records").find({}).toArray().catch(() => []),
        mongoDb.collection("safety_records").find({}).toArray().catch(() => []),
        mongoDb.collection("checklist_master").find({}).toArray().catch(() => mongoDb.collection("checklists").find({}).toArray().catch(() => [])),
        mongoDb.collection("spare_parts").find({}).toArray().catch(() => mongoDb.collection("pm_parts").find({}).toArray().catch(() => [])),
        mongoDb.collection("documents").find({}).limit(100).toArray().catch(() => mongoDb.collection("document_register").find({}).limit(100).toArray().catch(() => [])),
        mongoDb.collection("notifications").find({}).toArray().catch(() => []),
        mongoDb.collection("checklist_records").find({}).toArray().catch(() => []),
        mongoDb.collection("checklist_logs").find({}).toArray().catch(() => []),
      ]);

      const [
        machines,
        assets,
        users,
        maintenanceRecords,
        safetyRecords,
        mongoChecklists,
        mongoPmParts,
        mongoDocs,
        mongoNotifs,
        mongoChecklistRecords,
        mongoChecklistLogs,
      ] = await Promise.race([
        queryPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("MongoDB query timeout after 10s")), 10000)
        ),
      ]);

      const access = await readAccess();
      let fallbackDbCache: Database | null = null;
      const getFallback = async () => {
        if (!fallbackDbCache) fallbackDbCache = await loadJsonFallback();
        return fallbackDbCache;
      };

      let cleanMachines = machines.map((m: any) => {
        const { _id, ...rest } = m;
        const mac = { ...rest, _id: _id ? String(_id) : undefined } as Machine & { _id?: string };
        if (!mac["Asset ID"] && (m.assetId || m["Machine ID"])) {
          mac["Asset ID"] = m.assetId || m["Machine ID"];
        }
        if (!mac["Machine Name"] && (m.machineName || m.name || m["Asset Name"])) {
          mac["Machine Name"] = m.machineName || m.name || m["Asset Name"];
        }
        if (!mac["Serial No."] && (m["Serial No"] || m.serialNo)) {
          mac["Serial No."] = m["Serial No"] || m.serialNo;
        }
        if (!mac["Created At"] && (m.createdAt || m.created_at)) {
          mac["Created At"] = m.createdAt || m.created_at;
        }
        if (!mac["Last Updated"] && (m.lastUpdated || m.updated_at)) {
          mac["Last Updated"] = m.lastUpdated || m.updated_at;
        }
        if (!mac["QR Link"]) {
          const aid = mac["Asset ID"] || m["assetId"] || "";
          if (aid) mac["QR Link"] = `http://localhost:3000/machine/${encodeURIComponent(aid)}`;
        }
        let au = m.assignedUsers;
        if (!Array.isArray(au) || au.length === 0) {
          if (m["Assigned Users"]) {
            au = typeof m["Assigned Users"] === "string"
              ? m["Assigned Users"].split(",").map((s: string) => s.trim()).filter(Boolean)
              : Array.isArray(m["Assigned Users"]) ? m["Assigned Users"] : [];
          }
        }
        mac.assignedUsers = Array.isArray(au) ? Array.from(new Set(au.map(String).map((s) => s.trim()).filter(Boolean))) : [];
        mac["Assigned Users"] = mac.assignedUsers.join(", ");
        return mac;
      });
      if (cleanMachines.length === 0) cleanMachines = (await getFallback()).machines;

      let cleanAssets = (assets || []).map((a: any) => {
        const { _id, ...rest } = a;
        const asst = { ...rest, _id: _id ? String(_id) : undefined } as Asset & { _id?: string };
        if (!asst["Asset ID"] && (a.assetId || a["Machine ID"] || a["Asset No"])) {
          asst["Asset ID"] = a.assetId || a["Machine ID"] || a["Asset No"];
        }
        if (!asst["Machine Name"] && (a.machineName || a.name || a["Asset Name"])) {
          asst["Machine Name"] = a.machineName || a.name || a["Asset Name"];
        }
        if (!asst["Asset Name"]) {
          asst["Asset Name"] = asst["Machine Name"] || a["Asset Name"] || "";
        }
        if (!asst["Serial No."] && (a["Serial No"] || a.serialNo)) {
          asst["Serial No."] = a["Serial No"] || a.serialNo;
        }
        if (!asst["Created At"] && (a.createdAt || a.created_at)) {
          asst["Created At"] = a.createdAt || a.created_at;
        }
        if (!asst["Last Updated"] && (a.lastUpdated || a.updated_at)) {
          asst["Last Updated"] = a.lastUpdated || a.updated_at;
        }
        if (!asst["QR Link"]) {
          const aid = asst["Asset ID"] || a["assetId"] || "";
          if (aid) asst["QR Link"] = `http://localhost:3000/machine/${encodeURIComponent(aid)}`;
        }
        let au = a.assignedUsers;
        if (!Array.isArray(au) || au.length === 0) {
          if (a["Assigned Users"]) {
            au = typeof a["Assigned Users"] === "string"
              ? a["Assigned Users"].split(",").map((s: string) => s.trim()).filter(Boolean)
              : Array.isArray(a["Assigned Users"]) ? a["Assigned Users"] : [];
          }
        }
        asst.assignedUsers = Array.isArray(au) ? Array.from(new Set(au.map(String).map((s) => s.trim()).filter(Boolean))) : [];
        asst["Assigned Users"] = asst.assignedUsers.join(", ");
        return asst;
      });
      if (cleanAssets.length === 0) {
        cleanAssets = (await getFallback()).assets ?? [];
      }

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
        if (!userRec.assignedMachines) {
          let am = u.assignedMachines || u["Assigned Machines"] || [];
          if (typeof am === "string") {
            am = am.split(",").map((s: string) => s.trim()).filter(Boolean);
          }
          userRec.assignedMachines = Array.isArray(am) ? am : [];
        }
        if (!userRec["Assigned Machines"]) {
          userRec["Assigned Machines"] = (userRec.assignedMachines || []).join(", ");
        }
        return userRec;
      });
      if (cleanUsers.length === 0) cleanUsers = (await getFallback()).users;

      // Filter maintenance records: genuine maintenance/breakdowns and Not OK inspection records only.
      // Routine OK inspection rows belong in checklistRecords, not maintenanceRecords.
      let cleanMaintenance = maintenanceRecords
        .map((m: any) => {
          const { _id, ...rest } = m;
          const rec = { ...rest } as any;
          rec.recordId = rec.recordId || rec["Record ID"] || rec["Maintenance ID"] || rec["Breakdown Ticket"] || "";
          rec.date = rec.date || rec["Date"] || "";
          rec.assetId = rec.assetId || rec["Asset ID"] || rec["Asset ID / Machine"] || rec["Machine / Asset"] || "";
          rec.machineName = rec.machineName || rec["Machine Name"] || rec["Machine / Equipment"] || rec["Machine"] || "";
          rec.userId = rec.userId || rec["User ID"] || "";
          rec.userName = rec.userName || rec["User Name"] || rec["Submitted By"] || rec["Operator"] || "";
          rec.checklistId = rec.checklistId || rec["Checklist ID"] || rec["Template ID"] || "";
          rec.problem = rec.problem || rec["Problem / Breakdown"] || rec["Problem / Request"] || rec["Problem"] || rec["Issue"] || "";
          rec.priority = rec.priority || rec["Priority"] || "Medium";
          rec.assignedTo = rec.assignedTo || rec["Assigned To"] || rec.technicianName || rec["Technician"] || "";
          rec.actionTaken = rec.actionTaken || rec["Action Taken"] || rec.correctiveAction || rec["Corrective Action"] || "";
          rec.correctiveAction = rec.actionTaken;
          rec.status = rec.status || rec["Status"] || "Open";
          rec.completionDate = rec.completionDate || rec["Completion Date"] || "";
          return rec as MaintenanceRecord;
        })
        .filter((mr) => {
          const id = String(mr.recordId || (mr as any)["Record ID"] || "");
          const result = String((mr as any).result || (mr as any)["Result"] || "").toLowerCase();
          const prob = String(mr.problem || (mr as any)["Problem / Breakdown"] || "").trim();
          if (id.startsWith("CHK-") && (result === "ok" || result === "n/a" || mr.status === "Completed") && !prob) {
            return false;
          }
          return true;
        });
      if (cleanMaintenance.length === 0 && cleanMachines.length === 0) cleanMaintenance = (await getFallback()).maintenanceRecords;

      let cleanSafety = safetyRecords.map((s) => {
        const { _id, ...rest } = s;
        return rest as unknown as SafetyRecord;
      });
      if (cleanSafety.length === 0) cleanSafety = (await getFallback()).safetyRecords;

      let cleanChecklists = (mongoChecklists || []).map((item: any) => {
        const { _id, ...rest } = item;
        const c = { ...rest } as Record<string, string>;
        c["Asset ID"] = c["Asset ID"] || c["Asset ID / Machine"] || c["Machine / Asset"] || c["Machine"] || c["assetId"] || "";
        c["Asset ID / Machine"] = c["Asset ID"];
        c["Category"] = c["Category"] || c["category"] || "General Maintenance";
        c["Check Point"] = c["Check Point"] || c["Check Point / Task"] || c["checkPoint"] || c["Task"] || "";
        c["Check Point / Task"] = c["Check Point"];
        c["Standard Requirement"] = c["Standard Requirement"] || c["Standard / Requirement"] || c["Standard Parameter"] || c["Remarks / Value"] || c["standard"] || "Visual / Normal";
        c["Standard Parameter"] = c["Standard Requirement"];
        c["Frequency"] = c["Frequency"] || c["frequency"] || "Daily";
        c["Response"] = c["Response"] || c["response"] || "OK / Not OK / NA";
        c["Required Photo"] = c["Required Photo"] || c["requiredPhoto"] || "No";
        c["If Not OK Action"] = c["If Not OK Action"] || c["IF Not ok Action"] || c["actionIfNotOk"] || "Report to Maintenance";
        c["Active"] = c["Active"] || c["Status"] || c["status"] || "Yes";
        c["Status"] = c["Active"];
        c["Shift / Date"] = c["Shift / Date"] || c["Created Date"] || c["Date"] || "Today";
        return c;
      });
      if (!Array.isArray(mongoChecklists) && cleanChecklists.length === 0) {
        cleanChecklists = (await getFallback()).checklists ?? [];
      }

      // Build cleanChecklistRecords from checklist_records and legacy checklist_logs
      const seenRecordIds = new Set<string>();
      const cleanChecklistRecords: ChecklistRecord[] = [];

      const addRec = (rec: ChecklistRecord) => {
        if (!rec.recordId || seenRecordIds.has(rec.recordId)) return;
        seenRecordIds.add(rec.recordId);
        cleanChecklistRecords.push(rec);
      };

      for (const item of (mongoChecklistRecords || [])) {
        const { _id, ...rest } = item;
        const r = rest as any;
        addRec({
          recordId: r.recordId || r["Record ID"] || r["Log ID"] || r.logId || `CHK-REC-${Math.random().toString(36).substring(2, 8)}`,
          submissionId: r.submissionId || r["Submission ID"] || "",
          date: r.date || r["Date"] || new Date().toISOString().split("T")[0],
          shift: r.shift || r["Shift"] || "General",
          assetId: r.assetId || r["Asset ID"] || "",
          machineName: r.machineName || r["Machine Name"] || "",
          checklistId: r.checklistId || r["Checklist ID"] || "",
          templateId: r.templateId || r["Template ID"] || r.checklistId || "",
          checkPoint: r.checkPoint || r["Check Point"] || r["Check Point / Task"] || "",
          category: r.category || r["Category"] || "General Maintenance",
          standardRequirement: r.standardRequirement || r["Standard Requirement"] || r["Standard Parameter"] || "Visual / Normal",
          frequency: r.frequency || r["Frequency"] || "Daily",
          response: r.response || r["Response"] || r.status || "OK",
          status: r.status || r["Status"] || r.response || "OK",
          remarks: r.remarks || r["Remarks"] || "",
          actionIfNotOk: r.actionIfNotOk || r["If Not OK Action"] || r["Action if Not OK"] || "",
          photoEvidence: r.photoEvidence || r["Photo Evidence"] || r.photo || "",
          operator: r.operator || r["Operator"] || r["Operator / Inspector"] || r.userName || "",
          userName: r.userName || r.operator || r["Operator"] || "",
          userId: r.userId || r["User ID"] || "",
          submittedBy: r.submittedBy || r["Submitted By"] || "",
          maintenanceTicketId: r.maintenanceTicketId || r["Maintenance Ticket ID"] || "",
          createdAt: r.createdAt || r["Created At"] || new Date().toISOString(),
          lastUpdated: r.lastUpdated || r["Last Updated"] || new Date().toISOString(),
          isHistoricalScheduled: Boolean(r.isHistoricalScheduled),
          requiresVerification: Boolean(r.requiresVerification),
          isSunday: Boolean(r.isSunday),
        });
      }

      for (const item of (mongoChecklistLogs || [])) {
        const { _id, ...rest } = item;
        const l = rest as any;
        const isPassed = String(l.Status || l.status || "").toUpperCase() === "PASSED" || String(l.Status || l.status || "").toUpperCase() === "OK";
        addRec({
          recordId: l["Log ID"] || l.logId || l.recordId || `LOG-${Math.random().toString(36).substring(2, 8)}`,
          submissionId: l["Submission ID"] || l.submissionId || "",
          date: l["Date"] || l.date || new Date().toISOString().split("T")[0],
          shift: l["Shift"] || l.shift || "General",
          assetId: l["Asset ID"] || l.assetId || "",
          machineName: l["Machine Name"] || l.machineName || "",
          checklistId: l["Checklist ID"] || l.checklistId || "",
          templateId: l["Template ID"] || l["Checklist ID"] || "",
          checkPoint: l["Check Point"] || l.checkPoint || "",
          category: l["Category"] || "General Maintenance",
          standardRequirement: l["Standard Requirement"] || l["Parameter Value"] || "Visual / Normal",
          frequency: l["Frequency"] || l.frequency || "Daily",
          response: isPassed ? "OK" : "Not OK",
          status: isPassed ? "OK" : "Not OK",
          remarks: l["Remarks"] || l.remarks || "",
          actionIfNotOk: l["Action if Not OK"] || "",
          photoEvidence: l["Photo Evidence"] || "",
          operator: l["Operator / Inspector"] || l.operator || "",
          userName: l["Operator / Inspector"] || l.operator || "",
          userId: l["User ID"] || "",
          submittedBy: l["Submitted By"] || "",
          maintenanceTicketId: l.maintenanceTicketId || "",
          createdAt: l["Created At"] || new Date().toISOString(),
          lastUpdated: l["Last Updated"] || new Date().toISOString(),
        });
      }

      if (cleanChecklistRecords.length === 0) {
        cleanChecklistRecords.push(...((await getFallback()).checklistRecords ?? []));
      }

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
      if (cleanPmParts.length === 0) cleanPmParts = (await getFallback()).pmParts ?? DEFAULT_PM_PARTS;

      let cleanDocs = (mongoDocs || []).map((item: any) => { const { _id, ...rest } = item; return rest as unknown as Record<string, string>; });
      if (cleanDocs.length === 0) cleanDocs = (await getFallback()).documentRegister ?? DEFAULT_DOCUMENTS;

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
      if (cleanNotifs.length === 0) cleanNotifs = (await getFallback()).notifications ?? [];

      mergeAccess(cleanUsers, access);

      return {
        machines: cleanMachines,
        assets: cleanAssets,
        users: cleanUsers,
        maintenanceRecords: cleanMaintenance,
        safetyRecords: cleanSafety,
        checklists: cleanChecklists,
        checklistRecords: cleanChecklistRecords,
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
  saveLocalJson(db);
  invalidateDbCache();

  let mongoDb;
  try {
    mongoDb = await getMongoDb();
  } catch (err) {
    console.warn("[writeDb] MongoDB Atlas offline, changes saved locally:", (err as Error)?.message);
    return;
  }

  try {
    // 1. Machines collection (bulk)
    if (db.machines?.length) {
      const ops = db.machines
        .filter((m) => Boolean(m["Asset ID"]))
        .map((m) => ({
          updateOne: {
            filter: { "Asset ID": m["Asset ID"] },
            update: { $set: sanitizeMongoDoc(m) },
            upsert: true,
          },
        }));
      if (ops.length > 0) {
        await mongoDb.collection("machines").bulkWrite(ops, { ordered: false }).catch(() => {});
      }
    }

    // 1b. Assets collection (bulk) - separate from machines, preserves every record
    if (db.assets?.length) {
      const ops = db.assets.map((a: any, idx: number) => {
        const filter = a.sourceRow
          ? { sourceRow: a.sourceRow }
          : a["Asset ID"]
          ? { "Asset ID": a["Asset ID"] }
          : { _sourceIdx: idx };
        return {
          updateOne: {
            filter,
            update: { $set: sanitizeMongoDoc(a) },
            upsert: true,
          },
        };
      });
      if (ops.length > 0) {
        await mongoDb.collection("assets").bulkWrite(ops, { ordered: false }).catch(() => {});
      }
    }

    // 2. Users collection (bulk)
    if (db.users?.length) {
      const ops = db.users
        .map((u) => {
          const email = String(u["Login Email"] || (u as any).email || "").trim();
          const userId = String(u["User ID"] || (u as any).userId || (u as any).username || "").trim();
          const { _id, userId: _d1, username: _d2, email: _d3, ...rest } = u as any;
          const userDoc = { ...rest, "User ID": userId, "Login Email": email };
          const filter = userId ? { "User ID": userId } : { "Login Email": email };
          return {
            updateOne: {
              filter,
              update: { $set: userDoc, $unset: { userId: "", username: "", email: "" } },
              upsert: true,
            },
          };
        })
        .filter(Boolean);
      if (ops.length > 0) {
        await mongoDb.collection("users").bulkWrite(ops as any, { ordered: false }).catch(() => {});
      }
    }

    // 3. Maintenance records collection (bulk)
    if (db.maintenanceRecords?.length) {
      const ops = db.maintenanceRecords
        .filter((mr) => Boolean(mr.recordId || (mr as any)["Record ID"]))
        .map((mr) => {
          const recId = mr.recordId || (mr as any)["Record ID"];
          return {
            updateOne: {
              filter: { recordId: recId },
              update: { $set: sanitizeMongoDoc(mr) },
              upsert: true,
            },
          };
        });
      if (ops.length > 0) {
        await mongoDb.collection("maintenance_records").bulkWrite(ops, { ordered: false }).catch(() => {});
      }
    }

    // 4. Safety records collection (bulk)
    if (db.safetyRecords?.length) {
      const ops = db.safetyRecords
        .filter((sr) => Boolean(sr.recordId || (sr as any)["Record ID"]))
        .map((sr) => {
          const recId = sr.recordId || (sr as any)["Record ID"];
          return {
            updateOne: {
              filter: { recordId: recId },
              update: { $set: sanitizeMongoDoc(sr) },
              upsert: true,
            },
          };
        });
      if (ops.length > 0) {
        await mongoDb.collection("safety_records").bulkWrite(ops, { ordered: false }).catch(() => {});
      }
    }

    // 5. PM Parts / Spare Parts collection (bulk)
    const rawDb = db as any;
    if (rawDb.pmParts?.length) {
      const ops = rawDb.pmParts
        .filter((p: any) => Boolean(p["Part ID"] || p["Item / Part ID"] || p["partId"]))
        .map((p: any) => {
          const partId = p["Part ID"] || p["Item / Part ID"] || p["partId"];
          return {
            updateOne: {
              filter: { "Part ID": partId },
              update: { $set: sanitizeMongoDoc(p) },
              upsert: true,
            },
          };
        });
      if (ops.length > 0) {
        await mongoDb.collection("spare_parts").bulkWrite(ops, { ordered: false }).catch(() => {});
      }
    }

    // 6. Checklist Records collection (bulk)
    if (db.checklistRecords?.length) {
      const ops = db.checklistRecords
        .filter((cr) => Boolean(cr.recordId || (cr as any)["Record ID"]))
        .map((cr) => {
          const recId = cr.recordId || (cr as any)["Record ID"];
          return {
            updateOne: {
              filter: { recordId: recId },
              update: { $set: sanitizeMongoDoc(cr) },
              upsert: true,
            },
          };
        });
      if (ops.length > 0) {
        await mongoDb.collection("checklist_records").bulkWrite(ops, { ordered: false }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("[writeDb] Bulk sync to MongoDB Atlas encountered error:", err);
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
          { "Log ID": identifier },
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
          { scheduleId: identifier },
          { breakdownId: identifier },
          { ticketId: identifier },
          { requestId: identifier },
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

/**
 * Resolves a machine from the local database cache or direct MongoDB query.
 * Matches on Asset ID, Machine ID, assetId, machineCode, MongoDB _id, Machine Name,
 * Serial Number, QR link (including legacy links), or assets collection fallback.
 */
export async function resolveMachine(db: Database, inputId: string): Promise<Machine | null> {
  if (!inputId) return null;
  const raw = String(inputId).trim();
  const search = normalize(raw);
  if (!search) return null;

  // 1. Direct equality on Asset ID / Machine ID / assetId / machineCode
  let machine = (db.machines || []).find((m: any) => {
    const aid = normalize(m["Asset ID"] || m.assetId || m["Machine ID"] || m.machineId || m.machineCode || "");
    return aid === search;
  });
  if (machine) return machine;

  // 2. Direct equality on MongoDB ObjectId _id
  machine = (db.machines || []).find((m: any) => {
    const id = normalize(m._id || "");
    return id && id === search;
  });
  if (machine) return machine;

  // 3. Direct equality on Machine Name
  machine = (db.machines || []).find((m: any) => {
    const name = normalize(m["Machine Name"] || m.machineName || m.name || "");
    return name && name === search;
  });
  if (machine) return machine;

  // 4. Match on Serial No
  machine = (db.machines || []).find((m: any) => {
    const serial = normalize(m["Serial No."] || m["Serial No"] || m.serialNo || "");
    return serial && serial === search;
  });
  if (machine) return machine;

  // 5. Check QR Link and legacy QR links in db.machines
  machine = (db.machines || []).find((m: any) => {
    const qr = normalize(m["QR Link"] || m["QR Legacy Link"] || "");
    if (!qr) return false;
    return qr === search || qr.endsWith(`/${search}`) || qr.includes(`/machine/${search}`) || qr.includes(`/${search}`);
  });
  if (machine) return machine;

  // 6. Substring match on Asset ID (length >= 4)
  if (search.length >= 4) {
    machine = (db.machines || []).find((m: any) => {
      const aid = normalize(m["Asset ID"] || m.assetId || m["Machine ID"] || "");
      return aid && (aid.includes(search) || search.includes(aid));
    });
    if (machine) return machine;
  }

  // 7. Check in db.assets collection
  const asset = (db.assets || []).find((a: any) => {
    const aid = normalize(a["Asset ID"] || a.assetId || a["Machine ID"] || a["Asset No"] || "");
    const id = normalize(a._id || "");
    const name = normalize(a["Machine Name"] || a["Asset Name"] || a.name || "");
    const qr = normalize(a["QR Link"] || a["QR Legacy Link"] || "");
    return (
      aid === search ||
      id === search ||
      name === search ||
      (qr && (qr === search || qr.endsWith(`/${search}`) || qr.includes(`/machine/${search}`)))
    );
  });
  if (asset) {
    return {
      "Asset ID": asset["Asset ID"] || (asset as any).assetId || "",
      "Machine Name": asset["Machine Name"] || (asset as any)["Asset Name"] || (asset as any).name || "Asset Equipment",
      Category: asset.Category || (asset as any).category || (asset as any).Type || "Plant Asset",
      Department: asset.Department || (asset as any).department || "Maintenance",
      Location: asset.Location || (asset as any).location || "Plant Floor",
      Make: asset.Make || (asset as any).make || "—",
      Model: asset.Model || (asset as any).model || "—",
      "Serial No.": asset["Serial No."] || (asset as any)["Serial No"] || (asset as any).serialNo || "—",
      Criticality: asset.Criticality || (asset as any).criticality || "Normal",
      "Responsible Person": asset["Responsible Person"] || (asset as any).responsiblePerson || "—",
      Status: asset.Status || (asset as any).status || "Running",
      "PM Frequency": asset["PM Frequency"] || (asset as any).pmFrequency || "Monthly",
      "AMC Vendor": asset["AMC Vendor"] || (asset as any).amcVendor || "—",
      "AMC Contact": asset["AMC Contact"] || (asset as any).amcContact || "—",
      "AMC Expiry": asset["AMC Expiry"] || (asset as any).amcExpiry || "—",
      "Installation Date": asset["Installation Date"] || (asset as any).installationDate || "—",
      "QR Link": asset["QR Link"] || "",
      assignedUsers: (asset as any).assignedUsers || [],
      "Assigned Users": (asset as any)["Assigned Users"] || "",
    } as Machine;
  }

  // 8. Direct MongoDB Atlas Fallback
  try {
    const { getMongoDb } = await import("./mongodb");
    const mongoDb = await getMongoDb();
    if (mongoDb) {
      const { ObjectId } = await import("mongodb");
      const cleanInput = raw;
      const escaped = cleanInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const exactRegex = new RegExp(`^${escaped}$`, "i");
      const subRegex = new RegExp(escaped, "i");

      const orClauses: any[] = [
        { "Asset ID": exactRegex },
        { assetId: exactRegex },
        { "Machine ID": exactRegex },
        { machineId: exactRegex },
        { machineCode: exactRegex },
        { "Machine Name": exactRegex },
        { "QR Link": subRegex },
        { "QR Legacy Link": subRegex },
        { "Serial No.": exactRegex },
        { "Serial No": exactRegex },
        { serialNo: exactRegex },
      ];
      if (ObjectId.isValid(cleanInput)) {
        try {
          orClauses.push({ _id: new ObjectId(cleanInput) });
        } catch {}
      }

      const doc = await mongoDb.collection("machines").findOne({ $or: orClauses });
      if (doc) {
        return {
          ...doc,
          _id: doc._id?.toString(),
          "Asset ID": doc["Asset ID"] || doc.assetId || doc["Machine ID"] || "",
          "Machine Name": doc["Machine Name"] || doc.machineName || doc.name || "Machine",
        } as Machine;
      }

      const aDoc = await mongoDb.collection("assets").findOne({ $or: orClauses });
      if (aDoc) {
        return {
          ...aDoc,
          _id: aDoc._id?.toString(),
          "Asset ID": aDoc["Asset ID"] || aDoc.assetId || aDoc["Machine ID"] || "",
          "Machine Name": aDoc["Machine Name"] || aDoc["Asset Name"] || aDoc.name || "Asset Equipment",
          Category: aDoc.Category || aDoc.category || aDoc.Type || "Plant Asset",
          Department: aDoc.Department || aDoc.department || "Maintenance",
          Location: aDoc.Location || aDoc.location || "Plant Floor",
          Make: aDoc.Make || aDoc.make || "—",
          Model: aDoc.Model || aDoc.model || "—",
          "Serial No.": aDoc["Serial No."] || aDoc["Serial No"] || aDoc.serialNo || "—",
          Criticality: aDoc.Criticality || aDoc.criticality || "Normal",
          "Responsible Person": aDoc["Responsible Person"] || aDoc.responsiblePerson || "—",
          Status: aDoc.Status || aDoc.status || "Running",
          "PM Frequency": aDoc["PM Frequency"] || aDoc.pmFrequency || "Monthly",
          "AMC Vendor": aDoc["AMC Vendor"] || aDoc.amcVendor || "—",
          "AMC Contact": aDoc["AMC Contact"] || aDoc.amcContact || "—",
          "AMC Expiry": aDoc["AMC Expiry"] || aDoc.amcExpiry || "—",
          "Installation Date": aDoc["Installation Date"] || aDoc.installationDate || "—",
          "QR Link": aDoc["QR Link"] || "",
        } as Machine;
      }
    }
  } catch (err) {
    console.warn("[resolveMachine] Direct Atlas query error:", err);
  }

  return null;
}

/** Mirrors findMachineByAssetId() from Code.gs */
export async function findMachineByAssetId(
  assetId: string
): Promise<{ success: boolean; machine?: Machine; message?: string }> {
  if (!assetId || !String(assetId).trim()) {
    return { success: false, message: "Please enter an Asset ID." };
  }

  const db = await readDb();
  const machine = await resolveMachine(db, assetId);

  if (!machine) {
    return { success: false, message: "Machine not found: " + assetId };
  }

  // Enrich with assigned user details from User Master
  const rawUsers = (machine as any).assignedUsers || machine["Assigned Users"] || [];
  const userList: string[] = Array.isArray(rawUsers)
    ? rawUsers
    : String(rawUsers || "").split(",").map((s) => s.trim()).filter(Boolean);
  const userMap = new Map((db.users || []).map((u) => [
    String(u["User ID"] || u.userId || u["Login Email"] || "").trim().toUpperCase(),
    {
      userId: String(u["User ID"] || u.userId || "").trim(),
      name: String(u.Name || u.name || "").trim(),
      role: String(u.Role || u.role || "Operator").trim(),
      email: String(u["Login Email"] || u.email || "").trim(),
    }
  ]));
  const populatedMachine = {
    ...machine,
    assignedUsers: userList,
    "Assigned Users": userList.join(", "),
    assignedUserDetails: userList.map((id) =>
      userMap.get(id.toUpperCase()) || { userId: id, name: id, role: "Operator", email: "" }
    ),
  };

  return { success: true, machine: populatedMachine };
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

export function cleanUserDoc(u: any): UserRecord {
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
}

/**
 * Find a person by what they typed on the login page: their work email, or
 * their User ID from the User Master tab (e.g. "OP-001"). A User ID that
 * appears on more than one row is refused rather than guessed.
 */
export async function findUserByLogin(identifier: string): Promise<UserRecord | null> {
  const wanted = normalize(identifier);
  if (!wanted) return null;

  // 1. Direct fast-path lookup in MongoDB Atlas users collection (avoids loading 35,000+ docs)
  try {
    const mongoDb = await getMongoDb();
    const cleanWanted = wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^${cleanWanted}$`, "i");

    const query: Record<string, any> = {
      $or: [
        { "Login Email": { $regex: regex } },
        { email: { $regex: regex } },
        { loginEmail: { $regex: regex } },
        { "User ID": { $regex: regex } },
        { userId: { $regex: regex } },
        { username: { $regex: regex } },
        { Name: { $regex: regex } },
      ],
    };

    if (wanted === "supervisor" || wanted === "sp") {
      query.$or.push({ "User ID": /^sp-001$/i }, { Role: /^supervisor$/i }, { "App Access": /^supervisor$/i });
    } else if (wanted === "admin" || wanted === "adm") {
      query.$or.push({ "User ID": /^adm-001$/i }, { Role: /^admin$/i }, { "App Access": /^admin$/i });
    } else if (wanted === "operator" || wanted === "op") {
      query.$or.push({ "User ID": /^op-001$/i }, { Role: /^operator$/i });
    }

    const rawUser = await mongoDb.collection("users").findOne(query);
    if (rawUser) {
      const user = cleanUserDoc(rawUser);
      const access = await readAccess();
      mergeAccess([user], access);
      return user;
    }
  } catch (err) {
    console.warn("[findUserByLogin] Direct Mongo query failed, falling back to readDb:", (err as Error)?.message);
  }

  // 2. Fallback to readDb if direct query didn't find the user
  const db = await readDb();

  // If identifier contains '@', prioritize matching Login Email / email field
  if (wanted.includes("@")) {
    const byEmail = db.users.find(
      (u: any) =>
        normalize(u["Login Email"]) === wanted ||
        normalize(u.email) === wanted ||
        normalize(u.loginEmail) === wanted
    );
    if (byEmail) return byEmail;
  }

  // Direct match on User ID / userId / username (distinct from email)
  const byUserId = db.users.find(
    (u: any) =>
      (u["User ID"] && normalize(u["User ID"]) === wanted) ||
      (u.userId && normalize(u.userId) === wanted) ||
      (u.username && normalize(u.username) === wanted)
  );
  if (byUserId) return byUserId;

  // Match on Login Email or Name
  const byLoginEmail = db.users.find(
    (u: any) =>
      (u["Login Email"] && normalize(u["Login Email"]) === wanted) ||
      (u.email && normalize(u.email) === wanted) ||
      (u.Name && normalize(u.Name) === wanted)
  );
  if (byLoginEmail) return byLoginEmail;

  // Role alias match (e.g. typing "supervisor", "admin", "operator")
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

  try {
    const mongoDb = await getMongoDb();
    const cleanWanted = wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^${cleanWanted}$`, "i");

    const rawUser = await mongoDb.collection("users").findOne({
      $or: [
        { "Login Email": { $regex: regex } },
        { email: { $regex: regex } },
        { loginEmail: { $regex: regex } },
        { "User ID": { $regex: regex } },
        { userId: { $regex: regex } },
        { username: { $regex: regex } },
      ],
    });
    if (rawUser) {
      const user = cleanUserDoc(rawUser);
      const access = await readAccess();
      mergeAccess([user], access);
      return user;
    }
  } catch (err) {
    console.warn("[findUserByEmail] Direct Mongo query failed, falling back to readDb:", (err as Error)?.message);
  }

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
  actionTaken?: string;
  spareParts: string;
  downtime: string;
  completionDate?: string;
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
    input.completionDate ||
    (normalizedStatus === "completed"
      ? input.maintenanceDate || now
      : "");

  const isBreakdown =
    !input.maintenanceType ||
    input.maintenanceType.toLowerCase().includes("breakdown") ||
    input.maintenanceType.toLowerCase().includes("corrective");

  const prefix = isBreakdown ? "BD" : "MNT";
  const recordId = uniqueRecordId(
    prefix,
    db.maintenanceRecords.map((r) => r.recordId)
  );

  const actionTakenVal = input.actionTaken || input.correctiveAction || "";

  const record: MaintenanceRecord = {
    recordId,
    recordType: input.maintenanceType || (isBreakdown ? "Breakdown Ticket" : "Maintenance"),
    date: input.maintenanceDate || now.slice(0, 10),
    assetId: input.assetId || "",
    machineName: input.machineName || "",
    userId: input.userId || "",
    userName: input.userName || "",
    submittedBy: input.submittedBy || "System User",
    checklistId: input.checklistId || "MNT-GENERAL",
    checkPoint: input.checkPoint || (isBreakdown ? "Machine Breakdown" : "Maintenance Inspection"),
    result,
    problem: input.problem || "",
    rootCause: input.rootCause || "",
    priority: input.priority || "Medium",
    assignedTo: input.assignedTo || "",
    technicianName: input.technicianName || "",
    status: input.status || "Open",
    correctiveAction: actionTakenVal,
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
  saveLocalJson(db);
  invalidateDbCache();

  // Sync to maintenance_records and breakdowns collections in MongoDB Atlas
  try {
    const { getMongoDb } = await import("./mongodb");
    const mongoDb = await getMongoDb();
    await mongoDb.collection("maintenance_records").updateOne(
      { recordId: record.recordId },
      { $set: sanitizeMongoDoc(record) },
      { upsert: true }
    );
    await mongoDb.collection("breakdowns").insertOne({
      "Breakdown Ticket": recordId,
      "Machine Asset": `${input.machineName || input.assetId} (${input.assetId})`,
      "Breakdown Issue": input.problem || "Machine Breakdown",
      "Reported Date": input.maintenanceDate || now.slice(0, 10),
      "Resolved Date": normalizedStatus === "completed" ? (input.maintenanceDate || now.slice(0, 10)) : "-",
      "Downtime (Hours)": input.downtime || "0",
      "Root Cause": input.rootCause || "Under Investigation",
      "Status": input.status || "Open",
      "Priority": input.priority || "Medium",
      "Reported By": `${input.userName} (${input.userId})`,
      "createdAt": now,
      "lastUpdated": now,
    });

    // Also sync to maintenance_requests collection
    const reqStatus = normalizedStatus === "completed" ? "Completed" : (input.status || "Open");
    const mReqId = record.requestId || recordId;
    let department = "";
    try {
      const mach = await mongoDb.collection("machines").findOne({ "Asset ID": input.assetId });
      department = mach?.Department || mach?.department || "";
    } catch {}

    await mongoDb.collection("maintenance_requests").updateOne(
      { requestId: mReqId },
      {
        $set: sanitizeMongoDoc({
          requestId: mReqId,
          assetId: input.assetId || "",
          machineName: input.machineName || "",
          department: department || "Plant Operations",
          problem: input.problem || "",
          reportedBy: input.userName || input.submittedBy || "Operator",
          reportedDate: input.maintenanceDate || now.slice(0, 10),
          reportedAt: now,
          priority: input.priority || "Medium",
          assignedTo: input.assignedTo || "",
          technicianName: input.technicianName || input.assignedTo || "",
          status: reqStatus,
          source: input.maintenanceType || "Operator Request",
          actualProblem: input.problem || "",
          rootCause: input.rootCause || "",
          maintenanceWorkPerformed: input.correctiveAction || input.actionTaken || "",
          sparePartsUsed: input.spareParts || "",
          breakdownDurationHours: Number(input.downtime || 0),
          lastUpdated: now,
        }),
        $setOnInsert: {
          createdAt: now,
          auditTrail: [
            {
              action: "CREATED",
              performedBy: input.userName || input.submittedBy || "Operator",
              timestamp: now,
              newStatus: reqStatus,
              remarks: "Maintenance request created via operator / machine portal",
            },
          ],
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn("Could not sync to maintenance collections in Atlas", err);
  }

  return {
    success: true,
    message: "Breakdown maintenance record saved successfully.\nTicket ID: " + recordId,
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
  saveLocalJson(db);
  invalidateDbCache();

  try {
    const { getMongoDb } = await import("./mongodb");
    const mongoDb = await getMongoDb();
    await mongoDb.collection("safety_records").updateOne(
      { recordId: record.recordId },
      { $set: sanitizeMongoDoc(record) },
      { upsert: true }
    );
  } catch (err) {
    console.warn("Could not sync safety record to Atlas", err);
  }

  return {
    success: true,
    message: "Safety record saved successfully.\nRecord ID: " + recordId,
    recordId,
  };
}

export const ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-\s/#]{1,49}$/;

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
  "QR Link",
  "Assigned Users",
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

    const machineName = clean(
      input["Machine Name"] ||
      (input as any).machineName ||
      (input as any).Name ||
      (input as any)["Asset Name"]
    );
    if (!machineName) {
      return { success: false, message: "Machine Name is required." };
    }

    const db = await readDb();
    let assetId = clean(
      input["Asset ID"] ||
      (input as any).assetId ||
      (input as any)["Machine ID"]
    );

    if (assetId) {
      if (!ASSET_ID_PATTERN.test(assetId)) {
        return {
          success: false,
          message:
            "Asset ID may only use letters, numbers, dots, dashes, slashes, spaces and underscores (2-50 characters).",
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
      const value = clean(
        input[field] ||
        (input as any)[field.replace(/\.$/, "")] ||
        (input as any)[field.toLowerCase()] ||
        (input as any)[field.replace(/\s+/g, "")]
      );
      if (value) {
        (machine as unknown as Record<string, string>)[field] = value;
      }
    }
    if (!machine.Status) machine.Status = "Running";
    if (!machine["QR Link"]) {
      machine["QR Link"] = `http://localhost:3000/machine/${encodeURIComponent(assetId)}`;
    }
    machine["Created At"] = machine["Last Updated"] = new Date().toISOString();

    // Handle Assigned Users
    const rawAssigned = (input as any).assignedUsers !== undefined
      ? (input as any).assignedUsers
      : input["Assigned Users"];
    let assignedList: string[] = [];
    if (rawAssigned !== undefined) {
      if (Array.isArray(rawAssigned)) {
        assignedList = rawAssigned.map((u: any) => String(u).trim()).filter(Boolean);
      } else {
        assignedList = String(rawAssigned || "").split(",").map((s) => s.trim()).filter(Boolean);
      }
      assignedList = Array.from(new Set(assignedList));
    }
    machine.assignedUsers = assignedList;
    machine["Assigned Users"] = assignedList.join(", ");

    db.machines.unshift(machine);
    saveLocalJson(db);
    invalidateDbCache();

    try {
      const { getMongoDb } = await import("./mongodb");
      const mongoDb = await getMongoDb();
      await mongoDb.collection("machines").updateOne(
        {
          $or: [
            { "Asset ID": machine["Asset ID"] },
            { assetId: machine["Asset ID"] },
            { "Machine ID": machine["Asset ID"] },
          ],
        },
        { $set: sanitizeMongoDoc(machine) },
        { upsert: true }
      );
    } catch (err) {
      console.warn("Could not sync machine to Atlas", err);
    }

    if (assignedList.length > 0) {
      try {
        const { syncMachineAssignedUsers } = await import("./assignments");
        await syncMachineAssignedUsers(assetId, assignedList, "System Administrator").catch(() => {});
      } catch (err) {
        console.warn("Could not sync user assignments for new machine", err);
      }
    }

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

    // Handle Assigned Users
    const hasAssigned = "Assigned Users" in input || "assignedUsers" in input;
    if (hasAssigned) {
      const rawAssigned = (input as any).assignedUsers !== undefined
        ? (input as any).assignedUsers
        : input["Assigned Users"];
      let assignedList: string[] = [];
      if (Array.isArray(rawAssigned)) {
        assignedList = rawAssigned.map((u: any) => String(u).trim()).filter(Boolean);
      } else {
        assignedList = String(rawAssigned || "").split(",").map((s) => s.trim()).filter(Boolean);
      }
      assignedList = Array.from(new Set(assignedList));
      updated.assignedUsers = assignedList;
      updated["Assigned Users"] = assignedList.join(", ");

      try {
        const { syncMachineAssignedUsers } = await import("./assignments");
        await syncMachineAssignedUsers(assetId, assignedList, "System Administrator").catch(() => {});
      } catch (err) {
        console.warn("Could not sync user assignments for updated machine", err);
      }
    }

    updated["Last Updated"] = new Date().toISOString();
    db.machines[index] = updated;
    saveLocalJson(db);
    invalidateDbCache();

    try {
      const { getMongoDb } = await import("./mongodb");
      const mongoDb = await getMongoDb();
      await mongoDb.collection("machines").updateOne(
        { "Asset ID": updated["Asset ID"] },
        { $set: sanitizeMongoDoc(updated) },
        { upsert: true }
      );
    } catch (err) {
      console.warn("Could not sync updated machine to Atlas", err);
    }

    return {
      success: true,
      message: "Machine details updated successfully.",
      machine: updated,
    };
  });
}

const ASSET_FIELDS: (keyof Asset)[] = [
  "Asset Name",
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
  "QR Link",
];

function generateAssetIdForAssets(existing: Asset[]): string {
  const taken = new Set(existing.map((a) => normalize(a["Asset ID"])));
  let n = existing.length + 1;
  let id = "";
  do {
    id = `AST-${String(n).padStart(3, "0")}`;
    n++;
  } while (taken.has(normalize(id)));
  return id;
}

/**
 * Register a new asset in Asset Master (strictly independent from Machine Master).
 */
export function addAsset(
  input: Partial<Record<keyof Asset, unknown>>
): Promise<{ success: boolean; message: string; asset?: Asset }> {
  return withDbLock(async () => {
    const clean = (value: unknown) => String(value ?? "").trim().slice(0, 200);

    const assetName = clean(
      input["Asset Name"] ||
      input["Machine Name"] ||
      (input as any).assetName ||
      (input as any).machineName ||
      (input as any).Name
    );
    if (!assetName) {
      return { success: false, message: "Asset Name is required." };
    }

    const db = await readDb();
    if (!db.assets) db.assets = [];

    let assetId = clean(
      input["Asset ID"] ||
      (input as any).assetId ||
      (input as any)["Machine ID"]
    );

    if (assetId) {
      if (!ASSET_ID_PATTERN.test(assetId)) {
        return {
          success: false,
          message:
            "Asset ID may only use letters, numbers, dots, dashes, slashes, spaces and underscores (2-50 characters).",
        };
      }
      if (db.assets.some((a) => normalize(a["Asset ID"]) === normalize(assetId))) {
        return {
          success: false,
          message: `Asset ID ${assetId} already exists in Asset Master. Each asset needs a unique ID.`,
        };
      }
    } else {
      assetId = generateAssetIdForAssets(db.assets);
    }

    const asset: Asset = { "Asset ID": assetId, "Asset Name": assetName, "Machine Name": assetName };
    for (const field of ASSET_FIELDS) {
      const value = clean(
        input[field] ||
        (input as any)[field.replace(/\.$/, "")] ||
        (input as any)[field.toLowerCase()] ||
        (input as any)[field.replace(/\s+/g, "")]
      );
      if (value) {
        (asset as unknown as Record<string, string>)[field] = value;
      }
    }
    if (!asset.Status) asset.Status = "Running";
    if (!asset["QR Link"]) {
      asset["QR Link"] = `http://localhost:3000/machine/${encodeURIComponent(assetId)}`;
    }
    asset["Created At"] = asset["Last Updated"] = new Date().toISOString();

    db.assets.unshift(asset);
    saveLocalJson(db);
    invalidateDbCache();

    try {
      const { getMongoDb } = await import("./mongodb");
      const mongoDb = await getMongoDb();
      await mongoDb.collection("assets").updateOne(
        {
          $or: [
            { "Asset ID": asset["Asset ID"] },
            { assetId: asset["Asset ID"] },
            { "Machine ID": asset["Asset ID"] },
          ],
        },
        { $set: sanitizeMongoDoc(asset) },
        { upsert: true }
      );
    } catch (err) {
      console.warn("Could not sync asset to Atlas", err);
    }

    return {
      success: true,
      message: `Asset added successfully.\nAsset ID: ${assetId}`,
      asset,
    };
  });
}

/** Update an existing asset in Asset Master (strictly independent from Machine Master). */
export function updateAsset(
  assetId: string,
  input: Partial<Record<keyof Asset, unknown>>
): Promise<{ success: boolean; message: string; asset?: Asset }> {
  return withDbLock(async () => {
    const clean = (value: unknown) => String(value ?? "").trim().slice(0, 200);
    const db = await readDb();
    if (!db.assets) db.assets = [];
    const index = db.assets.findIndex(
      (a) => normalize(a["Asset ID"]) === normalize(assetId)
    );

    if (index === -1) {
      return { success: false, message: "Asset not found: " + assetId };
    }

    const assetName =
      clean(input["Asset Name"] || input["Machine Name"] || (input as any).assetName || (input as any).machineName) ||
      clean(db.assets[index]["Asset Name"] || db.assets[index]["Machine Name"]);
    if (!assetName) {
      return { success: false, message: "Asset Name is required." };
    }

    const updated: Asset = { ...db.assets[index], "Asset Name": assetName, "Machine Name": assetName };
    for (const field of ASSET_FIELDS) {
      if (field === "Asset Name" || field === "Machine Name" || !(field in input)) continue;
      const value = clean(input[field]);
      if (value) {
        (updated as unknown as Record<string, string>)[field] = value;
      } else {
        delete (updated as unknown as Record<string, string>)[field];
      }
    }

    updated["Last Updated"] = new Date().toISOString();
    db.assets[index] = updated;
    saveLocalJson(db);
    invalidateDbCache();

    try {
      const { getMongoDb } = await import("./mongodb");
      const mongoDb = await getMongoDb();
      await mongoDb.collection("assets").updateOne(
        { "Asset ID": updated["Asset ID"] },
        { $set: sanitizeMongoDoc(updated) },
        { upsert: true }
      );
    } catch (err) {
      console.warn("Could not sync updated asset to Atlas", err);
    }

    return {
      success: true,
      message: "Asset details updated successfully.",
      asset: updated,
    };
  });
}

/** Machine plus its most recent maintenance/safety history, for the QR page. */
export async function getMachineProfile(assetId: string) {
  if (!assetId || !String(assetId).trim()) return null;
  const db = await readDb();
  const machine = await resolveMachine(db, assetId);
  if (!machine) return null;

  const canonId = normalize(machine["Asset ID"] || "");
  const search = normalize(assetId);

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
