import { NextRequest, NextResponse } from "next/server";
import { isMachineAuthorized, requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { findMachineByAssetId, readDb, saveMaintenanceRecord } from "@/lib/db";
import { missingRequired } from "@/lib/validate";

export const dynamic = "force-dynamic";

export const GET = safe(async () => {
  const db = await readDb();
  // Filter out routine OK checklist inspection logs
  // Keep genuine breakdown tickets, maintenance work orders, and flagged Not OK inspection issues
  const records = (db.maintenanceRecords || []).filter((r: any) => {
    const id = String(r.recordId || r["Record ID"] || "");
    const type = String(r.recordType || r["Record Type"] || r.maintenanceType || "").toLowerCase();
    const result = String(r.result || r.status || "").toUpperCase();
    if ((id.startsWith("CHK-") || type === "inspection") && (result === "OK" || result === "PASSED")) {
      return false;
    }
    return true;
  });
  return NextResponse.json({
    success: true,
    records,
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

  // Flexible extraction of assetId, problem, userId, userName
  const assetId = String(body.assetId || body["Asset ID"] || body["asset_id"] || body["Machine / Asset"] || "").trim();
  const problem = String(body.problem || body["Problem / Request"] || body["Problem"] || body.issue || body["Issue"] || body.description || body["Description"] || "").trim();
  const userId = String(body.userId || body["User ID"] || auth.user.userId || (auth.user.email ? auth.user.email.split("@")[0].toUpperCase() : "OP-001")).trim();
  const userName = String(body.userName || body["User Name"] || auth.user.name || auth.user.email || "Operator").trim();

  if (!assetId) {
    return NextResponse.json({ success: false, message: "Asset ID is required." }, { status: 400 });
  }
  if (!problem) {
    return NextResponse.json({ success: false, message: "Problem / Work Request description is required." }, { status: 400 });
  }

  const machine = await findMachineByAssetId(assetId);
  const resolvedAssetId = machine.machine?.["Asset ID"] || assetId;
  const resolvedMachineName = body.machineName || body["Machine Name"] || machine.machine?.["Machine Name"] || resolvedAssetId;

  const machineAuth = isMachineAuthorized(auth.user, machine.machine || resolvedAssetId);
  if (!machineAuth.allowed) {
    return NextResponse.json(
      { success: false, message: machineAuth.reason || "Unauthorized to submit maintenance on this machine." },
      { status: 403 }
    );
  }

  const result = await saveMaintenanceRecord({
    assetId: resolvedAssetId,
    machineName: resolvedMachineName,
    maintenanceType: body.maintenanceType || body["Maintenance Type"] || "Breakdown Maintenance",
    maintenanceDate: body.maintenanceDate || body["Date"] || new Date().toISOString().slice(0, 10),
    userId,
    userName,
    assignedTo: body.assignedTo || body["Assigned To"] || userName || "Maintenance Team",
    technicianName: body.technicianName || body["Technician Name"] || body["Submitted By"] || userName || "Pending Technician",
    priority: body.priority || body["Priority"] || "Medium",
    status: body.status || body["Status"] || "Open",
    checklistId: body.checklistId || "",
    checkPoint: body.checkPoint || "",
    problem,
    rootCause: body.rootCause || body["Root Cause"] || "",
    correctiveAction: body.correctiveAction || body["Action Taken"] || "Pending Maintenance Action",
    spareParts: body.spareParts || body["Spare Parts"] || "",
    downtime: body.downtime || body["Downtime"] || "0",
    photoEvidence: body.photoEvidence || body["Photo / Evidence"] || "",
    remarks: body.remarks || body["Remarks"] || "",
    submittedBy,
  });

  return NextResponse.json(result);
});

export const DELETE = safe(async (request: NextRequest) => {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || searchParams.get("recordId");
  if (!id) {
    return NextResponse.json(
      { success: false, message: "Record ID is required." },
      { status: 400 }
    );
  }

  const { deleteMaintenanceRecordItem } = await import("@/lib/maintenanceSystem");
  const res = await deleteMaintenanceRecordItem(id);
  return NextResponse.json(res);
});
