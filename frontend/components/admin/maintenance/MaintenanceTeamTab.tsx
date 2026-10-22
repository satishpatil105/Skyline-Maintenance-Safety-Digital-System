"use client";

import React, { useMemo } from "react";
import type { TechnicianItem, MaintenanceRequest } from "@/lib/maintenanceSystem";

interface MaintenanceTeamTabProps {
  technicians: TechnicianItem[];
  requests: MaintenanceRequest[];
  onNavigateTab: (tab: any, filter?: string) => void;
}

export default function MaintenanceTeamTab({
  technicians,
  requests,
  onNavigateTab,
}: MaintenanceTeamTabProps) {

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Section 12: Maintenance Engineering Team & Workload Balancer
          </h3>
          <p className="text-xs text-slate-500">
            Technician roster, skill matrices, active work allocations, and availability tracking
          </p>
        </div>
      </div>

      {/* Roster Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {technicians.map((t) => {
          const assignedRequests = requests.filter(
            (r) => (r.technicianName === t.name || r.assignedTo === t.name) && r.status !== "Closed"
          );

          return (
            <div
              key={t.userId}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition-all space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#880b13]/10 text-[#880b13] flex items-center justify-center font-bold text-sm">
                      {t.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{t.name}</h4>
                      <div className="text-[11px] text-slate-500">{t.role}</div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      t.availability === "Available"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : t.availability === "On Job"
                        ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {t.availability}
                  </span>
                </div>

                <div className="mt-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Department / Bay:</span>
                    <span className="font-semibold text-slate-800">{t.department}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>Contact / Phone:</span>
                    <span className="font-mono text-slate-700">{t.phone}</span>
                  </div>

                  {/* Workload Progress Bar */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700 mb-1">
                      <span>Active Workload</span>
                      <span className="font-bold text-[#880b13]">
                        {assignedRequests.length} Active Orders
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          assignedRequests.length >= 3
                            ? "bg-red-500"
                            : assignedRequests.length >= 1
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, assignedRequests.length * 25)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Skills badges */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Technical Competencies:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {t.skills.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom stats & action */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Monthly Closed</span>
                  <span className="font-black text-slate-900">{t.completedThisMonth} Repairs</span>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateTab("requests", t.name)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-[#880b13] hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  View Tasks &rarr;
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
