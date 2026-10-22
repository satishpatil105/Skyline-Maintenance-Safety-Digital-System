"use client";

import React, { useMemo, useState } from "react";
import type {
  MaintenanceRequest,
  MaintenanceRecordItem,
  PMScheduleItem,
  BreakdownItem,
  AMCServiceReportItem,
  MachineMTTRMetric,
} from "@/lib/maintenanceSystem";

interface MachineHistoryTabProps {
  machinesList: Array<{ assetId?: string; name?: string; "Asset ID"?: string; "Machine Name"?: string; Category?: string; Department?: string; Criticality?: string }>;
  records: MaintenanceRecordItem[];
  requests: MaintenanceRequest[];
  pmSchedules: PMScheduleItem[];
  breakdowns: BreakdownItem[];
  amcReports: AMCServiceReportItem[];
  mttrMetrics: MachineMTTRMetric[];
  initialAssetId?: string;
}

export default function MachineHistoryTab({
  machinesList,
  records,
  requests,
  pmSchedules,
  breakdowns,
  amcReports,
  mttrMetrics,
  initialAssetId,
}: MachineHistoryTabProps) {
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    initialAssetId ||
      machinesList[0]?.assetId ||
      machinesList[0]?.["Asset ID"] ||
      "SKY-LSR-MCH-001"
  );

  const selectedMachine = useMemo(() => {
    return machinesList.find(
      (m) => (m.assetId || m["Asset ID"]) === selectedAssetId
    );
  }, [machinesList, selectedAssetId]);

  const machineMetric = useMemo(() => {
    return mttrMetrics.find((m) => m.assetId === selectedAssetId);
  }, [mttrMetrics, selectedAssetId]);

  // Merge all events for this machine into a unified chronological stream
  const timelineEvents = useMemo(() => {
    const events: Array<{
      id: string;
      date: string;
      type: "Breakdown" | "Maintenance Work" | "Preventive Service" | "AMC Visit" | "Checklist Defect";
      title: string;
      description: string;
      technician?: string;
      status: string;
      downtimeHours?: number;
      badgeColor: string;
    }> = [];

    // Breakdowns
    breakdowns
      .filter((b) => b.assetId === selectedAssetId)
      .forEach((b) => {
        events.push({
          id: b.breakdownId,
          date: b.failureDateTime || b.reportedDate,
          type: "Breakdown",
          title: `Machine Breakdown: ${b.problemDescription}`,
          description: `Severity: ${b.severity} | Root cause: ${b.rootCause || "Pending"} | Corrective action: ${b.correctiveAction || "In repair"}`,
          technician: b.assignedTechnician,
          status: b.closureStatus,
          downtimeHours: b.downtimeHours,
          badgeColor: "bg-red-500",
        });
      });

    // Maintenance Records
    records
      .filter((r) => r.assetId === selectedAssetId)
      .forEach((r) => {
        events.push({
          id: r.recordId,
          date: r.repairCompletionDate || r.reportedDate,
          type: "Maintenance Work",
          title: `Repair Completed (${r.recordId}): ${r.correctiveAction}`,
          description: `Problem: ${r.problem} | Spares used: ${r.sparePartsUsed || "None"} | Verified by: ${r.verifiedBy || "Supervisor"}`,
          technician: r.technicianName,
          status: r.verificationStatus,
          downtimeHours: r.downtimeHours,
          badgeColor: "bg-indigo-500",
        });
      });

    // PM Schedules
    pmSchedules
      .filter((p) => p.assetId === selectedAssetId)
      .forEach((p) => {
        if (p.lastMaintenanceDate) {
          events.push({
            id: p.scheduleId,
            date: p.lastMaintenanceDate,
            type: "Preventive Service",
            title: `Preventive Maintenance: ${p.taskTitle}`,
            description: `Interval: ${p.frequency} | Next due: ${p.nextDueDate} | Instructions: ${p.instructions || "OEM manual standard"}`,
            technician: p.assignedTechnician,
            status: p.status,
            badgeColor: "bg-emerald-500",
          });
        }
      });

    // AMC Reports
    amcReports
      .filter((a) => a.assetId === selectedAssetId)
      .forEach((a) => {
        events.push({
          id: a.reportId,
          date: a.serviceDate,
          type: "AMC Visit",
          title: `OEM Service Visit: ${a.workPerformed}`,
          description: `Observations: ${a.observations} | Engineer: ${a.serviceEngineerName} | Test: ${a.testResults}`,
          technician: a.serviceEngineerName,
          status: a.testResults,
          badgeColor: "bg-purple-500",
        });
      });

    // Requests (open or in progress)
    requests
      .filter((req) => req.assetId === selectedAssetId && req.status !== "Closed")
      .forEach((req) => {
        events.push({
          id: req.requestId,
          date: req.reportedDate,
          type: "Checklist Defect",
          title: `Open Defect Request: ${req.problem}`,
          description: `Failed item: ${req.failedPoint || "Checkpoint"} | Reported by: ${req.reportedBy} | Priority: ${req.priority}`,
          technician: req.technicianName || req.assignedTo,
          status: req.status,
          badgeColor: "bg-amber-500",
        });
      });

    return events.sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [selectedAssetId, breakdowns, records, pmSchedules, amcReports, requests]);

  const machineName = selectedMachine?.name || selectedMachine?.["Machine Name"] || selectedAssetId;


  return (
    <div className="space-y-5">
      {/* Selector & Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Section 9: Machine Lifecycle History & Service Stream
            </h3>
            <p className="text-xs text-slate-500">
              Complete chronological audit trail of all maintenance work orders, breakdowns, PM services, and AMC visits
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
              Select Machine:
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20"
            >
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
        </div>

        {/* Machine Profile & KPI Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-semibold">Asset ID</span>
            <span className="font-mono font-bold text-slate-900">{selectedAssetId}</span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-semibold">Department</span>
            <span className="font-bold text-slate-800 truncate block">
              {selectedMachine?.Category || selectedMachine?.Department || "Plant Production"}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-semibold">Total Downtime</span>
            <span className="font-black text-red-700">
              {machineMetric?.totalDowntimeHours || 0} hrs
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-semibold">Availability %</span>
            <span className="font-black text-emerald-700">
              {machineMetric?.availabilityPercent || 99.2}%
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-semibold">MTTR (Repair)</span>
            <span className="font-bold text-teal-800">
              {machineMetric?.mttrHours !== null ? `${machineMetric?.mttrHours}h` : "N/A"}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 block font-semibold">MTBF (Reliability)</span>
            <span className="font-bold text-blue-900">
              {machineMetric?.mtbfHours !== null ? `${machineMetric?.mtbfHours}h` : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Chronological Stream */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="text-sm font-bold text-slate-900">
            Chronological Lifecycle Stream: {machineName}
          </h4>
          <span className="text-xs text-slate-500 font-semibold">
            {timelineEvents.length} Recorded Lifecycle Events
          </span>
        </div>

        {timelineEvents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No historical maintenance events recorded for this machine.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 text-xs">
            {timelineEvents.map((evt, idx) => (
              <div key={idx} className="relative group">
                <div
                  className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white shadow-xs ${evt.badgeColor}`}
                ></div>
                <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors space-y-1.5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {evt.id}
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-700">
                        {evt.type}
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                        {evt.status}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      {evt.date}
                    </span>
                  </div>

                  <div className="font-bold text-slate-900 text-xs">
                    {evt.title}
                  </div>

                  <div className="text-slate-600 text-[11px] leading-relaxed">
                    {evt.description}
                  </div>

                  {evt.technician && (
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      Technician / Engineer: <span className="font-semibold text-slate-800">{evt.technician}</span>
                      {evt.downtimeHours ? (
                        <span className="ml-3 text-red-700 font-bold">Downtime: {evt.downtimeHours} hrs</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
