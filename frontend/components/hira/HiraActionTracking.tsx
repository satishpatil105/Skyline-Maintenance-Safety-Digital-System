"use client";

import React, { useState, useMemo } from "react";
import type { HiraRecord } from "@/lib/hira";

interface HiraActionTrackingProps {
  records: HiraRecord[];
  onUpdateRecord?: (rec: HiraRecord) => void;
  canEdit?: boolean;
}

export default function HiraActionTracking({
  records,
  onUpdateRecord,
  canEdit = true,
}: HiraActionTrackingProps) {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDept, setFilterDept] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editRecord, setEditRecord] = useState<HiraRecord | null>(null);
  const [auditModalRecord, setAuditModalRecord] = useState<HiraRecord | null>(null);

  const departments = useMemo(() => {
    const s = new Set<string>();
    records.forEach((r) => r.department && s.add(r.department));
    return Array.from(s).sort();
  }, [records]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filterStatus && (r.actionStatus || "Open") !== filterStatus) return false;
      if (filterDept && r.department !== filterDept) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          r.activity?.toLowerCase().includes(q) ||
          r.additionalControls?.toLowerCase().includes(q) ||
          r.responsiblePersonDept?.toLowerCase().includes(q) ||
          r.department?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [records, filterStatus, filterDept, search]);

  const stats = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let closed = 0;
    let overdue = 0;

    records.forEach((r) => {
      const s = r.actionStatus || "Open";
      if (s === "Closed") closed++;
      else if (s === "In Progress") inProgress++;
      else open++;

      if (r.actionTracking?.targetDate && r.actionTracking.targetDate < todayStr && s !== "Closed") {
        overdue++;
      }
    });

    return { open, inProgress, closed, overdue, total: records.length };
  }, [records, todayStr]);

  return (
    <div className="space-y-5">
      {/* Action Tracking KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div
          onClick={() => setFilterStatus(filterStatus === "Open" ? "" : "Open")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === "Open"
              ? "bg-rose-100 border-rose-300 shadow-sm"
              : "bg-white border-slate-200 shadow-2xs hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">Open Actions</span>
          <span className="text-2xl font-black text-rose-950 mt-1 block">{stats.open}</span>
          <span className="text-[11px] text-slate-500 font-medium">Pending implementation</span>
        </div>

        <div
          onClick={() => setFilterStatus(filterStatus === "In Progress" ? "" : "In Progress")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === "In Progress"
              ? "bg-amber-100 border-amber-300 shadow-sm"
              : "bg-white border-slate-200 shadow-2xs hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">In Progress</span>
          <span className="text-2xl font-black text-amber-950 mt-1 block">{stats.inProgress}</span>
          <span className="text-[11px] text-slate-500 font-medium">Currently active</span>
        </div>

        <div
          onClick={() => setFilterStatus(filterStatus === "Closed" ? "" : "Closed")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === "Closed"
              ? "bg-emerald-100 border-emerald-300 shadow-sm"
              : "bg-white border-slate-200 shadow-2xs hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Closed Actions</span>
          <span className="text-2xl font-black text-emerald-950 mt-1 block">{stats.closed}</span>
          <span className="text-[11px] text-slate-500 font-medium">Verified completed</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Controls</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.total}</span>
          <span className="text-[11px] text-slate-500 font-medium">Overdue: {stats.overdue}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by action, activity, responsible dept..."
          className="w-full sm:w-80 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#880b13] focus:bg-white"
        />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:border-[#880b13] flex-1 sm:flex-none"
          >
            <option value="">All Departments ({departments.length})</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {(filterStatus || filterDept || search) && (
            <button
              type="button"
              onClick={() => { setFilterStatus(""); setFilterDept(""); setSearch(""); }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold shrink-0 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Actions Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 font-bold">
                <th className="py-3 px-3 w-14 text-center">Sr</th>
                <th className="py-3 px-3 w-36">Department</th>
                <th className="py-3 px-3 w-52">Activity / Process</th>
                <th className="py-3 px-3 w-72">Proposed Additional Controls</th>
                <th className="py-3 px-3 w-36">Responsible Person/Dept</th>
                <th className="py-3 px-3 w-28">Target Timeframe</th>
                <th className="py-3 px-3 w-28 text-center">Action Status</th>
                <th className="py-3 px-3 w-28 text-center">Audit / Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const s = r.actionStatus || "Open";
                const isOverdue = r.actionTracking?.targetDate && r.actionTracking.targetDate < todayStr && s !== "Closed";

                return (
                  <tr key={r.srNo} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                      {r.srNo}
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {r.department}
                    </td>

                    <td className="py-3 px-3 text-slate-800 font-medium">
                      {r.activity}
                    </td>

                    <td className="py-3 px-3 text-slate-800 leading-snug">
                      <p className="line-clamp-2">{r.additionalControls}</p>
                      {r.actionTracking?.progressRemarks && (
                        <div className="mt-1 text-[11px] text-slate-500 italic flex items-center gap-1">
                          <span>💬</span> {r.actionTracking.progressRemarks}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 font-medium text-slate-800">
                      {r.responsiblePersonDept}
                    </td>

                    <td className="py-3 px-3 text-slate-600 font-mono">
                      <div>{r.targetTimeframe || "N/A"}</div>
                      {r.actionTracking?.targetDate && (
                        <div className={`text-[10px] ${isOverdue ? "text-rose-600 font-bold" : "text-slate-400"}`}>
                          Due: {r.actionTracking.targetDate}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                          s === "Closed"
                            ? "bg-emerald-100 text-emerald-800"
                            : s === "In Progress"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {s}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAuditModalRecord(r)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer"
                          title="View Audit Trail"
                        >
                          📜
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setEditRecord(r)}
                            className="px-2.5 py-1 rounded bg-[#880b13] hover:bg-rose-900 text-white text-[11px] font-black cursor-pointer shadow-2xs"
                          >
                            Update
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Trail Modal */}
      {auditModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#880b13]">Sr {auditModalRecord.srNo} Audit Trail</span>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">{auditModalRecord.activity}</h3>
              </div>
              <button type="button" onClick={() => setAuditModalRecord(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto text-xs">
              {(auditModalRecord.actionTracking?.auditTrail || []).length > 0 ? (
                auditModalRecord.actionTracking.auditTrail.map((entry, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{entry.newStatus}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(entry.changeDate).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">Changed by: <strong>{entry.changedBy}</strong></div>
                    {entry.remarks && (
                      <div className="text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200 mt-1 italic">
                        "{entry.remarks}"
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic py-4 text-center">No previous status changes logged.</div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAuditModalRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (reused from Register) */}
      {editRecord && (
        <ActionModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={(updated) => {
            setEditRecord(null);
            if (onUpdateRecord) onUpdateRecord(updated);
          }}
        />
      )}
    </div>
  );
}

function ActionModal({
  record,
  onClose,
  onSaved,
}: {
  record: HiraRecord;
  onClose: () => void;
  onSaved: (r: HiraRecord) => void;
}) {
  const [status, setStatus] = useState<"Open" | "In Progress" | "Closed">(record.actionStatus || "Open");
  const [responsible, setResponsible] = useState(record.responsiblePersonDept || "");
  const [targetDate, setTargetDate] = useState(record.actionTracking?.targetDate || "");
  const [completionDate, setCompletionDate] = useState(record.actionTracking?.actualCompletionDate || "");
  const [progressRemarks, setProgressRemarks] = useState(record.actionTracking?.progressRemarks || "");
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
              <label className="font-bold text-slate-700 block mb-1">Target Date</label>
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
            <label className="font-bold text-slate-700 block mb-1">Progress Remarks / Evidence</label>
            <textarea
              value={progressRemarks}
              onChange={(e) => setProgressRemarks(e.target.value)}
              placeholder="Record progress remarks, evidence details, or purchase status..."
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
