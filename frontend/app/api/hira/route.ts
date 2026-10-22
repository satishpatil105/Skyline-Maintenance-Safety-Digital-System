import { NextRequest, NextResponse } from "next/server";
import { safe } from "@/lib/api";
import { getAllHiraRecords, computeHiraSummary, getHiraMetadata } from "@/lib/hira";

export const dynamic = "force-dynamic";

export const GET = safe(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").toLowerCase().trim();
  const department = searchParams.get("department") || "";
  const category = searchParams.get("category") || "";
  const existingLevel = searchParams.get("existingLevel") || "";
  const residualLevel = searchParams.get("residualLevel") || "";
  const status = searchParams.get("status") || "";
  const tbcOnly = searchParams.get("tbcOnly") === "true";

  const allRecords = await getAllHiraRecords();
  const summary = computeHiraSummary(allRecords);
  const metadata = await getHiraMetadata();

  let filtered = allRecords;

  if (search) {
    filtered = filtered.filter(
      (r) =>
        r.activity?.toLowerCase().includes(search) ||
        r.hazardDescription?.toLowerCase().includes(search) ||
        r.potentialConsequence?.toLowerCase().includes(search) ||
        r.existingControls?.toLowerCase().includes(search) ||
        r.additionalControls?.toLowerCase().includes(search) ||
        r.department?.toLowerCase().includes(search) ||
        r.responsiblePersonDept?.toLowerCase().includes(search) ||
        r.hiraId?.toLowerCase().includes(search)
    );
  }

  if (department) {
    filtered = filtered.filter((r) => r.department === department);
  }

  if (category) {
    filtered = filtered.filter((r) => r.hazardCategory === category);
  }

  if (existingLevel) {
    filtered = filtered.filter((r) => r.existingRiskLevel === existingLevel);
  }

  if (residualLevel) {
    filtered = filtered.filter((r) => r.residualRiskLevel === residualLevel);
  }

  if (status) {
    filtered = filtered.filter((r) => (r.actionStatus || "Open") === status);
  }

  if (tbcOnly) {
    filtered = filtered.filter((r) => r.isTbc);
  }

  return NextResponse.json({
    success: true,
    count: filtered.length,
    total: allRecords.length,
    summary,
    metadata,
    records: filtered,
  });
});
