import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { findMachineByAssetId, saveSafetyRecord } from "@/lib/db";
import { missingRequired } from "@/lib/validate";

export const dynamic = "force-dynamic";

export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser("Can Submit Safety");
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { success: false, message: "No safety data received." },
      { status: 400 }
    );
  }

  // Always the logged-in user, never something the browser claims.
  const submittedBy = auth.user.email;

  const invalid = missingRequired(body, [
    ["userId", "User ID"],
    ["userName", "User Name"],
    ["inspectionType", "Safety Type"],
    ["inspector", "Inspector Name"],
    ["result", "Inspection Result"],
    ["riskLevel", "Risk Level"],
    ["status", "Status"],
    ["assignedTo", "Assigned To"],
    ["observation", "Observation / Issue"],
  ]);
  if (invalid) {
    return NextResponse.json({ success: false, message: invalid }, { status: 400 });
  }

  const machine = await findMachineByAssetId(body.assetId);
  if (!machine.success) {
    return NextResponse.json(
      { success: false, message: machine.message },
      { status: 404 }
    );
  }

  const result = await saveSafetyRecord({
    observation: body.observation,
    assetId: body.assetId,
    machineName: body.machineName,
    userId: body.userId,
    userName: body.userName,
    inspector: body.inspector,
    inspectionType: body.inspectionType,
    result: body.result,
    riskLevel: body.riskLevel,
    immediateAction: body.immediateAction,
    assignedTo: body.assignedTo,
    targetDate: body.targetDate,
    status: body.status,
    correctiveAction: body.correctiveAction,
    photoEvidence: body.photoEvidence,
    remarks: body.remarks,
    submittedBy,
  });

  return NextResponse.json(result);
});
