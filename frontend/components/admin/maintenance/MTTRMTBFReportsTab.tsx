"use client";

import React, { useMemo, useState } from "react";
import type { MachineMTTRMetric } from "@/lib/maintenanceSystem";

interface MTTRMTBFReportsTabProps {
  metrics: MachineMTTRMetric[];
  onRefresh: () => void;
  onSelectMachine: (assetId: string) => void;
}

export default function MTTRMTBFReportsTab({
  metrics,
  onRefresh,
  onSelectMachine,
}: MTTRMTBFReportsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"downtime" | "mttr" | "mtbf" | "breakdowns" | "cost">("downtime");

  const sortedMetrics = useMemo(() => {
    return [...metrics]
      .filter((m) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          m.assetId.toLowerCase().includes(q) ||
          m.machineName.toLowerCase().includes(q) ||
          m.recurringFaults.some((f) => f.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === "downtime") return b.totalDowntimeHours - a.totalDowntimeHours;
        if (sortBy === "mttr") return (b.mttrHours || 0) - (a.mttrHours || 0);
        if (sortBy === "mtbf") return (b.mtbfHours || 0) - (a.mtbfHours || 0);
        if (sortBy === "breakdowns") return b.breakdownCount - a.breakdownCount;
        if (sortBy === "cost") return b.totalMaintenanceCost - a.totalMaintenanceCost;
        return 0;
      });
  }, [metrics, searchTerm, sortBy]);


  return (
    <div className="space-y-4">
      {/* Formula Explainer Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Section 8: MTTR & MTBF Mathematical Engineering Telemetry
            </h3>
            <p className="text-xs text-slate-500">
              Reliability metrics computed strictly from verified Atlas maintenance records and breakdown intervals
            </p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Engineering Formula Definitions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200">
            <div className="font-bold text-teal-950 flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-teal-600"></span>
              Mean Time to Repair (MTTR)
            </div>
            <div className="font-mono text-[11px] text-teal-800 bg-white/80 p-2 rounded-lg border border-teal-200">
              MTTR = Total eligible repair time ÷ Number of eligible completed repairs
            </div>
            <p className="text-[11px] text-teal-700 mt-1">
              Open/in-progress repairs are excluded to prevent premature skewing. Measures technician repair efficiency.
            </p>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
            <div className="font-bold text-blue-950 flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Mean Time Between Failures (MTBF)
            </div>
            <div className="font-mono text-[11px] text-blue-800 bg-white/80 p-2 rounded-lg border border-blue-200">
              MTBF = Total eligible operating time between failures ÷ Number of eligible failure intervals
            </div>
            <p className="text-[11px] text-blue-700 mt-1">
              Calculated using actual operating hours (excluding downtime). Labeled N/A when valid data is insufficient.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search machine or recurring fault..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
            <span className="text-slate-500 font-semibold whitespace-nowrap">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
            >
              <option value="downtime">Highest Downtime</option>
              <option value="mttr">Highest MTTR (Longest Repair)</option>
              <option value="mtbf">Lowest MTBF (Frequent Failure)</option>
              <option value="breakdowns">Most Breakdowns</option>
              <option value="cost">Highest Maintenance Cost</option>
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
                <th className="py-3 px-3">Asset ID</th>
                <th className="py-3 px-3">Machine Name</th>
                <th className="py-3 px-3 text-center">Breakdowns</th>
                <th className="py-3 px-3 text-center">Completed Repairs</th>
                <th className="py-3 px-3 text-right">Total Downtime</th>
                <th className="py-3 px-3 text-center bg-teal-50/50">MTTR (Repair Time)</th>
                <th className="py-3 px-3 text-center bg-blue-50/50">MTBF (Reliability)</th>
                <th className="py-3 px-3 text-center">MTBF Calculation Basis</th>
                <th className="py-3 px-3 text-center">Availability %</th>
                <th className="py-3 px-3 text-right">Maintenance Cost</th>
                <th className="py-3 px-3">Recurring Fault Phrases</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {sortedMetrics.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    No machine telemetry matches filter.
                  </td>
                </tr>
              ) : (
                sortedMetrics.map((m) => (
                  <tr key={m.assetId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {m.assetId}
                    </td>

                    <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {m.machineName}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.breakdownCount > 0 ? "bg-red-50 text-red-800 border border-red-200" : "text-slate-400"
                      }`}>
                        {m.breakdownCount}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {m.completedRepairsCount}
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-red-700 whitespace-nowrap">
                      {m.totalDowntimeHours}h
                    </td>

                    {/* MTTR */}
                    <td className="py-3 px-3 text-center whitespace-nowrap bg-teal-50/30">
                      {m.mttrHours !== null ? (
                        <span className="font-mono font-black text-teal-800 text-sm">
                          {m.mttrHours} hrs
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">N/A</span>
                      )}
                    </td>

                    {/* MTBF */}
                    <td className="py-3 px-3 text-center whitespace-nowrap bg-blue-50/30">
                      {m.mtbfHours !== null ? (
                        <span className="font-mono font-black text-blue-900 text-sm">
                          {m.mtbfHours} hrs
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">N/A</span>
                      )}
                    </td>

                    {/* MTBF Basis */}
                    <td className="py-3 px-3 text-center whitespace-nowrap text-[11px]">
                      <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${
                        m.mtbfType === "Actual Operating Hours"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : m.mtbfType === "Calendar Hours"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "text-slate-400"
                      }`}>
                        {m.mtbfType}
                      </span>
                    </td>

                    {/* Availability % */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              m.availabilityPercent >= 98
                                ? "bg-emerald-500"
                                : m.availabilityPercent >= 90
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${m.availabilityPercent}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-slate-800">{m.availabilityPercent}%</span>
                      </div>
                    </td>

                    {/* Maintenance Cost */}
                    <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      ₹{m.totalMaintenanceCost.toLocaleString("en-IN")}
                    </td>

                    {/* Recurring Faults */}
                    <td className="py-3 px-3 max-w-xs truncate text-[11px] text-slate-600" title={m.recurringFaults.join(", ")}>
                      {m.recurringFaults.length > 0 ? (
                        <span className="font-semibold text-slate-800">
                          {m.recurringFaults.join(", ")}
                        </span>
                      ) : (
                        <span className="text-slate-300">None detected</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectMachine(m.assetId)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
                      >
                        Machine History &rarr;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
