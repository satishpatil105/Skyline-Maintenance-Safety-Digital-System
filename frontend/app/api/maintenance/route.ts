import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { findMachineByAssetId, readDb, saveMaintenanceRecord } from "@/lib/db";
import { missingRequired } from "@/lib/validate";

export const dynamic = "force-dynamic";

export const GET = safe(async () => {
  const db = await readDb();
  return NextResponse.json({
    success: true,
    records: db.maintenanceRecords || [],
  });
});

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

  // Always the logged-in user
  const submittedBy = auth.user.email;

  // Validate core required fields only (Asset ID, User ID, User Name, Problem)
  const invalid = missingRequired(body, [
    ["assetId", "Asset ID"],
    ["userId", "User ID"],
    ["userName", "User Name"],
    ["problem", "Problem / Request"],
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
    machineName: body.machineName || machine.machine?.["Machine Name"] || body.assetId,
    maintenanceType: body.maintenanceType || "Corrective Maintenance",
    maintenanceDate: body.maintenanceDate || new Date().toISOString().slice(0, 10),
    userId: body.userId,
    userName: body.userName,
    assignedTo: body.assignedTo || body.userName || "Maintenance Team",
    technicianName: body.technicianName || body.userName || "Pending Technician",
    priority: body.priority || "Medium",
    status: body.status || "Open",
    checklistId: body.checklistId || "",
    checkPoint: body.checkPoint || "",
    problem: body.problem,
    rootCause: body.rootCause || "",
    correctiveAction: body.correctiveAction || "Pending Maintenance Action",
    spareParts: body.spareParts || "",
    downtime: body.downtime || "0",
    photoEvidence: body.photoEvidence || "",
    remarks: body.remarks || "",
    submittedBy,
  });

  return NextResponse.json(result);
});
