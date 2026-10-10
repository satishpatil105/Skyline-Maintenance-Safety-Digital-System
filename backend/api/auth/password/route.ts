import { NextRequest, NextResponse } from "next/server";
import { changeOwnPassword } from "@/lib/account";
import { clearLoginFailures, loginLockedFor, recordLoginFailure, requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/auth/password  { current, next }: change your own password. */
export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");
  if (!current || !next) {
    return NextResponse.json({ success: false, message: "Enter your current and new password." }, { status: 400 });
  }

  // Guessing the current password is throttled just like logging in.
  const key = `password|${auth.user.email.toLowerCase()}`;
  const locked = loginLockedFor(key);
  if (locked > 0) {
    return NextResponse.json(
      { success: false, message: `Too many wrong attempts. Try again in ${locked} minute${locked === 1 ? "" : "s"}.` },
      { status: 429 }
    );
  }

  const result = await changeOwnPassword(auth.user.email, current, next);
  if (result.status === 403) recordLoginFailure(key);
  else if (result.success) clearLoginFailures(key);

  return NextResponse.json({ success: result.success, message: result.message }, { status: result.status });
});
