import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { findMachineByAssetId, saveMaintenanceRecord } from "@/lib/db";
import { missingRequired } from "@/lib/validate";

export const dynamic = "force-dynamic";

export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser("Can Submit Maintenance");
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { success: false, message: "No maintenance data received." },
      { status: 400 }
    );
  }

  // Always the logged-in user, never something the browser claims.
  const submittedBy = auth.user.email;

  const invalid = missingRequired(body, [
    ["userId", "User ID"],
    ["userName", "User Name"],
    ["assignedTo", "Assigned To"],
    ["technicianName", "Technician Name"],
    ["maintenanceType", "Maintenance Type"],
    ["maintenanceDate", "Maintenance Date"],
    ["priority", "Priority"],
    ["status", "Status"],
    ["problem", "Problem / Request"],
    ["correctiveAction", "Corrective Action"],
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

  const result = await saveMaintenanceRecord({
    assetId: body.assetId,
    machineName: body.machineName,
    maintenanceType: body.maintenanceType,
    maintenanceDate: body.maintenanceDate,
    userId: body.userId,
    userName: body.userName,
    assignedTo: body.assignedTo,
    technicianName: body.technicianName,
    priority: body.priority,
    status: body.status,
    checklistId: body.checklistId,
    checkPoint: body.checkPoint,
    problem: body.problem,
    rootCause: body.rootCause,
    correctiveAction: body.correctiveAction,
    spareParts: body.spareParts,
    downtime: body.downtime,
    photoEvidence: body.photoEvidence,
    remarks: body.remarks,
    submittedBy,
  });

  return NextResponse.json(result);
});
