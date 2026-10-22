import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findUserByEmail, isAdminUser, normalize, permissionsFor, userHasPermission, readDb } from "./db";
import type { Machine, Permission, UserRecord } from "./types";

export const SESSION_COOKIE = "skyline_session";
const SESSION_SECONDS = 12 * 60 * 60;

export interface SessionUser {
  email: string;
  userId?: string;
  name: string;
  role: "Admin" | "Supervisor" | "Operator" | "User" | string;
  departmentMachine?: string;
  assignedMachines?: string[];
  permissions: Permission[];
}

// Shared via globalThis so every route bundle signs/verifies with one secret.
const globalSecret = globalThis as unknown as { __skylineSecret?: string };

function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (!globalSecret.__skylineSecret) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[skyline] AUTH_SECRET is not set. Using a random secret: everyone is logged out on each restart. Set AUTH_SECRET in your environment."
      );
      globalSecret.__skylineSecret = crypto.randomBytes(32).toString("hex");
    } else {
      globalSecret.__skylineSecret = "skyline-dev-only-secret";
    }
  }
  return globalSecret.__skylineSecret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + SESSION_SECONDS })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function emailFromToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof data.e !== "string" || data.x < Date.now() / 1000) return null;
    return data.e;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}

export function toSessionUser(user: UserRecord): SessionUser {
  let role: "Admin" | "Supervisor" | "Operator" | "User" | string = "User";
  if (isAdminUser(user)) {
    role = "Admin";
  } else if (normalize(user.Role) === "supervisor" || normalize(user["App Access"]) === "supervisor") {
    role = "Supervisor";
  } else if (normalize(user.Role) === "operator") {
    role = "Operator";
  }

  let assignedMachines: string[] = [];
  if (Array.isArray(user.assignedMachines)) {
    assignedMachines = user.assignedMachines.map((m) => String(m).trim()).filter(Boolean);
  } else if (user["Assigned Machines"]) {
    assignedMachines = String(user["Assigned Machines"])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return {
    email: user["Login Email"],
    userId: user["User ID"],
    name: user.Name || user["Login Email"],
    role,
    departmentMachine: user["Department / Machine"] || "",
    assignedMachines,
    permissions: permissionsFor(user),
  };
}

export function getDashboardForRole(role?: string): string {
  const r = (role || "").trim().toLowerCase();
  if (r === "admin") return "/admin";
  if (r === "supervisor") return "/supervisor";
  if (r === "operator") return "/operator/dashboard";
  return "/login";
}

const MACHINE_ABBREVIATIONS: Record<string, string[]> = {
  laser: ["lsr", "laser"],
  bending: ["bnd", "bending"],
  shearing: ["shr", "shearing", "sharing"],
  sharing: ["shr", "shearing", "sharing"],
  punching: ["pnc", "pun", "tpp", "punch"],
  punch: ["pnc", "pun", "tpp", "punch"],
  powder: ["pdr", "powder"],
  compressor: ["cmp", "acm", "compressor"],
  crane: ["crn", "eot", "crane"],
  welding: ["wld", "welding", "co2"],
  drill: ["drl", "drill"],
  oven: ["ovn", "oven"],
  stabilizer: ["stb", "stabilizer"],
  panel: ["elp", "pnl", "panel"],
  pneumatic: ["pnm", "pneumatic"],
  booth: ["spb", "booth"],
  gun: ["gun"],
  grinder: ["grd", "grander", "grinder"],
  ups: ["ups"],
};

function expandDepartmentTokens(dept: string): string[] {
  const raw = dept.toLowerCase().split(/[\s/,-]+/).filter((t) => t.length > 1 && t !== "machine");
  const set = new Set<string>(raw);
  for (const t of raw) {
    if (MACHINE_ABBREVIATIONS[t]) {
      for (const a of MACHINE_ABBREVIATIONS[t]) set.add(a);
    }
  }
  return Array.from(set);
}

/**
 * Validates whether a user is authorized to access or perform operations on a specific machine.
 * - Admins can access all machines.
 * - Operators and technicians can ONLY access machines assigned to them.
 * - Supervisors can access assigned machines + machines in their authorized scope/department.
 * - Users without assignments see a clear unauthorized message.
 */
export function isMachineAuthorized(
  user: SessionUser | null | undefined,
  machine:
    | { "Asset ID"?: string; "Machine Name"?: string; Category?: string; Department?: string; Status?: string; status?: string; assetId?: string; name?: string }
    | string
    | null
    | undefined
): { allowed: boolean; reason?: string } {
  if (!user) return { allowed: false, reason: "Please sign in to access this machine." };
  const roleLower = (user.role || "").toLowerCase();
  if (roleLower === "admin") return { allowed: true };

  if (!machine) return { allowed: false, reason: "Machine not found." };

  const machineObj =
    typeof machine === "string"
      ? { "Asset ID": machine, "Machine Name": machine, Category: "", Department: "", Status: "Active" }
      : machine;

  // Rule 9: If a machine is inactive, prevent new operational work
  const mStatus = String(machineObj.Status || (machineObj as any).status || "").toLowerCase();
  if (mStatus.includes("inact") || mStatus.includes("decomm") || mStatus.includes("disabl")) {
    return {
      allowed: false,
      reason: "This machine is currently marked Inactive. Operational work is disabled for inactive machines.",
    };
  }

  const assetId = ((machineObj["Asset ID"] || (machineObj as any).assetId || "") as string).trim().toUpperCase();
  const name = ((machineObj["Machine Name"] || (machineObj as any).name || "") as string).trim();
  const machineDept = (((machineObj as any).Department || "") as string).trim().toLowerCase();

  const assigned = (user.assignedMachines || []).map((m) => m.trim().toUpperCase());

  // 1. Direct match on assigned machine IDs or names
  if (assigned.length > 0) {
    const isDirectlyAssigned = assigned.some(
      (mId) =>
        mId === assetId ||
        mId === name.toUpperCase() ||
        (assetId && assetId.includes(mId)) ||
        (mId && assetId.includes(mId))
    );
    if (isDirectlyAssigned) {
      return { allowed: true };
    }
  }

  // 2. Supervisor authorization scope: assigned machines OR authorized department scope
  if (roleLower === "supervisor") {
    const supDept = (user.departmentMachine || "").trim().toLowerCase();
    if (!supDept || supDept === "all" || supDept === "management") {
      return { allowed: true };
    }
    const tokens = expandDepartmentTokens(supDept);
    if (
      supDept === machineDept ||
      machineDept.includes(supDept) ||
      tokens.some((t) => machineDept.includes(t) || name.toLowerCase().includes(t))
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Access Restricted: This machine is outside your authorized supervision scope (${user.departmentMachine}).`,
    };
  }

  // 3. Operators & technicians: strictly assigned machines only
  if (assigned.length === 0) {
    // Check legacy department/machine field as a graceful fallback if present
    const dept = (user.departmentMachine || "").trim().toLowerCase();
    if (dept) {
      const tokens = expandDepartmentTokens(dept);
      const matches =
        dept === name.toLowerCase() ||
        dept === assetId.toLowerCase() ||
        name.toLowerCase().includes(dept) ||
        (tokens.length > 0 && tokens.some((t) => name.toLowerCase().includes(t) || assetId.toLowerCase().includes(t)));
      if (matches) return { allowed: true };
    }
    return {
      allowed: false,
      reason: "No machines have been assigned to your account. Please contact your supervisor or administrator.",
    };
  }

  return {
    allowed: false,
    reason: `Access Restricted: You are assigned to [${user.assignedMachines?.join(", ")}]. You are not authorized for machine ${assetId || name}.`,
  };
}

/**
 * Finds all Machine records assigned to a user.
 */
export async function findMachinesForUser(user: SessionUser | UserRecord): Promise<Machine[]> {
  let machines: Machine[] = [];
  try {
    const { getMongoDb } = await import("./mongodb");
    const mongoDb = await getMongoDb();
    const rawMachines = await mongoDb.collection("machines").find({}).toArray();
    if (rawMachines && rawMachines.length > 0) {
      machines = rawMachines.map((m) => {
        const { _id, ...rest } = m;
        return rest as unknown as Machine;
      });
    }
  } catch {
    const db = await readDb();
    machines = db.machines || [];
  }

  const assignedList = "assignedMachines" in user && Array.isArray(user.assignedMachines)
    ? user.assignedMachines
    : (user as UserRecord)["Assigned Machines"]
      ? String((user as UserRecord)["Assigned Machines"]).split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  if (assignedList.length > 0) {
    const upperList = assignedList.map((id) => id.toUpperCase());
    const matched = machines.filter((m) => {
      const aid = (m["Asset ID"] || "").toUpperCase();
      const mName = (m["Machine Name"] || "").toUpperCase();
      return upperList.includes(aid) || upperList.includes(mName);
    });
    if (matched.length > 0) return matched;
  }

  // Fallback to department matching
  const single = await findMachineForUser(user);
  return single ? [single] : [];
}

/**
 * Finds the primary Machine record corresponding to an operator's assigned machine.
 */
export async function findMachineForUser(user: SessionUser | UserRecord): Promise<Machine | null> {
  let machines: Machine[] = [];
  try {
    const { getMongoDb } = await import("./mongodb");
    const mongoDb = await getMongoDb();
    const rawMachines = await mongoDb.collection("machines").find({}).toArray();
    if (rawMachines && rawMachines.length > 0) {
      machines = rawMachines.map((m) => {
        const { _id, ...rest } = m;
        return rest as unknown as Machine;
      });
    }
  } catch {
    const db = await readDb();
    machines = db.machines || [];
  }

  // 1. Check assignedMachines first
  const assignedList = "assignedMachines" in user && Array.isArray(user.assignedMachines)
    ? user.assignedMachines
    : (user as UserRecord)["Assigned Machines"]
      ? String((user as UserRecord)["Assigned Machines"]).split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  if (assignedList.length > 0) {
    const firstId = assignedList[0].trim().toUpperCase();
    const found = machines.find((m) => (m["Asset ID"] || "").toUpperCase() === firstId);
    if (found) return found;
  }

  // 2. Fallback to department/machine string matching
  const deptRaw = "departmentMachine" in user ? user.departmentMachine : (user as UserRecord)["Department / Machine"];
  const dept = String(deptRaw || "").trim().toLowerCase();
  if (!dept) return null;

  const tokens = expandDepartmentTokens(dept);

  const match = machines.find((m) => {
    const assetId = (m["Asset ID"] || "").toLowerCase();
    const name = (m["Machine Name"] || "").toLowerCase();
    const cat = (m.Category || "").toLowerCase();
    const machineDept = (m.Department || "").toLowerCase();

    return (
      dept === name ||
      dept === assetId ||
      dept === cat ||
      name.includes(dept) ||
      dept.includes(name) ||
      (tokens.length > 0 &&
        tokens.some(
          (t) => name.includes(t) || cat.includes(t) || assetId.includes(t) || machineDept.includes(t)
        ))
    );
  });

  return match ?? null;
}

/**
 * The signed-in user, or null. The account is re-read from Excel on every
 * request, so deactivating a user or changing their permissions in the
 * dashboard (or in Excel) takes effect immediately.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const email = emailFromToken(cookies().get(SESSION_COOKIE)?.value);
  if (!email) return null;

  const user = await findUserByEmail(email);
  if (!user || normalize(user.Active) !== "yes") return null;

  return toSessionUser(user);
}

type Requirement = Permission | "admin" | undefined;

/** Use in API routes: returns the user, or a ready-made 401/403 response. */
export async function requireUser(
  requirement?: Requirement
): Promise<{ user: SessionUser; error?: undefined } | { user?: undefined; error: NextResponse }> {
  const user = await getSessionUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, message: "Please log in to continue." },
        { status: 401 }
      ),
    };
  }

  const allowed =
    !requirement ||
    (requirement === "admin"
      ? user.role === "Admin"
      : user.role === "Admin" || user.permissions.includes(requirement));

  if (!allowed) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            "You are not authorized for this activity. Please contact your administrator.",
        },
        { status: 403 }
      ),
    };
  }

  return { user };
}

// --- login throttling: 5 wrong passwords => 15 minute lock (per IP + email) ---
const globalAttempts = globalThis as unknown as {
  __skylineAttempts?: Map<string, { count: number; until: number }>;
};
const attempts = (globalAttempts.__skylineAttempts ??= new Map());
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function loginLockedFor(key: string): number {
  const entry = attempts.get(key);
  if (!entry || entry.until <= Date.now()) return 0;
  return entry.count >= MAX_ATTEMPTS ? Math.ceil((entry.until - Date.now()) / 60000) : 0;
}

export function recordLoginFailure(key: string): void {
  const entry = attempts.get(key);
  const now = Date.now();
  const count = entry && entry.until > now ? entry.count + 1 : 1;
  attempts.set(key, { count, until: now + LOCK_MS });
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}

export { userHasPermission };
