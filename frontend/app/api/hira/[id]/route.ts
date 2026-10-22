import { NextRequest, NextResponse } from "next/server";
import { safe } from "@/lib/api";
import { getMongoDb } from "@/lib/mongodb";
import { getSessionUser } from "@/lib/auth";
import {
  validateRating,
  calculateRiskScore,
  calculateRiskLevel,
  HiraRecord,
} from "@/lib/hira";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export const GET = safe(async (_req: NextRequest, ctx: Ctx) => {
  const id = ctx.params.id;
  const db = await getMongoDb();
  const col = db.collection<HiraRecord>("hira");

  const query = isNaN(Number(id))
    ? { hiraId: id }
    : { $or: [{ srNo: Number(id) }, { hiraId: id }] };

  const record = await col.findOne(query);
  if (!record) {
    return NextResponse.json({ success: false, message: "HIRA record not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, record });
});

export const PATCH = safe(async (request: NextRequest, ctx: Ctx) => {
  const user = await getSessionUser();
  const changedBy = user ? `${user.name} (${user.userId || user.email})` : "Authorized User";

  const id = ctx.params.id;
  const body = await request.json().catch(() => ({}));

  const db = await getMongoDb();
  const col = db.collection<HiraRecord>("hira");

  const query = isNaN(Number(id))
    ? { hiraId: id }
    : { $or: [{ srNo: Number(id) }, { hiraId: id }] };

  const existing = await col.findOne(query);
  if (!existing) {
    return NextResponse.json({ success: false, message: "HIRA record not found" }, { status: 404 });
  }

  const updates: Partial<HiraRecord> = {
    updatedAt: new Date().toISOString(),
  };

  // 1. Recalculate Existing Risk Ratings if provided
  let existingL = existing.existingLikelihood;
  let existingS = existing.existingSeverity;
  let recalcExisting = false;

  if (body.existingLikelihood !== undefined) {
    existingL = validateRating(body.existingLikelihood);
    updates.existingLikelihood = existingL;
    recalcExisting = true;
  }
  if (body.existingSeverity !== undefined) {
    existingS = validateRating(body.existingSeverity);
    updates.existingSeverity = existingS;
    recalcExisting = true;
  }
  if (recalcExisting) {
    const score = calculateRiskScore(existingL, existingS);
    updates.existingRiskScore = score;
    updates.existingRiskLevel = calculateRiskLevel(score);
  }

  // 2. Recalculate Residual Risk Ratings if provided
  let residualL = existing.residualLikelihood;
  let residualS = existing.residualSeverity;
  let recalcResidual = false;

  if (body.residualLikelihood !== undefined) {
    residualL = validateRating(body.residualLikelihood);
    updates.residualLikelihood = residualL;
    recalcResidual = true;
  }
  if (body.residualSeverity !== undefined) {
    residualS = validateRating(body.residualSeverity);
    updates.residualSeverity = residualS;
    recalcResidual = true;
  }
  if (recalcResidual) {
    const resScore = calculateRiskScore(residualL, residualS);
    updates.residualRiskScore = resScore;
    updates.residualRiskLevel = calculateRiskLevel(resScore);
  }

  // 3. Update narrative/fields if authorized
  if (body.additionalControls !== undefined) {
    updates.additionalControls = String(body.additionalControls).trim();
  }
  if (body.responsiblePersonDept !== undefined) {
    updates.responsiblePersonDept = String(body.responsiblePersonDept).trim();
  }
  if (body.targetTimeframe !== undefined) {
    updates.targetTimeframe = String(body.targetTimeframe).trim();
  }

  // 4. Action Tracking updates
  const actionTracking = existing.actionTracking || {
    assignedTo: existing.responsiblePersonDept,
    targetTimeframe: existing.targetTimeframe,
    targetDate: null,
    actualCompletionDate: null,
    completionEvidence: null,
    progressRemarks: null,
    auditTrail: [],
  };

  const prevStatus = existing.actionStatus || "Open";
  const newStatus = body.actionStatus || prevStatus;

  if (body.actionStatus && ["Open", "In Progress", "Closed"].includes(body.actionStatus)) {
    updates.actionStatus = body.actionStatus;
  }

  if (body.targetDate !== undefined) {
    actionTracking.targetDate = body.targetDate;
  }
  if (body.actualCompletionDate !== undefined) {
    actionTracking.actualCompletionDate = body.actualCompletionDate;
  }
  if (body.completionEvidence !== undefined) {
    actionTracking.completionEvidence = body.completionEvidence;
  }
  if (body.progressRemarks !== undefined) {
    actionTracking.progressRemarks = body.progressRemarks;
  }

  // Audit Trail entry
  const remarks = body.remarks || body.progressRemarks || (prevStatus !== newStatus ? `Status updated from ${prevStatus} to ${newStatus}` : "Record updated");
  actionTracking.auditTrail = actionTracking.auditTrail || [];
  actionTracking.auditTrail.push({
    changedBy,
    changeDate: new Date().toISOString(),
    previousStatus: prevStatus,
    newStatus,
    remarks,
  });

  updates.actionTracking = actionTracking;

  // Persist to MongoDB Atlas
  await col.updateOne(query, { $set: updates });

  // Also sync to skyms database if client can access it
  try {
    const client = (db as any).client || (global as any)._mongoClient;
    if (client) {
      await client.db("skyms").collection("hira").updateOne(query, { $set: updates });
    }
  } catch {}

  const updatedDoc = await col.findOne(query);

  return NextResponse.json({
    success: true,
    message: "HIRA record updated successfully.",
    record: updatedDoc,
  });
});
