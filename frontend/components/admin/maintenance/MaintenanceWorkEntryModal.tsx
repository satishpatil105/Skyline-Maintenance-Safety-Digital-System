"use client";

import React, { useEffect, useState } from "react";
import type { MaintenanceRequest, TechnicianItem, SparePartItem } from "@/lib/maintenanceSystem";

interface MaintenanceWorkEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: MaintenanceRequest | null;
  technicians: TechnicianItem[];
  spares: SparePartItem[];
  machinesList: Array<{ assetId?: string; name?: string; "Asset ID"?: string; "Machine Name"?: string; Criticality?: string }>;
  currentUser: { name: string; email: string; role?: string };
  onSubmitWorkEntry: (data: any) => Promise<void>;
  onVerifyWorkEntry?: (data: { recordId: string; decision: "Approve" | "Reject / Rework"; remarks: string; safetyReleaseAuthorized: boolean }) => Promise<void>;
  isVerificationMode?: boolean;
  existingRecord?: any;
}

export default function MaintenanceWorkEntryModal({
  isOpen,
  onClose,
  request,
  technicians,
  spares,
  machinesList,
  currentUser,
  onSubmitWorkEntry,
  onVerifyWorkEntry,
  isVerificationMode = false,
  existingRecord,
}: MaintenanceWorkEntryModalProps) {
  // ISO date string helpers for datetime-local input
  const getInitialStartDateTime = () => {
    const d = new Date();
    d.setHours(d.getHours() - 2);
    return d.toISOString().slice(0, 16);
  };
  const getInitialEndDateTime = () => {
    return new Date().toISOString().slice(0, 16);
  };

  const [recordId, setRecordId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [machineName, setMachineName] = useState("");
  const [maintenanceType, setMaintenanceType] = useState<any>("Corrective");
  const [problem, setProblem] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [repairStartDate, setRepairStartDate] = useState(getInitialStartDateTime());
  const [repairCompletionDate, setRepairCompletionDate] = useState(getInitialEndDateTime());
  const [repairDurationHours, setRepairDurationHours] = useState<number>(2.0);
  const [downtimeHours, setDowntimeHours] = useState<number>(2.0);
  const [technicianName, setTechnicianName] = useState("");
  const [selectedSparePart, setSelectedSparePart] = useState("");
  const [sparePartsQuantity, setSparePartsQuantity] = useState<number>(0);
  const [sparePartsCost, setSparePartsCost] = useState<number>(0);
  const [labourHours, setLabourHours] = useState<number>(2.0);
  const [labourCost, setLabourCost] = useState<number>(800);
  const [testRunResult, setTestRunResult] = useState<"Passed" | "Needs Adjustment" | "Failed">("Passed");
  const [remarks, setRemarks] = useState("");

  // Verification mode state (Workflow D)
  const [verifyDecision, setVerifyDecision] = useState<"Approve" | "Reject / Rework">("Approve");
  const [verifyRemarks, setVerifyRemarks] = useState("Maintenance work inspected, test run passed. Cleared for production.");
  const [safetyReleaseAuthorized, setSafetyReleaseAuthorized] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when opened or request changes
  useEffect(() => {
    if (!isOpen) return;

    if (existingRecord) {
      setRecordId(existingRecord.recordId || "");
      setRequestId(existingRecord.requestId || "");
      setAssetId(existingRecord.assetId || "");
      setMachineName(existingRecord.machineName || "");
      setMaintenanceType(existingRecord.maintenanceType || "Corrective");
      setProblem(existingRecord.actualProblem || existingRecord.problem || "");
      setRootCause(existingRecord.rootCause || "");
      setCorrectiveAction(existingRecord.maintenanceWorkPerformed || existingRecord.correctiveAction || "");
      setRepairStartDate(existingRecord.repairStartDate ? existingRecord.repairStartDate.slice(0, 16) : getInitialStartDateTime());
      setRepairCompletionDate(existingRecord.repairCompletionDate ? existingRecord.repairCompletionDate.slice(0, 16) : getInitialEndDateTime());
      setRepairDurationHours(existingRecord.repairDurationHours || 2.0);
      setDowntimeHours(existingRecord.downtimeHours || 2.0);
      setTechnicianName(existingRecord.technicianName || "");
      setSelectedSparePart(existingRecord.sparePartsUsed || "");
      setSparePartsQuantity(existingRecord.sparePartsQuantity || (existingRecord.sparePartsUsed ? 1 : 0));
      setSparePartsCost(existingRecord.sparePartsCost || 0);
      setLabourHours(existingRecord.labourHours || 2.0);
      setLabourCost(existingRecord.labourCost || 800);
      setTestRunResult(existingRecord.testRunResult || "Passed");
      setRemarks(existingRecord.remarks || "");
    } else if (request) {
      const generatedRecId = `REC-${request.requestId.replace(/^REQ-/, "")}`;
      setRecordId(generatedRecId);
      setRequestId(request.requestId);
      setAssetId(request.assetId);
      setMachineName(request.machineName);
      setMaintenanceType(request.maintenanceType || (request.priority === "Critical" ? "Breakdown" : "Corrective"));
      setProblem(request.actualProblem || request.problem);
      setRootCause(request.rootCause || "");
      setCorrectiveAction(request.maintenanceWorkPerformed || request.actionIfNotOk || "");
      setRepairStartDate(request.breakdownStartDateTime ? request.breakdownStartDateTime.slice(0, 16) : getInitialStartDateTime());
      setRepairCompletionDate(getInitialEndDateTime());
      setRepairDurationHours(request.breakdownDurationHours || 2.0);
      setDowntimeHours(request.breakdownDurationHours || 2.0);
      setTechnicianName(request.technicianName || request.assignedTo || technicians[0]?.name || "Technician");
      setSelectedSparePart(request.sparePartsUsed || "");
      setSparePartsQuantity(request.sparePartsQuantity || 0);
      setSparePartsCost(0);
      setLabourHours(2.0);
      setLabourCost(800);
      setTestRunResult("Passed");
      setRemarks(request.remarks || "");
    } else {
      const initialAsset = machinesList[0]?.assetId || machinesList[0]?.["Asset ID"] || "SKY-001";
      const initialMName = machinesList[0]?.name || machinesList[0]?.["Machine Name"] || "Industrial Machine";
      setRecordId(`REC-${Date.now().toString().slice(-6)}`);
      setRequestId("");
      setAssetId(initialAsset);
      setMachineName(initialMName);
      setMaintenanceType("Corrective");
      setProblem("");
      setRootCause("");
      setCorrectiveAction("");
      setRepairStartDate(getInitialStartDateTime());
      setRepairCompletionDate(getInitialEndDateTime());
      setRepairDurationHours(2.0);
      setDowntimeHours(2.0);
      setTechnicianName(technicians[0]?.name || "Technician");
      setSelectedSparePart("");
      setSparePartsQuantity(0);
      setSparePartsCost(0);
      setLabourHours(2.0);
      setLabourCost(800);
      setTestRunResult("Passed");
      setRemarks("");
    }
  }, [isOpen, request, existingRecord, machinesList, technicians]);

  // Automatic calculation of repair duration from timestamps
  useEffect(() => {
    if (repairStartDate && repairCompletionDate) {
      const start = new Date(repairStartDate).getTime();
      const end = new Date(repairCompletionDate).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const diffHours = Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
        setRepairDurationHours(diffHours);
        // Default downtime to at least repair duration if not custom
        setDowntimeHours(diffHours);
        setLabourHours(diffHours);
        setLabourCost(Math.round(diffHours * 400)); // ₹400/hr standard labour rate
      }
    }
  }, [repairStartDate, repairCompletionDate]);

  // Update machine name when assetId changes
  const handleAssetChange = (newId: string) => {
    setAssetId(newId);
    const m = machinesList.find((item) => (item.assetId || item["Asset ID"]) === newId);
    if (m) {
      setMachineName(m.name || m["Machine Name"] || newId);
    }
  };

  // Check if machine is safety-critical
  const matchedMachine = machinesList.find((m) => (m.assetId || m["Asset ID"]) === assetId);
  const isSafetyCritical = /critical|high/i.test(matchedMachine?.Criticality || "");

  // Update spare parts cost when part is selected
  const handleSparePartChange = (partName: string) => {
    setSelectedSparePart(partName);
    const p = spares.find((s) => s.partName === partName || s.partId === partName);
    if (p) {
      const qty = sparePartsQuantity > 0 ? sparePartsQuantity : 1;
      setSparePartsQuantity(qty);
      setSparePartsCost(p.unitCost * qty);
    } else {
      setSparePartsCost(0);
      setSparePartsQuantity(0);
    }
  };

  const handleQuantityChange = (qty: number) => {
    const validQty = Math.max(0, qty);
    setSparePartsQuantity(validQty);
    const p = spares.find((s) => s.partName === selectedSparePart || s.partId === selectedSparePart);
    if (p) {
      setSparePartsCost(p.unitCost * validQty);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isVerificationMode) {
      if (!problem.trim()) {
        alert("Actual Problem / Fault Found is mandatory. Please describe what was found.");
        return;
      }
      if (!correctiveAction.trim()) {
        alert("Maintenance Work Performed is mandatory. Please describe the actions taken.");
        return;
      }
      if (!technicianName.trim()) {
        alert("Technician Name is mandatory. Please select or enter the technician name.");
        return;
      }
      if (!repairCompletionDate) {
        alert("Maintenance Completion Date and Time is mandatory.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isVerificationMode && onVerifyWorkEntry) {
        // Workflow D verification
        await onVerifyWorkEntry({
          recordId,
          decision: verifyDecision,
          remarks: verifyRemarks,
          safetyReleaseAuthorized,
        });
      } else {
        // Complete Maintenance Request
        await onSubmitWorkEntry({
          recordId,
          requestId: requestId || request?.requestId || recordId,
          assetId,
          machineName,
          maintenanceType,
          problem,
          actualProblem: problem,
          rootCause,
          correctiveAction,
          maintenanceWorkPerformed: correctiveAction,
          repairStartDate,
          breakdownStartDateTime: repairStartDate,
          repairCompletionDate,
          maintenanceCompletionDateTime: repairCompletionDate,
          repairDurationHours,
          breakdownDurationHours: repairDurationHours,
          technicianName,
          sparePartsUsed: selectedSparePart,
          sparePartsQuantity: Number(sparePartsQuantity || (selectedSparePart ? 1 : 0)),
          sparePartsCost,
          labourHours,
          labourCost,
          totalCost: Number(sparePartsCost) + Number(labourCost),
          downtimeHours,
          testRunResult,
          remarks,
        });
      }
      onClose();
    } catch (err: any) {
      alert(err.message || "Operation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-1">
              {isVerificationMode ? "Workflow D — Supervisor Verification" : request ? "Workflow C — Complete Maintenance Request" : "Workflow C — Maintenance Work Entry"}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {isVerificationMode ? `Verify Maintenance Record: ${recordId}` : request ? `Complete Maintenance Request: ${request.requestId} — ${machineName}` : "Record Maintenance Work & Repair Action"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer text-xl"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Identifiers Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-slate-500 font-semibold mb-0.5 text-[11px]">
                Record ID *
              </label>
              <input
                type="text"
                required
                readOnly={isVerificationMode}
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-0.5 text-[11px]">
                Linked Request ID
              </label>
              <input
                type="text"
                readOnly
                placeholder="None (Direct Log)"
                value={requestId}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 font-mono text-slate-600"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-0.5 text-[11px]">
                Maintenance Type *
              </label>
              <select
                disabled={isVerificationMode}
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value as any)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
              >
                <option value="Breakdown">Breakdown</option>
                <option value="Preventive">Preventive</option>
                <option value="Corrective">Corrective</option>
                <option value="Checklist Failure">Checklist Failure</option>
                <option value="AMC / Service">AMC / Service</option>
              </select>
            </div>
          </div>

          {/* Machine Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Machine Asset ID *
              </label>
              <select
                required
                disabled={isVerificationMode}
                value={assetId}
                onChange={(e) => handleAssetChange(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
              >
                {machinesList.map((m) => {
                  const id = m.assetId || m["Asset ID"] || "";
                  const name = m.name || m["Machine Name"] || id;
                  return (
                    <option key={id} value={id}>
                      {id} — {name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Machine Name
              </label>
              <input
                type="text"
                readOnly
                value={machineName}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 font-bold text-slate-800"
              />
            </div>
          </div>

          {/* Problem & Root Cause */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Fault / Defect Description *
              </label>
              <textarea
                required
                rows={2}
                disabled={isVerificationMode}
                placeholder="Observed stoppage, abnormal vibration, alarm code, or failed checklist point..."
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Root Cause Diagnosis *
                </label>
                <textarea
                  required
                  rows={2}
                  disabled={isVerificationMode}
                  placeholder="Mechanical wear, electrical surge, oil contamination, misalignment..."
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Corrective Action Taken *
                </label>
                <textarea
                  required
                  rows={2}
                  disabled={isVerificationMode}
                  placeholder="Replaced seal, adjusted sensor, cleaned filter, realigned guides..."
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Timestamps & Auto-Calculated Duration */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center justify-between">
              <span>Repair Duration & Downtime Telemetry</span>
              <span className="text-emerald-700 font-mono">
                Duration Auto-Calculated
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Repair Start Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  disabled={isVerificationMode}
                  value={repairStartDate}
                  onChange={(e) => setRepairStartDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Repair Completion Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  disabled={isVerificationMode}
                  value={repairCompletionDate}
                  onChange={(e) => setRepairCompletionDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Active Repair Hours:</span>
                <span className="font-black text-slate-900 text-sm font-mono">{repairDurationHours} hrs</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Total Machine Downtime:</span>
                <span className="font-black text-red-700 text-sm font-mono">{downtimeHours} hrs</span>
              </div>
            </div>
          </div>

          {/* Spares, Technician & Costs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Technician Name *
              </label>
              <select
                required
                disabled={isVerificationMode}
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-medium"
              >
                {technicians.map((t) => (
                  <option key={t.userId} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-slate-700 font-semibold mb-1">
                Spare Parts Consumed
              </label>
              <select
                disabled={isVerificationMode}
                value={selectedSparePart}
                onChange={(e) => handleSparePartChange(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="">-- No Spare Parts Used --</option>
                {spares.map((p) => (
                  <option key={p.partId} value={p.partName}>
                    {p.partName} (₹{p.unitCost})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Parts Quantity
              </label>
              <input
                type="number"
                min="0"
                disabled={isVerificationMode || !selectedSparePart}
                value={sparePartsQuantity}
                onChange={(e) => handleQuantityChange(Number(e.target.value))}
                className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Total Maintenance Cost (₹)
              </label>
              <input
                type="number"
                disabled={isVerificationMode}
                value={Number(sparePartsCost) + Number(labourCost)}
                onChange={(e) => setLabourCost(Number(e.target.value) - Number(sparePartsCost))}
                className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-black text-slate-900"
              />
            </div>
          </div>

          {/* Test-Run Result */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Test-Run Evaluation *
              </label>
              <select
                disabled={isVerificationMode}
                value={testRunResult}
                onChange={(e) => setTestRunResult(e.target.value as any)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
              >
                <option value="Passed">Passed (Normal Parameters Restored)</option>
                <option value="Needs Adjustment">Needs Adjustment (Secondary Tuning)</option>
                <option value="Failed">Failed (Abnormal Operating Parameters)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Remarks / Observations
              </label>
              <input
                type="text"
                disabled={isVerificationMode}
                placeholder="Optional notes or operational guidance..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
          </div>

          {/* Workflow D: Verification Section for Supervisors */}
          {isVerificationMode && (
            <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 space-y-3">
              <div className="font-bold text-purple-950 text-xs uppercase tracking-wider flex items-center justify-between">
                <span>Supervisor Verification & Sign-Off</span>
                <span className="text-[11px] text-purple-700">Role: Supervisor / Plant Admin</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-purple-900 font-semibold mb-1 text-xs">
                    Verification Decision *
                  </label>
                  <select
                    value={verifyDecision}
                    onChange={(e) => setVerifyDecision(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-purple-300 bg-white font-bold text-purple-950"
                  >
                    <option value="Approve">Approve & Close Work Order</option>
                    <option value="Reject / Rework">Return for Additional Repair / Rework</option>
                  </select>
                </div>

                <div>
                  <label className="block text-purple-900 font-semibold mb-1 text-xs">
                    Verification Notes
                  </label>
                  <input
                    type="text"
                    value={verifyRemarks}
                    onChange={(e) => setVerifyRemarks(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-purple-300 bg-white"
                  />
                </div>
              </div>

              {/* Safety Critical Sign-off Enforcement */}
              {isSafetyCritical && verifyDecision === "Approve" && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-2">
                  <div className="text-red-950 font-bold flex items-center gap-1.5 text-xs">
                    <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    Safety-Critical Machine Authorization Required
                  </div>
                  <p className="text-[11px] text-red-800">
                    Machine <strong>{machineName} ({assetId})</strong> is categorized as safety-critical. It cannot be marked safe to operate without verified supervisor sign-off and removal of LOTO energy isolations.
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      required
                      checked={safetyReleaseAuthorized}
                      onChange={(e) => setSafetyReleaseAuthorized(e.target.checked)}
                      className="mt-0.5 rounded-sm border-red-400 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-[11px] font-bold text-red-950">
                      I certify that safety interlocks and LOTO isolations have been properly restored, and this machine is safe to return to active production.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-xs font-bold rounded-xl text-white shadow-xs cursor-pointer ${
                isVerificationMode
                  ? verifyDecision === "Approve"
                    ? "bg-purple-700 hover:bg-purple-800"
                    : "bg-red-700 hover:bg-red-800"
                  : "bg-[#880b13] hover:bg-[#6e090f]"
              } disabled:opacity-50`}
            >
              {isSubmitting
                ? "Processing..."
                : isVerificationMode
                ? verifyDecision === "Approve"
                  ? "Approve & Clear Machine"
                  : "Return for Rework"
                : "Submit Work Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
