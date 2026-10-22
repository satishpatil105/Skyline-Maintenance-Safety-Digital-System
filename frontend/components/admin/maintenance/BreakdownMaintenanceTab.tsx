"use client";

import React, { useMemo, useState } from "react";
import type { BreakdownItem, TechnicianItem } from "@/lib/maintenanceSystem";

interface BreakdownMaintenanceTabProps {
  breakdowns: BreakdownItem[];
  technicians: TechnicianItem[];
  machinesList: Array<{ assetId?: string; name?: string; "Asset ID"?: string; "Machine Name"?: string }>;
  onCreateBreakdown: (breakdown: any) => Promise<void>;
  onRefresh: () => void;
}

export default function BreakdownMaintenanceTab({
  breakdowns,
  technicians,
  machinesList,
  onCreateBreakdown,
  onRefresh,
}: BreakdownMaintenanceTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New breakdown form state
  const [newAssetId, setNewAssetId] = useState("");
  const [newProblem, setNewProblem] = useState("");
  const [newSeverity, setNewSeverity] = useState<"Critical" | "Major" | "Minor">("Critical");
  const [newTech, setNewTech] = useState("");

  const filteredBreakdowns = useMemo(() => {
    return breakdowns.filter((b) => {
      if (severityFilter !== "All" && b.severity !== severityFilter) return false;
      if (statusFilter !== "All" && b.closureStatus !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          b.breakdownId.toLowerCase().includes(q) ||
          b.assetId.toLowerCase().includes(q) ||
          b.machineName.toLowerCase().includes(q) ||
          b.problemDescription.toLowerCase().includes(q) ||
          (b.rootCause || "").toLowerCase().includes(q) ||
          (b.correctiveAction || "").toLowerCase().includes(q) ||
          b.assignedTechnician.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [breakdowns, severityFilter, statusFilter, searchTerm]);


  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetId || !newProblem) return;

    const matched = machinesList.find((m) => (m.assetId || m["Asset ID"]) === newAssetId);
    const machineName = matched ? matched.name || matched["Machine Name"] || newAssetId : newAssetId;

    setIsSubmitting(true);
    try {
      await onCreateBreakdown({
        assetId: newAssetId,
        machineName,
        problemDescription: newProblem,
        severity: newSeverity,
        assignedTechnician: newTech,
      });
      setCreateModalOpen(false);
      setNewAssetId("");
      setNewProblem("");
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityBadge = (s: string) => {
    switch (s) {
      case "Critical":
        return "bg-red-100 text-red-800 border-red-300 font-extrabold";
      case "Major":
        return "bg-orange-100 text-orange-800 border-orange-300 font-bold";
      default:
        return "bg-amber-100 text-amber-800 border-amber-300 font-medium";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Section 6: Breakdown Register & Stoppage Management
            </h3>
            <p className="text-xs text-slate-500">
              Emergency ticket logs, immediate downtime tracking, root cause diagnostics, and restart verification
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Log Emergency Breakdown
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
          <div>
            <input
              type="text"
              placeholder="Search breakdown ID, machine, root cause..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="Major">Major</option>
              <option value="Minor">Minor</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="All">All Closure Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved & Verified">Resolved & Verified</option>
            </select>
          </div>
        </div>
      </div>

      {/* Breakdown Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
                <th className="py-3 px-3">Breakdown ID</th>
                <th className="py-3 px-3">Machine</th>
                <th className="py-3 px-3">Failure Time</th>
                <th className="py-3 px-3">Problem Description</th>
                <th className="py-3 px-3 text-center">Severity</th>
                <th className="py-3 px-3">Assigned Tech</th>
                <th className="py-3 px-3">Root Cause</th>
                <th className="py-3 px-3">Corrective Action</th>
                <th className="py-3 px-3 text-right">Repair Dur</th>
                <th className="py-3 px-3 text-right">Downtime</th>
                <th className="py-3 px-3">Parts Used</th>
                <th className="py-3 px-3">Restart Time</th>
                <th className="py-3 px-3 text-center">Verification</th>
                <th className="py-3 px-3 text-center">Closure Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredBreakdowns.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    No breakdown incidents registered matching current filter.
                  </td>
                </tr>
              ) : (
                filteredBreakdowns.map((b) => (
                  <tr key={b.breakdownId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {b.breakdownId}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{b.machineName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{b.assetId}</div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                      {b.failureDateTime?.slice(0, 16) || b.reportedDate}
                    </td>

                    <td className="py-3 px-3 max-w-xs truncate text-slate-800" title={b.problemDescription}>
                      {b.problemDescription}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${getSeverityBadge(b.severity)}`}>
                        {b.severity}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-800">
                      {b.assignedTechnician}
                    </td>

                    <td className="py-3 px-3 max-w-xs truncate text-slate-600" title={b.rootCause}>
                      {b.rootCause || "Pending analysis"}
                    </td>

                    <td className="py-3 px-3 max-w-xs truncate text-slate-800 font-medium" title={b.correctiveAction}>
                      {b.correctiveAction || "In repair"}
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                      {b.repairDurationHours ? `${b.repairDurationHours}h` : "—"}
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-red-700 whitespace-nowrap">
                      {b.downtimeHours ? `${b.downtimeHours}h` : "—"}
                    </td>

                    <td className="py-3 px-3 max-w-xs truncate text-slate-600 font-mono text-[11px]" title={b.partsUsed}>
                      {b.partsUsed || "None"}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                      {b.productionRestartTime || "Not restarted"}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {b.verificationStatus || "Verified"}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          b.closureStatus === "Resolved & Verified" || b.closureStatus === "Closed"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                        }`}
                      >
                        {b.closureStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Breakdown Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-900">
                Log Emergency Machine Breakdown
              </h4>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Machine Asset ID *
                </label>
                <select
                  required
                  value={newAssetId}
                  onChange={(e) => setNewAssetId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="">-- Select Machine --</option>
                  {machinesList.map((m) => {
                    const id = m.assetId || m["Asset ID"] || "";
                    const name = m.name || m["Machine Name"] || id;
                    return (
                      <option key={id} value={id}>
                        {name} ({id})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Problem Description *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail exact failure symptoms, error codes on display, unusual sounds..."
                  value={newProblem}
                  onChange={(e) => setNewProblem(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Severity *
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="Critical">Critical (Immediate Production Stop)</option>
                    <option value="Major">Major (Partial Capability Loss)</option>
                    <option value="Minor">Minor (Non-critical Alert)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Assign Technician
                  </label>
                  <select
                    value={newTech}
                    onChange={(e) => setNewTech(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Unassigned (Auto Queue) --</option>
                    {technicians.map((t) => (
                      <option key={t.userId} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-2.5 bg-red-50 rounded-xl border border-red-200 text-red-800 text-[11px]">
                Submitting creates an active breakdown ticket and a linked High-Priority Maintenance Request in Workflow B.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-700 text-white hover:bg-red-800 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? "Logging..." : "Create Breakdown Ticket"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
