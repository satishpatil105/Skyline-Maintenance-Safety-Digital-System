import { NextRequest, NextResponse } from "next/server";
import { isMachineAuthorized, requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { findMachineByAssetId, readDb, saveSafetyRecord } from "@/lib/db";
import { missingRequired } from "@/lib/validate";

export const dynamic = "force-dynamic";

export const GET = safe(async () => {
  const db = await readDb();
  return NextResponse.json({
    success: true,
    records: db.safetyRecords || [],
  });
});

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

  // Always the logged-in user
  const submittedBy = auth.user.email;

  // Validate core required fields only (Asset ID, User ID, User Name, Observation)
  const invalid = missingRequired(body, [
    ["assetId", "Asset ID"],
    ["userId", "User ID"],
    ["userName", "User Name"],
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

  const machineAuth = isMachineAuthorized(auth.user, machine.machine);
  if (!machineAuth.allowed) {
    return NextResponse.json(
      { success: false, message: machineAuth.reason || "Unauthorized to submit safety observation for this machine." },
      { status: 403 }
    );
  }

  const result = await saveSafetyRecord({
    observation: body.observation,
    assetId: body.assetId,
    machineName: body.machineName || machine.machine?.["Machine Name"] || body.assetId,
    userId: body.userId,
    userName: body.userName,
    inspector: body.inspector || body.userName || "Safety Auditor",
    inspectionType: body.inspectionType || "Daily Safety Inspection",
    result: body.result || "Pass",
    riskLevel: body.riskLevel || "Medium",
    immediateAction: body.immediateAction || "Under Review",
    assignedTo: body.assignedTo || body.userName || "Safety Officer",
    targetDate: body.targetDate || new Date().toISOString().slice(0, 10),
    status: body.status || "Open",
    correctiveAction: body.correctiveAction || "Pending Safety Review",
    photoEvidence: body.photoEvidence || "",
    remarks: body.remarks || "",
    submittedBy,
  });

  return NextResponse.json(result);
});
