"use client";

import React, { useMemo, useState } from "react";
import type { MaintenanceRecordItem } from "@/lib/maintenanceSystem";

interface MaintenanceRecordsTabProps {
  records: MaintenanceRecordItem[];
  onOpenRecordDetail: (rec: MaintenanceRecordItem) => void;
  onRefresh: () => void;
  onDeleteRecord?: (recordId: string) => Promise<void>;
  initialFilter?: string;
}

export default function MaintenanceRecordsTab({
  records,
  onOpenRecordDetail,
  onRefresh,
  onDeleteRecord,
  initialFilter,
}: MaintenanceRecordsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [machineFilter, setMachineFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState(initialFilter || "All");
  const [techFilter, setTechFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTimelineRec, setActiveTimelineRec] = useState<MaintenanceRecordItem | null>(null);
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<MaintenanceRecordItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteRecordTarget) return;
    setIsDeleting(true);
    try {
      if (onDeleteRecord) {
        await onDeleteRecord(deleteRecordTarget.recordId);
      } else {
        const res = await fetch("/api/admin/maintenance/hub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete_record", recordId: deleteRecordTarget.recordId }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to delete maintenance record");
        }
      }
      setDeleteRecordTarget(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete maintenance record");
    } finally {
      setIsDeleting(false);
    }
  };

  // Distinct lists for filters
  const uniqueMachines = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.machineName) set.add(r.machineName);
    });
    return Array.from(set).sort();
  }, [records]);

  const uniqueTechs = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.technicianName) set.add(r.technicianName);
    });
    return Array.from(set).sort();
  }, [records]);

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.maintenanceType) set.add(r.maintenanceType);
    });
    return Array.from(set).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (machineFilter !== "All" && r.machineName !== machineFilter) return false;
      if (typeFilter !== "All" && r.maintenanceType !== typeFilter) return false;
      if (techFilter !== "All" && r.technicianName !== techFilter) return false;
      if (statusFilter !== "All") {
        if (statusFilter === "Pending Approval" && r.verificationStatus !== "Pending Approval") return false;
        if (statusFilter === "Approved" && r.verificationStatus !== "Approved") return false;
        if (statusFilter === "Safety Critical" && !r.safetyReleaseAuthorized) return false;
      }
      if (dateFrom && r.reportedDate < dateFrom) return false;
      if (dateTo && r.reportedDate > dateTo) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          r.recordId.toLowerCase().includes(q) ||
          (r.requestId || "").toLowerCase().includes(q) ||
          r.assetId.toLowerCase().includes(q) ||
          r.machineName.toLowerCase().includes(q) ||
          r.problem.toLowerCase().includes(q) ||
          (r.rootCause || "").toLowerCase().includes(q) ||
          r.correctiveAction.toLowerCase().includes(q) ||
          r.technicianName.toLowerCase().includes(q) ||
          (r.verifiedBy || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [records, machineFilter, typeFilter, techFilter, statusFilter, dateFrom, dateTo, searchTerm]);


  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Workflow D: Permanent Maintenance Register & Work Order History
            </h3>
            <p className="text-xs text-slate-500">
              Auditable register of verified maintenance actions, spare parts consumption, labour, and safety sign-offs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Print Register
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
              title="Refresh register"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 pt-1 text-xs">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search Record ID, Machine, Root Cause..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13]"
            />
          </div>

          <div>
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="All">All Machines</option>
              {uniqueMachines.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="All">All Types</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Safety Critical">Safety Release Required</option>
            </select>
          </div>

          <div>
            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="All">All Technicians</option>
              {uniqueTechs.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Date Range:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
            />
          </div>
          {(dateFrom || dateTo || machineFilter !== "All" || typeFilter !== "All" || statusFilter !== "All" || techFilter !== "All" || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setMachineFilter("All");
                setTypeFilter("All");
                setStatusFilter("All");
                setTechFilter("All");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-[#880b13] font-bold hover:underline cursor-pointer text-xs ml-auto"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
                <th className="py-3 px-3">1. Record ID</th>
                <th className="py-3 px-3">2. Request ID</th>
                <th className="py-3 px-3">3. Machine ID</th>
                <th className="py-3 px-3">4. Machine Name</th>
                <th className="py-3 px-3">5. Type</th>
                <th className="py-3 px-3">6. Source</th>
                <th className="py-3 px-3">7. Reported Date</th>
                <th className="py-3 px-3">8. Repair Period</th>
                <th className="py-3 px-3 text-right">9. Repair Dur</th>
                <th className="py-3 px-3 text-right">10. Downtime</th>
                <th className="py-3 px-3">11. Technician</th>
                <th className="py-3 px-3">12. Root Cause</th>
                <th className="py-3 px-3">13. Corrective Action</th>
                <th className="py-3 px-3">14. Spare Parts</th>
                <th className="py-3 px-3 text-right">15. Cost (₹)</th>
                <th className="py-3 px-3 text-center">16. Verification</th>
                <th className="py-3 px-3">17. Approved By</th>
                <th className="py-3 px-3">18. Closure Date</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-sm font-semibold">No maintenance records found matching filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.recordId} className="hover:bg-slate-50/70 transition-colors">
                    {/* 1. Record ID */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setActiveTimelineRec(r)}
                        className="text-[#880b13] hover:underline cursor-pointer"
                      >
                        {r.recordId}
                      </button>
                    </td>

                    {/* 2. Request ID */}
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {r.requestId || <span className="text-slate-300">—</span>}
                    </td>

                    {/* 3. Machine ID */}
                    <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-800 whitespace-nowrap">
                      {r.assetId}
                    </td>

                    {/* 4. Machine Name */}
                    <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-900 max-w-xs truncate" title={r.machineName}>
                      {r.machineName}
                    </td>

                    {/* 5. Maintenance Type */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                        {r.maintenanceType}
                      </span>
                    </td>

                    {/* 6. Source */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                      {r.source || "Maintenance"}
                    </td>

                    {/* 7. Reported Date */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                      {r.reportedDate}
                    </td>

                    {/* 8. Repair Dates */}
                    <td className="py-3 px-3 whitespace-nowrap text-[11px] text-slate-600">
                      {r.repairStartDate ? (
                        <div>
                          <div>{r.repairStartDate.slice(0, 16)}</div>
                          <div className="text-slate-400 text-[10px]">to {r.repairCompletionDate ? r.repairCompletionDate.slice(0, 16) : "ongoing"}</div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* 9. Repair Duration */}
                    <td className="py-3 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                      {r.repairDurationHours !== undefined ? `${r.repairDurationHours}h` : "—"}
                    </td>

                    {/* 10. Downtime */}
                    <td className="py-3 px-3 text-right font-bold text-red-700 whitespace-nowrap">
                      {r.downtimeHours !== undefined ? `${r.downtimeHours}h` : "—"}
                    </td>

                    {/* 11. Technician */}
                    <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-800">
                      {r.technicianName}
                    </td>

                    {/* 12. Root Cause */}
                    <td className="py-3 px-3 max-w-xs truncate text-slate-600" title={r.rootCause}>
                      {r.rootCause || "Under Investigation"}
                    </td>

                    {/* 13. Corrective Action */}
                    <td className="py-3 px-3 max-w-sm truncate text-slate-800 font-medium" title={r.correctiveAction}>
                      {r.correctiveAction}
                    </td>

                    {/* 14. Spare Parts Consumed */}
                    <td className="py-3 px-3 max-w-xs truncate text-slate-600 font-mono text-[11px]" title={r.sparePartsUsed}>
                      {r.sparePartsUsed || "None"}
                    </td>

                    {/* 15. Maintenance Cost */}
                    <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {r.totalCost ? `₹${r.totalCost.toLocaleString("en-IN")}` : "₹0"}
                    </td>

                    {/* 16. Verification Status */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          r.verificationStatus === "Approved"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : r.verificationStatus === "Pending Approval"
                            ? "bg-purple-50 text-purple-800 border-purple-300 animate-pulse"
                            : "bg-red-50 text-red-800 border-red-300"
                        }`}
                      >
                        {r.verificationStatus}
                      </span>
                    </td>

                    {/* 17. Approved By */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                      {r.verifiedBy || <span className="text-slate-400 italic">Pending</span>}
                    </td>

                    {/* 18. Closure Date */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                      {r.closureDate || "—"}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveTimelineRec(r)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer transition-colors"
                          title="View Record Timeline"
                        >
                          Timeline
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteRecordTarget(r)}
                          className="p-1 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-600 transition-colors shadow-2xs cursor-pointer inline-flex items-center justify-center"
                          title="Delete Maintenance Record"
                          aria-label="Delete Maintenance Record"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Timeline View Modal */}
      {activeTimelineRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Full Maintenance Record & Audit Timeline
                </span>
                <h4 className="text-lg font-bold text-slate-900">
                  {activeTimelineRec.recordId}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveTimelineRec(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-xl"
              >
                ✕
              </button>
            </div>

            {/* General Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Machine</span>
                <span className="font-bold text-slate-900">{activeTimelineRec.machineName}</span>
                <div className="text-[10px] font-mono text-slate-500">{activeTimelineRec.assetId}</div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Maintenance Type</span>
                <span className="font-bold text-slate-800">{activeTimelineRec.maintenanceType}</span>
                <div className="text-[10px] text-slate-500">Source: {activeTimelineRec.source}</div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Downtime / Repair Duration</span>
                <span className="font-bold text-red-700">{activeTimelineRec.downtimeHours || 0} hrs downtime</span>
                <div className="text-[10px] text-slate-500">{activeTimelineRec.repairDurationHours || 0} hrs active repair</div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Verification Status</span>
                <span className="font-bold text-emerald-700">{activeTimelineRec.verificationStatus}</span>
                <div className="text-[10px] text-slate-500">By {activeTimelineRec.verifiedBy || "Supervisor"}</div>
              </div>
            </div>

            {/* Root Cause & Corrective Action */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-bold block mb-1">Problem Description:</span>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800">
                  {activeTimelineRec.problem}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 font-bold block mb-1">Identified Root Cause:</span>
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                    {activeTimelineRec.rootCause || "General component wear and tear"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block mb-1">Corrective Action Taken:</span>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 font-medium">
                    {activeTimelineRec.correctiveAction}
                  </div>
                </div>
              </div>
            </div>

            {/* Costs & Spares */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Spares Consumed:</span>
                <span className="font-mono text-slate-800 font-semibold">{activeTimelineRec.sparePartsUsed || "None"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Spare Parts Cost:</span>
                <span className="font-bold text-slate-900">₹{activeTimelineRec.sparePartsCost || 0}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Total Job Cost:</span>
                <span className="font-black text-slate-900">₹{activeTimelineRec.totalCost || 0}</span>
              </div>
            </div>

            {/* Chronological Lifecycle Timeline */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Lifecycle Milestones
              </h5>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 text-xs">
                {/* Step 1: Reported */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white"></div>
                  <div className="font-bold text-slate-800">1. Problem Flagged / Request Created</div>
                  <div className="text-slate-500 text-[11px]">{activeTimelineRec.reportedDate}</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">
                    Logged via {activeTimelineRec.source} for machine {activeTimelineRec.assetId}
                  </div>
                </div>

                {/* Step 2: Repair Start */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-white"></div>
                  <div className="font-bold text-slate-800">2. Repair Work Initiated</div>
                  <div className="text-slate-500 text-[11px]">{activeTimelineRec.repairStartDate || activeTimelineRec.reportedDate}</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">
                    Assigned technician: <strong>{activeTimelineRec.technicianName}</strong>
                  </div>
                </div>

                {/* Step 3: Repair Completion */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-purple-500 border-2 border-white"></div>
                  <div className="font-bold text-slate-800">3. Repair Completed & Test Run Evaluated</div>
                  <div className="text-slate-500 text-[11px]">{activeTimelineRec.repairCompletionDate || activeTimelineRec.reportedDate}</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">
                    Test run status: <strong className="text-emerald-700">{activeTimelineRec.testRunResult || "Passed"}</strong>. Submitted for supervisor sign-off.
                  </div>
                </div>

                {/* Step 4: Verification & Closure */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"></div>
                  <div className="font-bold text-slate-800">4. Supervisor Verification & Safety Release</div>
                  <div className="text-slate-500 text-[11px]">{activeTimelineRec.closureDate || activeTimelineRec.reportedDate}</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">
                    Verified by <strong>{activeTimelineRec.verifiedBy || "Plant Supervisor"}</strong>. Safety release confirmed: {activeTimelineRec.safetyReleaseAuthorized ? "Authorized (LOTO Cleared)" : "Not Required"}.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTimelineRec(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Record Confirmation Modal */}
      {deleteRecordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Maintenance Record</h3>
                <p className="text-xs text-slate-500">Are you sure you want to delete this record?</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1 font-mono">
              <div><span className="text-slate-500 font-sans">Record ID:</span> <span className="font-bold text-slate-800">{deleteRecordTarget.recordId}</span></div>
              <div><span className="text-slate-500 font-sans">Machine:</span> <span className="font-bold text-slate-800">{deleteRecordTarget.machineName} ({deleteRecordTarget.assetId})</span></div>
              <div><span className="text-slate-500 font-sans">Problem:</span> <span className="text-slate-700">{deleteRecordTarget.problem}</span></div>
            </div>

            <p className="text-xs text-red-600 font-medium">
              This action is permanent and cannot be undone. The record will be permanently deleted from database.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteRecordTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
