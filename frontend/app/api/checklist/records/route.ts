import { NextRequest, NextResponse } from "next/server";
import { safe } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import type { ChecklistRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/checklist/records
 * Returns list of checklist inspection and scheduled records.
 * Query params:
 *   - startDate: YYYY-MM-DD (e.g. "2026-09-18")
 *   - endDate: YYYY-MM-DD (e.g. "2026-10-21")
 *   - assetId / machine: filter by machine asset ID or name
 *   - status: "all", "completed", "ok", "not_ok", "pending", "overdue", "unverified"
 *   - frequency: "Daily", "Weekly", "Monthly", etc.
 *   - operator: filter by operator name
 *   - category / type: filter by checklist category/type
 *   - search: text search across recordId, checkPoint, machineName, operator, remarks
 */
export const GET = safe(async (request: NextRequest) => {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = (searchParams.get("startDate") || "").trim();
  const endDate = (searchParams.get("endDate") || "").trim();
  const assetId = (searchParams.get("assetId") || searchParams.get("machine") || "").trim().toLowerCase();
  const status = (searchParams.get("status") || "").trim().toLowerCase();
  const frequency = (searchParams.get("frequency") || "").trim().toLowerCase();
  const operator = (searchParams.get("operator") || "").trim().toLowerCase();
  const category = (searchParams.get("category") || searchParams.get("type") || "").trim().toLowerCase();
  const search = (searchParams.get("search") || "").trim().toLowerCase();

  const db = await readDb();
  let allRecords: ChecklistRecord[] = (db.checklistRecords || []).slice();

  // Sort descending by date / createdAt (newest first)
  allRecords.sort((a, b) => {
    const timeA = new Date(a.date || a.createdAt || "").getTime() || 0;
    const timeB = new Date(b.date || b.createdAt || "").getTime() || 0;
    if (timeB !== timeA) return timeB - timeA;
    return String(a.recordId).localeCompare(String(b.recordId));
  });

  // Base range: filter by date range if provided (defaults to full period if not provided)
  let dateFiltered = allRecords;
  if (startDate) {
    dateFiltered = dateFiltered.filter((r) => (r.date || "") >= startDate);
  }
  if (endDate) {
    dateFiltered = dateFiltered.filter((r) => (r.date || "") <= endDate);
  }

  // Calculate distinct lists for dropdowns from dateFiltered
  const uniqueMachines = Array.from(new Set(dateFiltered.map((r) => `${r.machineName || ""} (${r.assetId || ""})`.trim()).filter(Boolean))).sort();
  const uniqueOperators = Array.from(new Set(dateFiltered.map((r) => r.operator || r.userName).filter(Boolean))).sort();
  const uniqueCategories = Array.from(new Set(dateFiltered.map((r) => r.category).filter(Boolean))).sort();

  // Known Sundays within 18 Sep 2026 to 21 Oct 2026
  const SUNDAYS = new Set([
    "2026-09-20",
    "2026-09-27",
    "2026-10-04",
    "2026-10-11",
    "2026-10-18",
  ]);

  // Sunday weekly off rules:
  // Routine daily checklists are never generated for Sundays and excluded from totals.
  const isSundayRecord = (r: ChecklistRecord) => {
    if (r.isSunday) return true;
    if (r.date && SUNDAYS.has(r.date) && (r.frequency || "").toLowerCase() === "daily") return true;
    return false;
  };

  // Stats calculation over the date-filtered window
  const validScheduled = dateFiltered.filter((r) => !isSundayRecord(r));
  const totalScheduled = validScheduled.length;
  
  const okCount = validScheduled.filter((r) => {
    const s = String(r.status || r.response || "").toUpperCase();
    return s === "OK" || s === "PASSED";
  }).length;

  const notOkCount = validScheduled.filter((r) => {
    const s = String(r.status || r.response || "").toUpperCase();
    return s === "NOT OK" || s === "FAILED" || s === "DEFECT";
  }).length;

  const pendingCount = validScheduled.filter((r) => {
    const s = String(r.status || "").toUpperCase();
    return s === "PENDING";
  }).length;

  const overdueCount = validScheduled.filter((r) => {
    const s = String(r.status || "").toUpperCase();
    return s === "OVERDUE";
  }).length;

  const completedCount = okCount + notOkCount;
  const completionPercentage = totalScheduled > 0 ? Number(((completedCount / totalScheduled) * 100).toFixed(1)) : 0;
  const unverifiedCount = validScheduled.filter((r) => r.requiresVerification || r.isHistoricalScheduled).length;

  const stats = {
    totalScheduled,
    completedCount,
    okCount,
    notOkCount,
    pendingCount,
    overdueCount,
    unverifiedCount,
    completionPercentage,
    sundaysExcludedCount: SUNDAYS.size,
    machinesCovered: uniqueMachines.length,
    dateRange: {
      startDate: startDate || "2026-09-18",
      endDate: endDate || "2026-10-21",
      totalDays: 34,
      workingDays: 29,
      sundayWeeklyOffs: 5,
    },
  };

  // Now apply UI filters to records array
  let filteredRecords = dateFiltered;

  // Filter by assetId / machine
  if (assetId && assetId !== "all") {
    filteredRecords = filteredRecords.filter((r) => {
      const a = (r.assetId || "").toLowerCase();
      const m = (r.machineName || "").toLowerCase();
      const combined = `${m} (${a})`.toLowerCase();
      return a === assetId || a.includes(assetId) || m.includes(assetId) || combined.includes(assetId);
    });
  }

  // Filter by operator
  if (operator && operator !== "all") {
    filteredRecords = filteredRecords.filter((r) => {
      const op = String(r.operator || r.userName || "").toLowerCase();
      return op.includes(operator);
    });
  }

  // Filter by category / type
  if (category && category !== "all") {
    filteredRecords = filteredRecords.filter((r) => {
      const c = (r.category || "").toLowerCase();
      return c.includes(category);
    });
  }

  // Filter by frequency
  if (frequency && frequency !== "all") {
    filteredRecords = filteredRecords.filter((r) => (r.frequency || "").toLowerCase() === frequency);
  }

  // Filter by status
  if (status && status !== "all") {
    filteredRecords = filteredRecords.filter((r) => {
      const s = String(r.status || r.response || "").toLowerCase();
      if (status === "ok") return s === "ok" || s === "passed";
      if (status === "not_ok" || status === "not ok") return s === "not ok" || s === "failed";
      if (status === "pending") return s === "pending";
      if (status === "overdue") return s === "overdue";
      if (status === "completed") return s === "ok" || s === "passed" || s === "not ok" || s === "failed";
      if (status === "unverified") return Boolean(r.requiresVerification || r.isHistoricalScheduled);
      return s.includes(status);
    });
  }

  // Filter by search query
  if (search) {
    filteredRecords = filteredRecords.filter((r) => {
      const text = [
        r.recordId,
        r.submissionId,
        r.assetId,
        r.machineName,
        r.checkPoint,
        r.category,
        r.standardRequirement,
        r.remarks,
        r.actionIfNotOk,
        r.operator,
        r.userName,
        r.submittedBy,
        r.maintenanceTicketId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(search);
    });
  }

  return NextResponse.json({
    success: true,
    total: filteredRecords.length,
    stats,
    uniqueMachines,
    uniqueOperators,
    uniqueCategories,
    records: filteredRecords,
  });
});
