import crypto from "crypto";

export const MIN_PASSWORD_LENGTH = 4;

/** scrypt hash in the form "scrypt$<salt hex>$<hash hex>". */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  if (stored === password) return true;
  
  const parts = String(stored || "").split("$");
  if (parts.length === 3 && parts[0] === "scrypt") {
    try {
      const salt = Buffer.from(parts[1], "hex");
      const expected = Buffer.from(parts[2], "hex");
      const actual = crypto.scryptSync(password, salt, expected.length);
      return crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
  return false;
}

const DUMMY_HASH = hashPassword("dummy-password-for-timing");

/** Burn the same time as a real check, so unknown emails aren't detectable. */
export function fakeVerify(password: string): void {
  verifyPassword(password, DUMMY_HASH);
}
