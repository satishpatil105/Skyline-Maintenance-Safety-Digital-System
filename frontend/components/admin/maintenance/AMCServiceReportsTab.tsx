"use client";

import React, { useState, useMemo } from "react";
import type { AMCContractItem, AMCServiceReportItem } from "@/lib/maintenanceSystem";

interface AMCServiceReportsTabProps {
  contracts: AMCContractItem[];
  reports: AMCServiceReportItem[];
  machinesList: Array<{ assetId?: string; name?: string; "Asset ID"?: string; "Machine Name"?: string }>;
  onCreateContract: (contract: any) => Promise<void>;
  onCreateReport: (report: any) => Promise<void>;
  onRefresh: () => void;
}

export default function AMCServiceReportsTab({
  contracts,
  reports,
  machinesList,
  onCreateContract,
  onCreateReport,
  onRefresh,
}: AMCServiceReportsTabProps) {
  const [subTab, setSubTab] = useState<"contracts" | "reports">("contracts");
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New contract state
  const [vendorName, setVendorName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [coveredMachine, setCoveredMachine] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState("");
  const [frequency, setFrequency] = useState<any>("Quarterly");
  const [contractValue, setContractValue] = useState("");
  const [terms, setTerms] = useState("");

  // New report state
  const [selectedContractId, setSelectedContractId] = useState("");
  const [reportAssetId, setReportAssetId] = useState("");
  const [engineerName, setEngineerName] = useState("");
  const [engineerPhone, setEngineerPhone] = useState("");
  const [observations, setObservations] = useState("");
  const [workDone, setWorkDone] = useState("");
  const [partsReplaced, setPartsReplaced] = useState("");
  const [testResult, setTestResult] = useState<any>("Satisfactory");
  const [pendingWork, setPendingWork] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [nextVisit, setNextVisit] = useState("");

  const handleContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName || !startDate || !expiryDate) return;

    const matched = machinesList.find((m) => (m.assetId || m["Asset ID"]) === coveredMachine);
    const mName = matched ? matched.name || matched["Machine Name"] || coveredMachine : coveredMachine;

    setIsSubmitting(true);
    try {
      await onCreateContract({
        serviceProvider: vendorName,
        contactPerson,
        contactPhone,
        contactEmail,
        coveredMachines: coveredMachine ? [coveredMachine] : [],
        coveredMachineNames: coveredMachine ? [mName] : [],
        startDate,
        expiryDate,
        serviceFrequency: frequency,
        contractValue: Number(contractValue || 0),
        status: "Active",
        terms,
      });
      setContractModalOpen(false);
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportAssetId || !observations || !engineerName) return;

    const matched = machinesList.find((m) => (m.assetId || m["Asset ID"]) === reportAssetId);
    const mName = matched ? matched.name || matched["Machine Name"] || reportAssetId : reportAssetId;

    setIsSubmitting(true);
    try {
      await onCreateReport({
        contractId: selectedContractId || "AMC-GENERAL",
        assetId: reportAssetId,
        machineName: mName,
        serviceDate: new Date().toISOString().slice(0, 10),
        serviceEngineerName: engineerName,
        serviceEngineerContact: engineerPhone,
        observations,
        workPerformed: workDone,
        partsReplaced,
        testResults: testResult,
        pendingWork,
        recommendations,
        nextServiceDate: nextVisit,
      });
      setReportModalOpen(false);
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="space-y-4">
      {/* Sub-navigation & Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Section 7: Internal AMC & External Service Management
            </h3>
            <p className="text-xs text-slate-500">
              OEM service contracts, warranty tracking, visit telemetry, and auto-generated follow-up requests
            </p>
          </div>
          <div className="flex items-center gap-2">
            {subTab === "contracts" ? (
              <button
                type="button"
                onClick={() => setContractModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Register AMC Contract
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#880b13] hover:bg-[#6e090f] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Log Service Visit Report
              </button>
            )}
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

        {/* Sub-tab pills */}
        <div className="flex gap-2 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSubTab("contracts")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
              subTab === "contracts"
                ? "bg-purple-100 text-purple-900 border border-purple-200"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Active AMC Contracts ({contracts.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("reports")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
              subTab === "reports"
                ? "bg-purple-100 text-purple-900 border border-purple-200"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Service Visit Reports & History ({reports.length})
          </button>
        </div>
      </div>

      {/* Subtab 1: AMC Contracts */}
      {subTab === "contracts" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
                  <th className="py-3 px-3">Contract ID</th>
                  <th className="py-3 px-3">Service Provider</th>
                  <th className="py-3 px-3">Contact Person</th>
                  <th className="py-3 px-3">Covered Machines</th>
                  <th className="py-3 px-3">Start Date</th>
                  <th className="py-3 px-3">Expiry Date</th>
                  <th className="py-3 px-3">Frequency</th>
                  <th className="py-3 px-3 text-right">Value (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Terms & Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No AMC contracts registered.
                    </td>
                  </tr>
                ) : (
                  contracts.map((c) => (
                    <tr key={c.contractId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {c.contractId}
                      </td>

                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {c.serviceProvider}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-slate-800">{c.contactPerson}</div>
                        <div className="text-[10px] text-slate-400">{c.contactPhone}</div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800">
                        {c.coveredMachineNames && c.coveredMachineNames.length > 0
                          ? c.coveredMachineNames.join(", ")
                          : c.coveredMachines.join(", ")}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                        {c.startDate}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-900">
                        {c.expiryDate}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 border border-slate-200">
                          {c.serviceFrequency}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{c.contractValue.toLocaleString("en-IN")}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            c.status === "Active"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : c.status === "Expiring Soon"
                              ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                              : "bg-red-50 text-red-800 border-red-300"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-xs truncate text-slate-500" title={c.terms}>
                        {c.terms || "Standard service terms"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Service Reports */}
      {subTab === "reports" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
                  <th className="py-3 px-3">Report ID</th>
                  <th className="py-3 px-3">Service Date</th>
                  <th className="py-3 px-3">Machine</th>
                  <th className="py-3 px-3">Service Engineer</th>
                  <th className="py-3 px-3">Observations</th>
                  <th className="py-3 px-3">Work Performed</th>
                  <th className="py-3 px-3">Parts Replaced</th>
                  <th className="py-3 px-3 text-center">Test Results</th>
                  <th className="py-3 px-3">Recommendations</th>
                  <th className="py-3 px-3">Next Visit Date</th>
                  <th className="py-3 px-3">Generated Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      No service visit reports recorded yet.
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.reportId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {r.reportId}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                        {r.serviceDate}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{r.machineName}</div>
                        <div className="text-[10px] font-mono text-slate-500">{r.assetId}</div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{r.serviceEngineerName}</div>
                        <div className="text-[10px] text-slate-400">{r.serviceEngineerContact}</div>
                      </td>

                      <td className="py-3 px-3 max-w-xs truncate text-slate-700" title={r.observations}>
                        {r.observations}
                      </td>

                      <td className="py-3 px-3 max-w-xs truncate text-slate-800 font-medium" title={r.workPerformed}>
                        {r.workPerformed}
                      </td>

                      <td className="py-3 px-3 max-w-xs truncate font-mono text-[11px] text-slate-600">
                        {r.partsReplaced || "None"}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            r.testResults === "Satisfactory"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}
                        >
                          {r.testResults}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-xs truncate text-slate-600" title={r.recommendations}>
                        {r.recommendations || "Routine operation satisfactory"}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-700">
                        {r.nextServiceDate || "TBD"}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {r.generatedRequestId ? (
                          <span className="font-bold text-[#880b13]">{r.generatedRequestId}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register Contract Modal */}
      {contractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleContractSubmit}
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-900">
                Register AMC / Service Contract
              </h4>
              <button
                type="button"
                onClick={() => setContractModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  OEM / Service Provider Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Trumpf Laser India Pvt Ltd"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mahesh Joshi"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98000 00000"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Covered Machine Asset
                </label>
                <select
                  value={coveredMachine}
                  onChange={(e) => setCoveredMachine(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="">-- All Plant Machines / Multi-Asset --</option>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Contract Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Contract Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Service Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Bi-Monthly">Bi-Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Bi-Annual">Bi-Annual</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Contract Value (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="450000"
                    value={contractValue}
                    onChange={(e) => setContractValue(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Contract Terms & SLA Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Guaranteed callout response within 4 hours, spare parts discount 15%..."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setContractModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? "Saving..." : "Save Contract"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Log Service Visit Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleReportSubmit}
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-900">
                Log External Service Visit Report
              </h4>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Related AMC Contract
                  </label>
                  <select
                    value={selectedContractId}
                    onChange={(e) => setSelectedContractId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Standalone Service Visit --</option>
                    {contracts.map((c) => (
                      <option key={c.contractId} value={c.contractId}>
                        {c.serviceProvider} ({c.contractId})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Machine Serviced *
                  </label>
                  <select
                    required
                    value={reportAssetId}
                    onChange={(e) => setReportAssetId(e.target.value)}
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    OEM Service Engineer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajiv Nambiar"
                    value={engineerName}
                    onChange={(e) => setEngineerName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Engineer Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98220 54322"
                    value={engineerPhone}
                    onChange={(e) => setEngineerPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Observations / Technical Condition *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Record optics health, oil contamination, pressure values..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Work Performed
                </label>
                <textarea
                  rows={2}
                  placeholder="Calibration, optics alignment, hydraulic valve tuning..."
                  value={workDone}
                  onChange={(e) => setWorkDone(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Parts Replaced
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Protective Window 30x5mm"
                    value={partsReplaced}
                    onChange={(e) => setPartsReplaced(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Test Run Result
                  </label>
                  <select
                    value={testResult}
                    onChange={(e) => setTestResult(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Satisfactory">Satisfactory (Passed)</option>
                    <option value="Conditional Pass">Conditional Pass</option>
                    <option value="Unsatisfactory">Unsatisfactory (Defect Remains)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Pending Work (Will Auto-generate Maintenance Request)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hydraulic proportional valve replacement needed"
                  value={pendingWork}
                  onChange={(e) => setPendingWork(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Recommendations
                  </label>
                  <input
                    type="text"
                    placeholder="Replace diaphragm in next visit"
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Next Recommended Service Date
                  </label>
                  <input
                    type="date"
                    value={nextVisit}
                    onChange={(e) => setNextVisit(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#880b13] text-white hover:bg-[#6e090f] disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? "Saving..." : "Record Service Visit"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
