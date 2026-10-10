import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  clearLoginFailures,
  createSessionToken,
  findMachineForUser,
  isMachineAuthorized,
  loginLockedFor,
  recordLoginFailure,
  sessionCookieOptions,
  toSessionUser,
} from "@/lib/auth";
import { safe } from "@/lib/api";
import { bootstrapAdmin, findUserByLogin, normalize } from "@/lib/db";
import { fakeVerify, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

export const POST = safe(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  const targetAssetId = String(body?.targetAssetId ?? "").trim();
  const next = String(body?.next ?? "").trim();

  if (!email || !password) {
    return NextResponse.json(
      { success: false, message: "Enter your User ID (or email) and password." },
      { status: 400 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const throttleKey = `${ip}|${normalize(email)}`;

  const lockedMinutes = loginLockedFor(throttleKey);
  if (lockedMinutes > 0) {
    return NextResponse.json(
      {
        success: false,
        message: `Too many failed attempts. Try again in ${lockedMinutes} minute${lockedMinutes === 1 ? "" : "s"}.`,
      },
      { status: 429 }
    );
  }

  // "email" is whatever was typed: a work email or a User ID like OP-001.
  let user = await findUserByLogin(email);

  // A sheet that has no passwords yet: ADMIN_EMAIL + ADMIN_PASSWORD can create the first admin.
  if (!user || !user["Password Hash"]) {
    const created = await bootstrapAdmin(user?.["Login Email"] || email, password);
    if (created) user = created;
  }

  const valid =
    user !== null &&
    normalize(user.Active) === "yes" &&
    verifyPassword(password, user["Password Hash"]);

  if (!user || !valid) {
    if (!user) fakeVerify(password);
    recordLoginFailure(throttleKey);
    return NextResponse.json(
      { success: false, message: "Invalid User ID / email or password." },
      { status: 401 }
    );
  }

  clearLoginFailures(throttleKey);

  const sessionUser = toSessionUser(user);

  // Strict Machine-Wise Login: If a specific machine scanner / station is targeted,
  // operators can ONLY log in to their assigned machine. Another machine CANNOT open!
  if (targetAssetId && sessionUser.role !== "Admin" && sessionUser.departmentMachine) {
    const auth = isMachineAuthorized(sessionUser, targetAssetId);
    if (!auth.allowed) {
      const assignedMachine = await findMachineForUser(sessionUser);
      return NextResponse.json(
        {
          success: false,
          unauthorizedMachine: true,
          assignedMachine: sessionUser.departmentMachine,
          assignedAssetId: assignedMachine?.["Asset ID"] || "",
          message: `🚫 Access Denied: You are assigned strictly to ${sessionUser.departmentMachine}. You can ONLY log in to and open your assigned machine. Another machine cannot be opened.`,
        },
        { status: 403 }
      );
    }
  }

  // Compute machine-wise destination
  let redirectUrl = "/";
  let unauthorizedNext = false;

  if (sessionUser.role === "Admin") {
    redirectUrl = next && next !== "/" && next !== "/login" ? next : "/admin/dashboard";
  } else if (sessionUser.role?.toLowerCase() === "supervisor") {
    redirectUrl = next && next !== "/" && next !== "/login" ? next : "/supervisor";
  } else if (sessionUser.role?.toLowerCase() === "operator" || sessionUser.departmentMachine) {
    redirectUrl = next && next !== "/" && next !== "/login" ? next : "/operator/dashboard";
  } else if (next && next !== "/" && next !== "/login") {
    redirectUrl = next;
  }

  const response = NextResponse.json({
    success: true,
    user: sessionUser,
    redirectUrl,
    unauthorizedNext,
  });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken(user["Login Email"]),
    sessionCookieOptions()
  );
  return response;
});
