import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { readDb } from "@/lib/db";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatMonthLabel(isoMonth: string): string {
  const [yearStr, monthStr] = isoMonth.split("-");
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || monthStr;
  return `${monthName} ${yearStr}`;
}

/** Admin-only download of the live Excel workbook (full or month-wise). */
export const GET = safe(async (request: NextRequest) => {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  const db = await readDb(); // ensures workbook exists
  const month = request.nextUrl.searchParams.get("month")?.trim();

  // If a specific month is requested (e.g. 2026-10), generate a targeted monthly report workbook
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const monthLabel = formatMonthLabel(month);
    const wb = new ExcelJS.Workbook();
    wb.creator = "Skyline Maintenance & Safety System";
    wb.created = new Date();

    const mntRecords = db.maintenanceRecords.filter((r) =>
      (r.date || r.createdAt || "").startsWith(month)
    );
    const safetyRecords = db.safetyRecords.filter((r) =>
      (r.date || r.createdAt || "").startsWith(month)
    );

    // 1. Monthly Summary Sheet
    const sumWs = wb.addWorksheet("Monthly Summary");
    sumWs.views = [{ showGridLines: true }];

    // Title Row
    sumWs.mergeCells("A1:G1");
    const titleCell = sumWs.getCell("A1");
    titleCell.value = `SKYLINE AUTOMOTIVE - MONTHLY PERFORMANCE REPORT (${monthLabel.toUpperCase()})`;
    titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15547D" } };
    sumWs.getRow(1).height = 36;

    // Subtitle Row
    sumWs.mergeCells("A2:G2");
    const subCell = sumWs.getCell("A2");
    subCell.value = `Generated on ${new Date().toLocaleDateString("en-GB", { dateStyle: "full" })} | Filtered Period: ${month}`;
    subCell.font = { italic: true, size: 10, color: { argb: "FF475569" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    sumWs.getRow(2).height = 20;

    // KPI Cards Row
    const totalMnt = mntRecords.length;
    const closedMnt = mntRecords.filter((r) =>
      /^(completed|closed|done|ok)$/i.test((r.status || r.result || "").trim())
    ).length;
    const pendingMnt = totalMnt - closedMnt;
    const fiveSRecords = mntRecords.filter((r) =>
      (r.checkPoint || "").toLowerCase().includes("1s") ||
      (r.checkPoint || "").toLowerCase().includes("2s") ||
      (r.checkPoint || "").toLowerCase().includes("3s") ||
      (r.checkPoint || "").toLowerCase().includes("4s") ||
      (r.checkPoint || "").toLowerCase().includes("5s") ||
      (r.checklistId || "").toUpperCase().startsWith("5S-")
    );
    const fiveSPassed = fiveSRecords.filter((r) =>
      /^(ok|pass|passed|yes)$/i.test((r.result || "").trim())
    ).length;
    const fiveSCompliance = fiveSRecords.length > 0 ? Math.round((fiveSPassed / fiveSRecords.length) * 100) : 100;
    const totalSafety = safetyRecords.length;

    sumWs.addRow([]);
    const kpiHeader = sumWs.addRow([
      "Total Inspections / PM",
      "Completed & Closed",
      "Pending Action",
      "5S Audits Performed",
      "5S Compliance Rate",
      "Safety Audits",
      "Overall Machine Health",
    ]);
    kpiHeader.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    kpiHeader.alignment = { horizontal: "center", vertical: "middle" };
    kpiHeader.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    const kpiValues = sumWs.addRow([
      totalMnt,
      closedMnt,
      pendingMnt,
      fiveSRecords.length,
      `${fiveSCompliance}%`,
      totalSafety,
      pendingMnt === 0 ? "100% Optimal" : `${Math.round(((totalMnt - pendingMnt) / Math.max(totalMnt, 1)) * 100)}% Good`,
    ]);
    kpiValues.font = { bold: true, size: 12 };
    kpiValues.alignment = { horizontal: "center", vertical: "middle" };
    kpiValues.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
    sumWs.getRow(5).height = 28;

    // Machine-wise breakdown
    sumWs.addRow([]);
    const tableHeader = sumWs.addRow([
      "Asset ID",
      "Machine Name",
      "Category",
      "Month Inspections",
      "Completed",
      "Open Issues",
      "5S Check Status",
    ]);
    tableHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    tableHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    db.machines.forEach((m) => {
      const mId = m["Asset ID"];
      const machineMnt = mntRecords.filter((r) => r.assetId === mId);
      const mClosed = machineMnt.filter((r) => /^(completed|closed|done|ok)$/i.test((r.status || r.result || "").trim())).length;
      const mOpen = machineMnt.length - mClosed;
      const m5s = machineMnt.filter((r) => (r.checklistId || "").startsWith("5S-"));

      sumWs.addRow([
        mId,
        m["Machine Name"] || "",
        m["Category"] || "",
        machineMnt.length,
        mClosed,
        mOpen,
        m5s.length > 0 ? `${m5s.length} Points Verified` : "Pending Inspection",
      ]);
    });

    sumWs.columns.forEach((col) => {
      col.width = 22;
    });
    sumWs.getColumn(2).width = 30;

    // 2. Month Maintenance Records
    const mntWs = wb.addWorksheet(`Maintenance (${month})`);
    const mntHeaders = [
      "Record ID", "Date", "Asset ID", "Machine Name", "User Name", "Checklist ID",
      "Check Point", "Result", "Priority", "Status", "Action Taken", "Remarks"
    ];
    const mntHRow = mntWs.addRow(mntHeaders);
    mntHRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    mntHRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD97706" } };
    mntRecords.forEach((r) => {
      mntWs.addRow([
        r.recordId, r.date, r.assetId, r.machineName, r.userName, r.checklistId,
        r.checkPoint, r.result, r.priority, r.status, r.correctiveAction, r.remarks
      ]);
    });
    mntWs.columns.forEach((col) => { col.width = 18; });
    mntWs.getColumn(4).width = 26;
    mntWs.getColumn(7).width = 40;
    mntWs.views = [{ state: "frozen", ySplit: 1 }];

    // 3. Month Safety Records
    const safetyWs = wb.addWorksheet(`Safety (${month})`);
    const safetyHeaders = [
      "Record ID", "Date", "Asset ID", "Machine Name", "Inspector", "Safety Type",
      "Observation", "Risk Level", "Immediate Action", "Status", "Remarks"
    ];
    const safHRow = safetyWs.addRow(safetyHeaders);
    safHRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    safHRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    safetyRecords.forEach((r) => {
      safetyWs.addRow([
        r.recordId, r.date, r.assetId, r.machineName, r.inspector, r.safetyType,
        r.observation, r.riskLevel, r.immediateAction, r.status, r.remarks
      ]);
    });
    safetyWs.columns.forEach((col) => { col.width = 18; });
    safetyWs.getColumn(4).width = 26;
    safetyWs.getColumn(7).width = 36;
    safetyWs.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Skyline_Monthly_Data_${month}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: download live Excel workbook generated directly from MongoDB data
  const fullWb = new ExcelJS.Workbook();
  fullWb.creator = "Skyline Maintenance & Safety System";
  fullWb.created = new Date();

  // 1. Machines Sheet
  const mcWs = fullWb.addWorksheet("Machines");
  mcWs.addRow(["Asset ID", "Machine Name", "Category", "Department", "Location", "Make", "Model", "Serial No.", "Status", "PM Frequency"]);
  db.machines.forEach((m) => {
    mcWs.addRow([
      m["Asset ID"], m["Machine Name"], m.Category || "", m.Department || "", m.Location || "",
      m.Make || "", m.Model || "", m["Serial No."] || "", m.Status || "", m["PM Frequency"] || ""
    ]);
  });

  // 2. Maintenance Records Sheet
  const mntWs = fullWb.addWorksheet("Maintenance Records");
  mntWs.addRow(["Record ID", "Date", "Asset ID", "Machine Name", "Type", "Priority", "Status", "Problem", "Root Cause", "Action"]);
  db.maintenanceRecords.forEach((r) => {
    mntWs.addRow([
      r.recordId, r.date, r.assetId, r.machineName, r.recordType, r.priority, r.status, r.problem, r.rootCause, r.correctiveAction
    ]);
  });

  // 3. Safety Records Sheet
  const safWs = fullWb.addWorksheet("Safety Records");
  safWs.addRow(["Record ID", "Date", "Asset ID", "Machine Name", "Inspector", "Type", "Observation", "Risk Level", "Status"]);
  db.safetyRecords.forEach((s) => {
    safWs.addRow([
      s.recordId, s.date, s.assetId, s.machineName, s.inspector, s.safetyType, s.observation, s.riskLevel, s.status
    ]);
  });

  const fullBuffer = await fullWb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(fullBuffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Skyline_Database_Export_${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});
