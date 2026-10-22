"use client";

import React, { useMemo, useState } from "react";
import type { MaintenanceRecordItem, MachineMTTRMetric } from "@/lib/maintenanceSystem";

interface MaintenanceReportsTabProps {
  records: MaintenanceRecordItem[];
  mttrMetrics: MachineMTTRMetric[];
}

export default function MaintenanceReportsTab({
  records,
  mttrMetrics,
}: MaintenanceReportsTabProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (typeFilter !== "All" && r.maintenanceType !== typeFilter) return false;
      if (dateFrom && r.reportedDate < dateFrom) return false;
      if (dateTo && r.reportedDate > dateTo) return false;
      return true;
    });
  }, [records, typeFilter, dateFrom, dateTo]);

  // Aggregate executive metrics
  const totalOrders = filteredRecords.length;
  const approvedOrders = filteredRecords.filter((r) => r.verificationStatus === "Approved").length;
  const pendingOrders = filteredRecords.filter((r) => r.verificationStatus === "Pending Approval").length;
  const totalDowntime = filteredRecords.reduce((acc, r) => acc + (r.downtimeHours || 0), 0);
  const totalLabourHours = filteredRecords.reduce((acc, r) => acc + (r.labourHours || 0), 0);
  const totalSparesCost = filteredRecords.reduce((acc, r) => acc + (r.sparePartsCost || 0), 0);
  const totalMaintenanceCost = filteredRecords.reduce((acc, r) => acc + (r.totalCost || 0), 0);


  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Section 14: Executive Maintenance Analytics & Cost Reports
            </h3>
            <p className="text-xs text-slate-500">
              Aggregated maintenance KPIs, downtime costs, labour consumption, and exportable registers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Print Report
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg bg-white"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg bg-white"
            />
          </div>
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
            >
              <option value="All">All Maintenance Types</option>
              <option value="Breakdown">Breakdown</option>
              <option value="Preventive">Preventive</option>
              <option value="Corrective">Corrective</option>
              <option value="Checklist Failure">Checklist Failure</option>
              <option value="AMC / Service">AMC / Service</option>
            </select>
          </div>
        </div>
      </div>

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
            Total Work Orders
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {totalOrders}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-emerald-600 font-bold block uppercase tracking-wider">
            Verified / Closed
          </span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {approvedOrders}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-purple-600 font-bold block uppercase tracking-wider">
            Pending Approval
          </span>
          <span className="text-2xl font-black text-purple-700 mt-1 block">
            {pendingOrders}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-red-600 font-bold block uppercase tracking-wider">
            Total Downtime
          </span>
          <span className="text-2xl font-black text-red-700 mt-1 block">
            {totalDowntime.toFixed(1)} hrs
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-indigo-600 font-bold block uppercase tracking-wider">
            Labour Hours
          </span>
          <span className="text-2xl font-black text-indigo-700 mt-1 block">
            {totalLabourHours.toFixed(1)} hrs
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-amber-600 font-bold block uppercase tracking-wider">
            Spare Parts Cost
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            ₹{totalSparesCost.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-600 font-bold block uppercase tracking-wider">
            Total Maintenance Cost
          </span>
          <span className="text-2xl font-black text-[#880b13] mt-1 block">
            ₹{totalMaintenanceCost.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Breakdown Report Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Filtered Maintenance Records Ledger
          </h4>
          <span className="text-xs text-slate-500 font-semibold">
            {filteredRecords.length} Records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
                <th className="py-2.5 px-3">Record ID</th>
                <th className="py-2.5 px-3">Machine</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Reported Date</th>
                <th className="py-2.5 px-3">Technician</th>
                <th className="py-2.5 px-3 text-right">Downtime</th>
                <th className="py-2.5 px-3 text-right">Labour</th>
                <th className="py-2.5 px-3 text-right">Total Cost</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRecords.slice(0, 50).map((r) => (
                <tr key={r.recordId} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{r.recordId}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{r.machineName}</td>
                  <td className="py-2.5 px-3">{r.maintenanceType}</td>
                  <td className="py-2.5 px-3 text-slate-600">{r.reportedDate}</td>
                  <td className="py-2.5 px-3">{r.technicianName}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-red-700">{r.downtimeHours || 0}h</td>
                  <td className="py-2.5 px-3 text-right">{r.labourHours || 0}h</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">₹{r.totalCost || 0}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700">{r.verificationStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
