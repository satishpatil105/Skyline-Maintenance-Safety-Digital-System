import { NextRequest, NextResponse } from "next/server";
import { isMachineAuthorized, requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { getChecklist, listChecklistMachines, saveChecklist } from "@/lib/checklist";
import { isSunday, todayString } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Checklists are for staff who can record maintenance or safety (and Admins). */
async function requireChecklistUser() {
  const auth = await requireUser();
  if (auth.error) return auth;

  const { role, permissions } = auth.user;
  const allowed =
    role === "Admin" ||
    permissions.includes("Can Submit Maintenance") ||
    permissions.includes("Can Submit Safety");

  if (!allowed) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "You are not authorized to fill checklists. Please contact your administrator.",
        },
        { status: 403 }
      ),
    };
  }
  return auth;
}

/**
 * GET /api/checklist                          -> machines that have a checklist
 * GET /api/checklist?assetId=X                -> that machine's check points, each due or locked
 */
export const GET = safe(async (request: NextRequest) => {
  const auth = await requireChecklistUser();
  if (auth.error) return auth.error;

  const assetId = request.nextUrl.searchParams.get("assetId") || "";
  if (!assetId) {
    let machines = await listChecklistMachines();
    if (auth.user.role !== "Admin") {
      machines = machines.filter((m) => isMachineAuthorized(auth.user, m).allowed);
    }
    return NextResponse.json({
      success: true,
      isWeeklyOff: isSunday(todayString()),
      machines,
    });
  }

  const checklist = await getChecklist(assetId);
  if (!checklist) {
    return NextResponse.json({ success: false, message: `Machine not found: ${assetId}` }, { status: 404 });
  }

  const machineAuth = isMachineAuthorized(auth.user, checklist.machine);
  if (!machineAuth.allowed) {
    return NextResponse.json(
      { success: false, message: machineAuth.reason || "Unauthorized to access this machine." },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, ...checklist });
});

/** POST /api/checklist  { assetId, answers: [{ templateId, response, remarks? }] }  (answers for the DUE check points) */
export const POST = safe(async (request: NextRequest) => {
  const auth = await requireChecklistUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, message: "No checklist data received." }, { status: 400 });
  }

  const assetId = String(body.assetId ?? "");
  const targetChecklist = await getChecklist(assetId);
  if (targetChecklist) {
    const machineAuth = isMachineAuthorized(auth.user, targetChecklist.machine);
    if (!machineAuth.allowed) {
      return NextResponse.json(
        { success: false, message: machineAuth.reason || "Unauthorized to submit checklist for this machine." },
        { status: 403 }
      );
    }
  }

  // "Submitted by" is always the logged-in user, never something the browser claims.
  const result = await saveChecklist(
    { email: auth.user.email, name: auth.user.name },
    { assetId, answers: body.answers, allowRecheck: Boolean(body.allowRecheck) }
  );

  return NextResponse.json(
    { success: result.success, message: result.message, saved: result.saved, notOk: result.notOk, next: result.next },
    { status: result.status ?? (result.success ? 200 : 400) }
  );
});
