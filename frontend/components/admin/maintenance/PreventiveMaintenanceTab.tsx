"use client";

import React, { useMemo, useState } from "react";
import type { PMScheduleItem, TechnicianItem } from "@/lib/maintenanceSystem";

interface PreventiveMaintenanceTabProps {
  schedules: PMScheduleItem[];
  technicians: TechnicianItem[];
  machinesList: Array<{ assetId?: string; name?: string; "Asset ID"?: string; "Machine Name"?: string }>;
  onCompletePM: (scheduleId: string, details: { technicianName: string; remarks?: string }) => Promise<void>;
  onCreatePM: (schedule: any) => Promise<void>;
  onRefresh: () => void;
  onDeletePM?: (scheduleId: string) => Promise<void>;
  initialFilter?: string;
}

export default function PreventiveMaintenanceTab({
  schedules,
  technicians,
  machinesList,
  onCompletePM,
  onCreatePM,
  onRefresh,
  onDeletePM,
  initialFilter,
}: PreventiveMaintenanceTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialFilter || "All");
  const [frequencyFilter, setFrequencyFilter] = useState("All");
  const [completeModalSchedule, setCompleteModalSchedule] = useState<PMScheduleItem | null>(null);
  const [deleteModalSchedule, setDeleteModalSchedule] = useState<PMScheduleItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDeletePM = async () => {
    if (!deleteModalSchedule) return;
    setIsDeleting(true);
    try {
      if (onDeletePM) {
        await onDeletePM(deleteModalSchedule.scheduleId);
      } else {
        const res = await fetch("/api/admin/maintenance/hub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete_pm", scheduleId: deleteModalSchedule.scheduleId }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete PM schedule");
      }
      setDeleteModalSchedule(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete PM schedule");
    } finally {
      setIsDeleting(false);
    }
  };

  // Form state for completion
  const [compTech, setCompTech] = useState("");
  const [compRemarks, setCompRemarks] = useState("");

  // Form state for new PM task
  const [newAssetId, setNewAssetId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFreq, setNewFreq] = useState<any>("Monthly");
  const [newNextDue, setNewNextDue] = useState(new Date().toISOString().slice(0, 10));
  const [newTech, setNewTech] = useState("");
  const [newEstHours, setNewEstHours] = useState(2);

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (statusFilter !== "All" && s.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (frequencyFilter !== "All" && s.frequency.toLowerCase() !== frequencyFilter.toLowerCase()) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          s.scheduleId.toLowerCase().includes(q) ||
          s.assetId.toLowerCase().includes(q) ||
          s.machineName.toLowerCase().includes(q) ||
          s.taskTitle.toLowerCase().includes(q) ||
          s.assignedTechnician.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [schedules, statusFilter, frequencyFilter, searchTerm]);


  const handleOpenCompleteModal = (s: PMScheduleItem) => {
    setCompleteModalSchedule(s);
    setCompTech(s.assignedTechnician || "");
    setCompRemarks("Routine preventive maintenance inspection & lubrication performed as per OEM checklist.");
  };

  const handleConfirmComplete = async () => {
    if (!completeModalSchedule) return;
    setIsSubmitting(true);
    try {
      await onCompletePM(completeModalSchedule.scheduleId, {
        technicianName: compTech,
        remarks: compRemarks,
      });
      setCompleteModalSchedule(null);
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePMSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetId || !newTitle || !newNextDue) return;

    const matchedMachine = machinesList.find(
      (m) => (m.assetId || m["Asset ID"]) === newAssetId
    );
    const machineName = matchedMachine ? matchedMachine.name || matchedMachine["Machine Name"] || newAssetId : newAssetId;

    setIsSubmitting(true);
    try {
      await onCreatePM({
        assetId: newAssetId,
        machineName,
        taskTitle: newTitle,
        taskDescription: newDesc,
        frequency: newFreq,
        nextDueDate: newNextDue,
        assignedTechnician: newTech || (technicians[0]?.name ?? "Maintenance Engineer"),
        estimatedHours: Number(newEstHours),
      });
      setCreateModalOpen(false);
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s.toLowerCase()) {
      case "overdue":
        return "bg-red-100 text-red-800 border-red-300 font-bold animate-pulse";
      case "due today":
        return "bg-amber-100 text-amber-800 border-amber-300 font-bold";
      case "scheduled":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "completed":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Section 5: Preventive Maintenance (PM) Management Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Scheduled maintenance intervals (Daily, Weekly, Monthly, Quarterly, Yearly) with automated due-date cycling
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#880b13] text-white hover:bg-[#6e090f] text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add PM Schedule
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 text-xs">
          <div>
            <input
              type="text"
              placeholder="Search schedule ID, task, machine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Due Today">Due Today</option>
              <option value="Overdue">Overdue</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div>
            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="All">All Frequencies</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Half-Yearly">Half-Yearly</option>
              <option value="Yearly">Yearly</option>
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("All");
                setFrequencyFilter("All");
              }}
              className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* PM Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
                <th className="py-3 px-3">Schedule ID</th>
                <th className="py-3 px-3">Machine</th>
                <th className="py-3 px-3">Maintenance Task</th>
                <th className="py-3 px-3">Frequency</th>
                <th className="py-3 px-3">Last Maintained</th>
                <th className="py-3 px-3">Next Due Date</th>
                <th className="py-3 px-3">Assigned Tech</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Linked Record</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No preventive maintenance schedules match this criteria.
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((s) => (
                  <tr key={s.scheduleId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {s.scheduleId}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{s.machineName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{s.assetId}</div>
                    </td>

                    <td className="py-3 px-3 max-w-xs truncate font-medium text-slate-800" title={s.taskDescription}>
                      <div className="font-semibold text-slate-900">{s.taskTitle}</div>
                      <div className="text-[10px] text-slate-500 truncate">{s.taskDescription}</div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-700">
                        {s.frequency}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                      {s.lastMaintenanceDate || "Initial Setup"}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-900">
                      {s.nextDueDate}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-800">
                      {s.assignedTechnician}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] border ${getStatusBadge(s.status)}`}>
                        {s.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {s.linkedRecordId || <span className="text-slate-300">—</span>}
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteModal(s)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs cursor-pointer inline-flex items-center gap-1"
                          title="Mark Routine as Completed"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          Mark Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModalSchedule(s)}
                          className="p-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-2xs cursor-pointer inline-flex items-center justify-center"
                          title="Delete PM Schedule"
                          aria-label="Delete PM Schedule"
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

      {/* Complete PM Modal */}
      {completeModalSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  PM Task Execution Sign-Off
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  {completeModalSchedule.taskTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setCompleteModalSchedule(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-700 font-bold">{completeModalSchedule.machineName}</div>
                <div className="text-slate-500 text-[11px]">Interval: {completeModalSchedule.frequency} ({completeModalSchedule.intervalDays} days)</div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Performing Technician
                </label>
                <select
                  value={compTech}
                  onChange={(e) => setCompTech(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {technicians.map((t) => (
                    <option key={t.userId} value={t.name}>
                      {t.name} ({t.role})
                    </option>
                  ))}
                  <option value="Self / Verified Supervisor">Self / Verified Supervisor</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  PM Inspection Findings & Remarks
                </label>
                <textarea
                  rows={3}
                  value={compRemarks}
                  onChange={(e) => setCompRemarks(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white"
                  placeholder="Record findings, lubricants used, or filter replacements..."
                />
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px]">
                Upon completion, a permanent Maintenance Record is created, and the schedule next due date will automatically advance by {completeModalSchedule.intervalDays} days.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCompleteModalSchedule(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmComplete}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? "Saving..." : "Confirm PM Completion"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New PM Schedule Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreatePMSubmit}
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-900">
                Add Preventive Maintenance Schedule
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
                  Target Machine / Asset *
                </label>
                <select
                  required
                  value={newAssetId}
                  onChange={(e) => setNewAssetId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="">-- Choose Machine --</option>
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
                  PM Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Hydraulic Filter Replacement & Pressure Test"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Task Instructions / Checklist Scope
                </label>
                <textarea
                  rows={2}
                  placeholder="Outline step-by-step procedures, OEM specifications, and LOTO safety protocols..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Frequency *
                  </label>
                  <select
                    value={newFreq}
                    onChange={(e) => setNewFreq(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Daily">Daily (1 day)</option>
                    <option value="Weekly">Weekly (7 days)</option>
                    <option value="Monthly">Monthly (30 days)</option>
                    <option value="Quarterly">Quarterly (90 days)</option>
                    <option value="Half-Yearly">Half-Yearly (180 days)</option>
                    <option value="Yearly">Yearly (365 days)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    First Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newNextDue}
                    onChange={(e) => setNewNextDue(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Assigned Technician
                  </label>
                  <select
                    value={newTech}
                    onChange={(e) => setNewTech(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Default Lead --</option>
                    {technicians.map((t) => (
                      <option key={t.userId} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Estimated Duration (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={newEstHours}
                    onChange={(e) => setNewEstHours(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
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
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#880b13] text-white hover:bg-[#6e090f] disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? "Creating..." : "Save PM Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete PM Confirmation Modal */}
      {deleteModalSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete PM Schedule</h3>
                <p className="text-xs text-slate-500">Are you sure you want to delete this schedule?</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1 font-mono">
              <div><span className="text-slate-500 font-sans">Schedule ID:</span> <span className="font-bold text-slate-800">{deleteModalSchedule.scheduleId}</span></div>
              <div><span className="text-slate-500 font-sans">Machine:</span> <span className="font-bold text-slate-800">{deleteModalSchedule.machineName} ({deleteModalSchedule.assetId})</span></div>
              <div><span className="text-slate-500 font-sans">Task:</span> <span className="text-slate-700">{deleteModalSchedule.taskTitle}</span></div>
              <div><span className="text-slate-500 font-sans">Frequency:</span> <span className="text-slate-700">{deleteModalSchedule.frequency}</span></div>
            </div>

            <p className="text-xs text-red-600 font-medium">
              This preventive schedule will be permanently deleted from database.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModalSchedule(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeletePM}
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
