import { NextRequest, NextResponse } from "next/server";
import { safe } from "@/lib/api";
import { getDeptRecord, recordEmployeeSignature } from "@/lib/safetyDept";

export const dynamic = "force-dynamic";

/**
 * GET: Fetch record summary for mobile employee digital signature / acknowledgment.
 * Publicly accessible via unique record ID link.
 */
export const GET = safe(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get("recordId")?.trim();

  if (!recordId) {
    return NextResponse.json({ success: false, message: "Record ID is required." }, { status: 400 });
  }

  const result = await getDeptRecord(recordId);
  if (!result) {
    return NextResponse.json({ success: false, message: "Record not found or invalid link." }, { status: 404 });
  }

  const { record, category } = result;
  const v = record.values;

  // Curate display fields suitable for mobile verification
  const recordType = v["Record Type"] || category.label;
  const employeeName = v["Employee Name"] || v["Responsible Person"] || "";
  const employeeId = v["Employee ID"] || "";
  const date = record.date || v["Date"] || "";

  // Collect relevant highlights depending on type
  const highlights: { label: string; value: string }[] = [];
  if (v["Record Type"]) highlights.push({ label: "Record Type", value: v["Record Type"] });
  if (v["Training / Topic"]) highlights.push({ label: "Training Topic", value: v["Training / Topic"] });
  if (v["Trainer / Agency"]) highlights.push({ label: "Trainer / Agency", value: v["Trainer / Agency"] });
  if (v["Items Issued / Review Details"]) highlights.push({ label: "PPE / Items Issued", value: v["Items Issued / Review Details"] });
  if (v["Condition / Finding"]) highlights.push({ label: "Condition / Finding", value: v["Condition / Finding"] });
  if (v["Accident Nature / Details"]) highlights.push({ label: "Incident Details", value: v["Accident Nature / Details"] });
  if (v["Lost Time Days"]) highlights.push({ label: "Lost Time (Days)", value: v["Lost Time Days"] });
  if (v["Action Required"]) highlights.push({ label: "Action Required", value: v["Action Required"] });
  if (v["Next Due Date"]) highlights.push({ label: "Next Due / Expiry Date", value: v["Next Due Date"] });
  if (v["Target Date"]) highlights.push({ label: "Target Completion Date", value: v["Target Date"] });
  if (v["Responsible Person"] && v["Responsible Person"] !== employeeName) {
    highlights.push({ label: "Supervisor / Officer", value: v["Responsible Person"] });
  }
  if (v["Remarks"]) highlights.push({ label: "Remarks / Notes", value: v["Remarks"] });

  return NextResponse.json({
    success: true,
    record: {
      recordId: record.recordId,
      category: category.id,
      categoryLabel: category.label,
      recordType,
      employeeName,
      employeeId,
      date,
      status: record.status,
      employeeSignStatus: record.employeeSignStatus || "Pending Signature",
      employeeSignDate: record.employeeSignDate || "",
      digitalSignId: record.digitalSignId || "",
      highlights,
    },
  });
});

/**
 * POST: Employee records their digital signature (YES - Received & Accept, or NO - Not Received).
 */
export const POST = safe(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const recordId = String(body?.recordId ?? "").trim();
  const decision = String(body?.decision ?? "").trim().toLowerCase();
  const signerName = String(body?.signerName ?? "").trim();
  const remarks = String(body?.remarks ?? "").trim();

  if (!recordId) {
    return NextResponse.json({ success: false, message: "Record ID is required." }, { status: 400 });
  }

  if (decision !== "yes" && decision !== "no") {
    return NextResponse.json(
      { success: false, message: "Decision must be 'yes' (Received) or 'no' (Not Received)." },
      { status: 400 }
    );
  }

  const userAgent = request.headers.get("user-agent") || "";
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";

  const result = await recordEmployeeSignature(recordId, decision as "yes" | "no", signerName, {
    remarks,
    userAgent,
    ip,
  });

  return NextResponse.json(result, { status: result.status });
});
