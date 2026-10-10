import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR } from "./config";

/**
 * Login settings the app keeps itself, so nothing extra has to be added to
 * the spreadsheet's tables: each person's password (hashed), whether they are
 * an Admin, and the two machine permissions the sheet has no column for.
 *
 * Stored in DATA_DIR/app-access.json, keyed by lower-case login email.
 */
export interface AccessEntry {
  accessLevel: "Admin" | "User";
  passwordHash: string;
  displayPassword?: string;
  canAddMachine: boolean;
  canEditMachine: boolean;
}

export type AccessMap = Record<string, AccessEntry>;

export const ACCESS_PATH = process.env.ACCESS_FILE
  ? path.resolve(process.env.ACCESS_FILE)
  : path.join(DATA_DIR, "app-access.json");

const emailKey = (email: string) => String(email ?? "").trim().toLowerCase();

const holder = globalThis as unknown as {
  __skylineAccess?: { mtimeMs: number; size: number; map: AccessMap };
};

export async function readAccess(): Promise<AccessMap> {
  const stat = await fs.stat(ACCESS_PATH).catch(() => null);
  if (!stat) return {};

  const cached = holder.__skylineAccess;
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return structuredClone(cached.map);
  }

  try {
    const raw = JSON.parse(await fs.readFile(ACCESS_PATH, "utf-8"));
    const map: AccessMap = {};
    for (const [email, entry] of Object.entries<Partial<AccessEntry>>(raw ?? {})) {
      map[emailKey(email)] = {
        accessLevel: entry?.accessLevel === "Admin" ? "Admin" : "User",
        passwordHash: String(entry?.passwordHash ?? ""),
        displayPassword: entry?.displayPassword ? String(entry.displayPassword) : undefined,
        canAddMachine: Boolean(entry?.canAddMachine),
        canEditMachine: Boolean(entry?.canEditMachine),
      };
    }
    holder.__skylineAccess = { mtimeMs: stat.mtimeMs, size: stat.size, map };
    return structuredClone(map);
  } catch (error) {
    if (cached) return structuredClone(cached.map);
    throw new Error(
      "Could not read app-access.json (the file that holds logins): " +
        (error instanceof Error ? error.message : String(error))
    );
  }
}

/** Write atomically (temp file + rename) so a crash never corrupts logins. */
export async function writeAccess(map: AccessMap): Promise<void> {
  await fs.mkdir(path.dirname(ACCESS_PATH), { recursive: true });
  const tmp = `${ACCESS_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(map, null, 2), "utf-8");
  await fs.rename(tmp, ACCESS_PATH);
  holder.__skylineAccess = undefined;
}

export { emailKey };
