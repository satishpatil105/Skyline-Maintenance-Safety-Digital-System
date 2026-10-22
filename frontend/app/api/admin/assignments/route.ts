import { NextRequest, NextResponse } from "next/server";
import { safe } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  getAllAssignments,
  assignMachineToUser,
  removeMachineAssignment,
  syncUserAssignedMachines,
  syncMachineAssignedUsers,
} from "@/lib/assignments";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/assignments
 * Query params: ?userId=OP-001 or ?assetId=SKY-LSR-MCH-001 or ?status=Active
 */
export const GET = safe(async (request: NextRequest) => {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const url = request.nextUrl;
  const userId = url.searchParams.get("userId") || undefined;
  const assetId = url.searchParams.get("assetId") || undefined;
  const status = (url.searchParams.get("status") as "Active" | "Removed") || undefined;

  // Non-admins can only see their own assignments
  const effectiveUserId = auth.user.role === "Admin" ? userId : (auth.user.userId || auth.user.email);

  const assignments = await getAllAssignments({
    userId: effectiveUserId,
    assetId,
    status,
  });

  return NextResponse.json({
    success: true,
    total: assignments.length,
    assignments,
  });
});

/**
 * POST /api/admin/assignments
 * Body:
 * 1. Single assign: { action: "assign", userId: "OP-001", assetId: "SKY-LSR-MCH-001" }
 * 2. Sync user: { action: "syncUser", userId: "OP-001", machineIds: ["SKY-LSR-MCH-001", "SKY-BND-MCH-001"] }
 * 3. Sync machine: { action: "syncMachine", assetId: "SKY-LSR-MCH-001", userIds: ["OP-001", "OP-002"] }
 */
export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, message: "Invalid request payload." }, { status: 400 });
  }

  const action = String(body.action || "assign").trim();
  const actor = auth.user.email || auth.user.userId || "Administrator";

  if (action === "assign") {
    const userId = String(body.userId || "").trim();
    const assetId = String(body.assetId || "").trim();

    if (!userId || !assetId) {
      return NextResponse.json(
        { success: false, message: "Both userId and assetId are required." },
        { status: 400 }
      );
    }

    const result = await assignMachineToUser(userId, assetId, actor);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  if (action === "syncUser") {
    const userId = String(body.userId || "").trim();
    const machineIds = Array.isArray(body.machineIds) ? body.machineIds : [];

    if (!userId) {
      return NextResponse.json({ success: false, message: "userId is required." }, { status: 400 });
    }

    const result = await syncUserAssignedMachines(userId, machineIds, actor);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  if (action === "syncMachine") {
    const assetId = String(body.assetId || "").trim();
    const userIds = Array.isArray(body.userIds) ? body.userIds : [];

    if (!assetId) {
      return NextResponse.json({ success: false, message: "assetId is required." }, { status: 400 });
    }

    const result = await syncMachineAssignedUsers(assetId, userIds, actor);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  return NextResponse.json(
    { success: false, message: `Unsupported action "${action}".` },
    { status: 400 }
  );
});

/**
 * DELETE /api/admin/assignments
 * Query params or Body: { userId, assetId }
 */
export const DELETE = safe(async (request: NextRequest) => {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  const url = request.nextUrl;
  let userId = url.searchParams.get("userId");
  let assetId = url.searchParams.get("assetId");

  if (!userId || !assetId) {
    const body = await request.json().catch(() => null);
    if (body) {
      userId = userId || body.userId;
      assetId = assetId || body.assetId;
    }
  }

  if (!userId || !assetId) {
    return NextResponse.json(
      { success: false, message: "Both userId and assetId are required to remove an assignment." },
      { status: 400 }
    );
  }

  const actor = auth.user.email || auth.user.userId || "Administrator";
  const result = await removeMachineAssignment(userId, assetId, actor);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
});
