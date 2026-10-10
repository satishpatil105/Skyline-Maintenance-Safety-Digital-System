import { emailKey, readAccess, writeAccess } from "./access";
import { withDbLock } from "./db";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "./password";

export interface PasswordResult {
  success: boolean;
  message: string;
  status: number;
}

const refuse = (message: string, status = 400): PasswordResult => ({ success: false, message, status });

/**
 * Let a signed-in person change their own password. The current password must
 * be right (so a borrowed, unlocked phone can't be used to take over the
 * account). The change is saved in the app's login file, not in the workbook.
 */
export function changeOwnPassword(
  email: string,
  current: string,
  next: string
): Promise<PasswordResult> {
  return withDbLock(async () => {
    if (next.length < MIN_PASSWORD_LENGTH) {
      return refuse(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (next === current) return refuse("The new password must be different from the current one.");

    const access = await readAccess();
    const key = emailKey(email);
    const entry = access[key];

    if (!entry?.passwordHash || !verifyPassword(current, entry.passwordHash)) {
      return refuse("The current password is not correct.", 403);
    }

    access[key] = { ...entry, passwordHash: hashPassword(next) };
    await writeAccess(access);
    return { success: true, message: "Password changed. Use the new one next time you log in.", status: 200 };
  });
}
