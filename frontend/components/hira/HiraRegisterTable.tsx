"use client";

import React, { useState, useMemo } from "react";
import type { HiraRecord } from "@/lib/hira";

interface HiraRegisterTableProps {
  records: HiraRecord[];
  onUpdateRecord?: (rec: HiraRecord) => void;
  canEdit?: boolean;
}

export default function HiraRegisterTable({
  records,
  onUpdateRecord,
  canEdit = true,
}: HiraRegisterTableProps) {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedExistingLevel, setSelectedExistingLevel] = useState("");
  const [selectedResidualLevel, setSelectedResidualLevel] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [filterTbc, setFilterTbc] = useState(false);

  const [activeRecord, setActiveRecord] = useState<HiraRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [actionModalRecord, setActionModalRecord] = useState<HiraRecord | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Sorting
  const [sortField, setSortField] = useState<"srNo" | "existingRiskScore" | "residualRiskScore">("srNo");
  const [sortAsc, setSortAsc] = useState(true);

  // Departments & Categories
  const departments = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => r.department && s.add(r.department));
    return Array.from(s).sort();
  }, [records]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => r.hazardCategory && s.add(r.hazardCategory));
    return Array.from(s).sort();
  }, [records]);

  // Filtered and Sorted Records
  const filtered = useMemo(() => {
    return records
      .filter((r) => {
        if (search) {
          const q = search.toLowerCase();
          const match =
            r.activity?.toLowerCase().includes(q) ||
            r.hazardDescription?.toLowerCase().includes(q) ||
            r.potentialConsequence?.toLowerCase().includes(q) ||
            r.existingControls?.toLowerCase().includes(q) ||
            r.additionalControls?.toLowerCase().includes(q) ||
            r.department?.toLowerCase().includes(q) ||
            r.responsiblePersonDept?.toLowerCase().includes(q) ||
            r.hiraId?.toLowerCase().includes(q);
          if (!match) return false;
        }
        if (selectedDept && r.department !== selectedDept) return false;
        if (selectedCat && r.hazardCategory !== selectedCat) return false;
        if (selectedExistingLevel && r.existingRiskLevel !== selectedExistingLevel) return false;
        if (selectedResidualLevel && r.residualRiskLevel !== selectedResidualLevel) return false;
        if (selectedStatus && (r.actionStatus || "Open") !== selectedStatus) return false;
        if (filterTbc && !r.isTbc) return false;
        return true;
      })
      .sort((a, b) => {
        const mul = sortAsc ? 1 : -1;
        if (sortField === "existingRiskScore") {
          return (a.existingRiskScore - b.existingRiskScore) * mul;
        }
        if (sortField === "residualRiskScore") {
          return (a.residualRiskScore - b.residualRiskScore) * mul;
        }
        return (a.srNo - b.srNo) * mul;
      });
  }, [
    records,
    search,
    selectedDept,
    selectedCat,
    selectedExistingLevel,
    selectedResidualLevel,
    selectedStatus,
    filterTbc,
    sortField,
    sortAsc,
  ]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const getLevelBadge = (level: string, score: number) => {
    if (level === "Very High") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-950 font-black text-xs border border-rose-300">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          {score} • {level}
        </span>
      );
    }
    if (level === "High") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-950 font-bold text-xs border border-orange-300">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />
          {score} • {level}
        </span>
      );
    }
    if (level === "Medium") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 font-bold text-xs border border-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          {score} • {level}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-950 font-bold text-xs border border-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        {score} • {level}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = status || "Open";
    if (s === "Closed") {
      return <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">Closed</span>;
    }
    if (s === "In Progress") {
      return <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">In Progress</span>;
    }
    return <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[11px]">Open</span>;
  };

  const resetFilters = () => {
    setSearch("");
    setSelectedDept("");
    setSelectedCat("");
    setSelectedExistingLevel("");
    setSelectedResidualLevel("");
    setSelectedStatus("");
    setFilterTbc(false);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search across activity, hazard, consequence, controls, department..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#880b13] focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-xs shrink-0">
            {/* TBC Filter Toggle */}
            <button
              type="button"
              onClick={() => { setFilterTbc(!filterTbc); setPage(1); }}
              className={`px-3 py-2 rounded-xl font-bold transition-all border cursor-pointer ${
                filterTbc
                  ? "bg-amber-100 text-amber-900 border-amber-300 shadow-xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              ⚠️ Flagged TBC ({records.filter((r) => r.isTbc).length})
            </button>

            {/* Clear Filters */}
            {(search || selectedDept || selectedCat || selectedExistingLevel || selectedResidualLevel || selectedStatus || filterTbc) && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-2 rounded-xl text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 font-bold cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs pt-1">
          {/* Department */}
          <select
            value={selectedDept}
            onChange={(e) => { setSelectedDept(e.target.value); setPage(1); }}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:border-[#880b13]"
          >
            <option value="">All Departments ({departments.length})</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Hazard Category */}
          <select
            value={selectedCat}
            onChange={(e) => { setSelectedCat(e.target.value); setPage(1); }}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:border-[#880b13]"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Existing Risk Level */}
          <select
            value={selectedExistingLevel}
            onChange={(e) => { setSelectedExistingLevel(e.target.value); setPage(1); }}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:border-[#880b13]"
          >
            <option value="">Initial Risk (All)</option>
            <option value="Very High">Very High (15-25)</option>
            <option value="High">High (10-14)</option>
            <option value="Medium">Medium (5-9)</option>
            <option value="Low">Low (1-4)</option>
          </select>

          {/* Residual Risk Level */}
          <select
            value={selectedResidualLevel}
            onChange={(e) => { setSelectedResidualLevel(e.target.value); setPage(1); }}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:border-[#880b13]"
          >
            <option value="">Residual Risk (All)</option>
            <option value="High">High (10-14)</option>
            <option value="Medium">Medium (5-9)</option>
            <option value="Low">Low (1-4)</option>
          </select>

          {/* Action Status */}
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:border-[#880b13]"
          >
            <option value="">All Action Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Register Table Container */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium bg-slate-50/50">
          <span>
            Showing <strong className="text-slate-900">{filtered.length}</strong> of{" "}
            <strong className="text-slate-900">{records.length}</strong> HIRA records
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Sort by:</span>
            <button
              type="button"
              onClick={() => {
                if (sortField === "srNo") setSortAsc(!sortAsc);
                else { setSortField("srNo"); setSortAsc(true); }
              }}
              className={`font-bold hover:text-slate-900 ${sortField === "srNo" ? "text-[#880b13]" : ""}`}
            >
              Sr. No. {sortField === "srNo" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
            <button
              type="button"
              onClick={() => {
                if (sortField === "existingRiskScore") setSortAsc(!sortAsc);
                else { setSortField("existingRiskScore"); setSortAsc(false); }
              }}
              className={`font-bold hover:text-slate-900 ${sortField === "existingRiskScore" ? "text-[#880b13]" : ""}`}
            >
              Initial Score {sortField === "existingRiskScore" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 font-bold">
                <th className="py-3 px-3 w-14 text-center">Sr</th>
                <th className="py-3 px-3 w-36">Department / Area</th>
                <th className="py-3 px-3 w-56">Activity / Task</th>
                <th className="py-3 px-3 w-32">Category</th>
                <th className="py-3 px-3 w-64">Hazard & Potential Consequence</th>
                <th className="py-3 px-3 w-36 text-center bg-rose-50/60 text-rose-950">
                  Initial Risk (L × S)
                </th>
                <th className="py-3 px-3 w-60">Proposed Additional Controls</th>
                <th className="py-3 px-3 w-32">Target & Resp.</th>
                <th className="py-3 px-3 w-36 text-center bg-emerald-50/60 text-emerald-950">
                  Residual Risk (L × S)
                </th>
                <th className="py-3 px-3 w-24 text-center">Status</th>
                <th className="py-3 px-3 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {paginated.length > 0 ? (
                paginated.map((r) => (
                  <tr
                    key={r.srNo}
                    onClick={() => { setActiveRecord(r); setDetailModalOpen(true); }}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-3 text-center font-bold font-mono text-slate-800">
                      {r.srNo}
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {r.department}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 leading-tight group-hover:text-[#880b13] transition-colors">
                        {r.activity}
                      </div>
                      {r.isTbc && (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                          ⚠️ To Be Confirmed
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
                        {r.hazardCategory}
                      </span>
                    </td>

                    <td className="py-3 px-3 space-y-1">
                      <div className="text-slate-800 line-clamp-2 leading-snug">
                        {r.hazardDescription}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 italic">
                        Impact: {r.potentialConsequence}
                      </div>
                    </td>

                    {/* Initial Risk Rating */}
                    <td className="py-3 px-3 text-center bg-rose-50/20">
                      <div className="flex flex-col items-center gap-0.5">
                        {getLevelBadge(r.existingRiskLevel, r.existingRiskScore)}
                        <span className="text-[10px] text-slate-400 font-mono">
                          L:{r.existingLikelihood} × S:{r.existingSeverity}
                        </span>
                      </div>
                    </td>

                    {/* Proposed Additional Controls */}
                    <td className="py-3 px-3">
                      <p className="text-slate-700 line-clamp-2 leading-snug">
                        {r.additionalControls || "Maintain existing controls"}
                      </p>
                    </td>

                    {/* Target & Responsible */}
                    <td className="py-3 px-3 space-y-0.5">
                      <div className="font-semibold text-slate-800 text-[11px]">
                        {r.responsiblePersonDept}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        Timeframe: {r.targetTimeframe || "N/A"}
                      </div>
                    </td>

                    {/* Residual Risk Rating */}
                    <td className="py-3 px-3 text-center bg-emerald-50/20">
                      <div className="flex flex-col items-center gap-0.5">
                        {getLevelBadge(r.residualRiskLevel, r.residualRiskScore)}
                        <span className="text-[10px] text-slate-400 font-mono">
                          L:{r.residualLikelihood} × S:{r.residualSeverity}
                        </span>
                      </div>
                    </td>

                    {/* Action Status */}
                    <td className="py-3 px-3 text-center">
                      {getStatusBadge(r.actionStatus)}
                    </td>

                    {/* Quick Button */}
                    <td
                      className="py-3 px-3 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionModalRecord(r);
                      }}
                    >
                      <button
                        type="button"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#880b13] hover:text-white text-slate-600 transition-colors cursor-pointer"
                        title="Update Action Item"
                      >
                        ⚡
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No matching hazard records found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i + 1}
                type="button"
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-lg font-bold transition-colors cursor-pointer ${
                  page === i + 1 ? "bg-[#880b13] text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Full Hazard Detail Modal */}
      {detailModalOpen && activeRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-[#880b13] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Sr. No. {activeRecord.srNo} ({activeRecord.hiraId})
                  </span>
                  <span className="text-xs text-slate-500 font-bold">{activeRecord.department}</span>
                  {activeRecord.isTbc && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-black">
                      ⚠️ To Be Confirmed
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">{activeRecord.activity}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-400 block text-[10px] uppercase">Hazard Category</span>
                  <span className="font-bold text-slate-800 text-xs">{activeRecord.hazardCategory}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-400 block text-[10px] uppercase">Action Status</span>
                  <div className="mt-0.5">{getStatusBadge(activeRecord.actionStatus)}</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-500 text-[11px] uppercase">Hazard Description</span>
                <p className="text-slate-900 leading-relaxed font-medium">{activeRecord.hazardDescription}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-500 text-[11px] uppercase">Potential Consequence / Who Is Affected</span>
                <p className="text-slate-800 leading-relaxed">{activeRecord.potentialConsequence}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-500 text-[11px] uppercase">Existing Control Measures</span>
                <p className="text-slate-800 leading-relaxed">{activeRecord.existingControls}</p>
              </div>

              {/* Initial vs Residual Side-by-Side Card */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2">
                  <div className="font-black text-rose-950 text-xs flex items-center justify-between">
                    <span>Initial Risk Rating</span>
                    {getLevelBadge(activeRecord.existingRiskLevel, activeRecord.existingRiskScore)}
                  </div>
                  <div className="text-slate-700 text-[11px]">
                    Likelihood (L): <strong>{activeRecord.existingLikelihood}</strong> | Severity (S): <strong>{activeRecord.existingSeverity}</strong>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                  <div className="font-black text-emerald-950 text-xs flex items-center justify-between">
                    <span>Projected Residual Risk</span>
                    {getLevelBadge(activeRecord.residualRiskLevel, activeRecord.residualRiskScore)}
                  </div>
                  <div className="text-slate-700 text-[11px]">
                    Likelihood (L): <strong>{activeRecord.residualLikelihood}</strong> | Severity (S): <strong>{activeRecord.residualSeverity}</strong>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1">
                <span className="font-bold text-blue-950 text-[11px] uppercase">Additional Controls Required</span>
                <p className="text-blue-950 leading-relaxed font-medium">{activeRecord.additionalControls}</p>
                <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-blue-900 border-t border-blue-200/60 mt-2">
                  <span>Responsible: <strong>{activeRecord.responsiblePersonDept}</strong></span>
                  <span>Target Timeframe: <strong>{activeRecord.targetTimeframe}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setActionModalRecord(activeRecord);
                    setDetailModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#880b13] hover:bg-rose-900 text-white text-xs font-black shadow-xs cursor-pointer"
                >
                  ⚡ Update Action Progress
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Item Update Modal */}
      {actionModalRecord && (
        <ActionUpdateModal
          record={actionModalRecord}
          onClose={() => setActionModalRecord(null)}
          onSaved={(updated) => {
            setActionModalRecord(null);
            if (onUpdateRecord) onUpdateRecord(updated);
          }}
        />
      )}
    </div>
  );
}

interface ActionUpdateModalProps {
  record: HiraRecord;
  onClose: () => void;
  onSaved: (rec: HiraRecord) => void;
}

function ActionUpdateModal({ record, onClose, onSaved }: ActionUpdateModalProps) {
  const [status, setStatus] = useState<"Open" | "In Progress" | "Closed">(record.actionStatus || "Open");
  const [targetDate, setTargetDate] = useState(record.actionTracking?.targetDate || "");
  const [completionDate, setCompletionDate] = useState(record.actionTracking?.actualCompletionDate || "");
  const [progressRemarks, setProgressRemarks] = useState(record.actionTracking?.progressRemarks || "");
  const [responsible, setResponsible] = useState(record.responsiblePersonDept || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/hira/${record.srNo}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionStatus: status,
          responsiblePersonDept: responsible,
          targetDate: targetDate || null,
          actualCompletionDate: completionDate || null,
          progressRemarks: progressRemarks || null,
          remarks: `Status updated to ${status}`,
        }),
      });
      const data = await res.json();
      if (data.success && data.record) {
        onSaved(data.record);
      } else {
        alert(data.message || "Failed to update action");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-[#880b13]">Sr {record.srNo} • {record.hiraId}</span>
            <h3 className="text-sm font-black text-slate-900 mt-0.5">{record.activity}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <div className="font-bold text-slate-900 mb-1">Proposed Additional Controls:</div>
          <p className="line-clamp-3 leading-snug">{record.additionalControls}</p>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Action Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(["Open", "In Progress", "Closed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                    status === s
                      ? s === "Closed"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : s === "In Progress"
                        ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                        : "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Responsible Person / Dept</label>
              <input
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-[#880b13]"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Target Completion Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-[#880b13]"
              />
            </div>
          </div>

          {status === "Closed" && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">Actual Completion Date</label>
              <input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-[#880b13]"
              />
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">Implementation Remarks / Evidence Notes</label>
            <textarea
              value={progressRemarks}
              onChange={(e) => setProgressRemarks(e.target.value)}
              placeholder="Record implementation progress, purchase order numbers, or evidence..."
              className="w-full h-20 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-[#880b13]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#880b13] hover:bg-rose-900 text-white text-xs font-black shadow-xs cursor-pointer"
          >
            {saving ? "Saving..." : "Save Action Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
