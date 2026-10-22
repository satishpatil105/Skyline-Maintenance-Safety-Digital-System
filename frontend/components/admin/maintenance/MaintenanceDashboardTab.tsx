"use client";

import React, { useMemo } from "react";
import type { MaintenanceDashboardStats } from "@/lib/maintenanceSystem";
import type { MaintenanceTabId } from "./MaintenanceSubNav";

interface MaintenanceDashboardTabProps {
  stats: MaintenanceDashboardStats;
  onNavigateTab: (tab: MaintenanceTabId, filter?: string) => void;
  onOpenCreateWorkEntry: () => void;
}

export default function MaintenanceDashboardTab({
  stats,
  onNavigateTab,
  onOpenCreateWorkEntry,
}: MaintenanceDashboardTabProps) {
  // Color tokens and KPI card configs
  const kpiCards = [
    {
      title: "Total Machines",
      value: stats.totalMachines,
      unit: "Units",
      subtitle: "Active plant inventory",
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.07a4.5 4.5 0 0 0 4.486-6.32l-3.276 3.277a1.5 1.5 0 0 1-2.122-2.122l3.277-3.276a4.5 4.5 0 0 0-6.32 4.486c.118.58.094 1.193-.07 1.743" />
        </svg>
      ),
      bg: "bg-blue-50/70 border-blue-200 hover:border-blue-300",
      targetTab: "history" as MaintenanceTabId,
    },
    {
      title: "Open Maintenance Requests",
      value: stats.openRequests,
      unit: "Reqs",
      subtitle: "Awaiting resolution",
      icon: (
        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
      ),
      bg: "bg-amber-50/70 border-amber-200 hover:border-amber-300",
      targetTab: "requests" as MaintenanceTabId,
      filter: "Open",
    },
    {
      title: "Critical Issues",
      value: stats.criticalIssues,
      unit: "Alerts",
      subtitle: "Safety/Urgent breakdown",
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
      bg: "bg-red-50/70 border-red-200 hover:border-red-300",
      targetTab: "requests" as MaintenanceTabId,
      filter: "Critical",
    },
    {
      title: "Breakdowns This Month",
      value: stats.breakdownsThisMonth,
      unit: "Incidents",
      subtitle: "Monthly recorded events",
      icon: (
        <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.048 8.287 8.287 0 0 0 9 9.6a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
        </svg>
      ),
      bg: "bg-rose-50/70 border-rose-200 hover:border-rose-300",
      targetTab: "breakdowns" as MaintenanceTabId,
    },
    {
      title: "PM Due Today",
      value: stats.pmDueToday,
      unit: "Tasks",
      subtitle: "Preventive schedule target",
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      bg: "bg-emerald-50/70 border-emerald-200 hover:border-emerald-300",
      targetTab: "pm" as MaintenanceTabId,
      filter: "Due Today",
    },
    {
      title: "Overdue PM Tasks",
      value: stats.overduePMTasks,
      unit: "Delayed",
      subtitle: "Requires immediate attention",
      icon: (
        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      bg: "bg-orange-50/70 border-orange-200 hover:border-orange-300",
      targetTab: "pm" as MaintenanceTabId,
      filter: "Overdue",
    },
    {
      title: "Repairs in Progress",
      value: stats.repairsInProgress,
      unit: "Active",
      subtitle: "Technicians on site",
      icon: (
        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.398-3.03 1.164l-6.84 6.84a2.25 2.25 0 0 1-3.182-3.182l6.84-6.84c.766-.766 1.255-1.954 1.164-3.03A4.5 4.5 0 0 1 16.5 2.25a.75.75 0 0 1 .65.375l2.25 3.75a.75.75 0 0 1-.15.825l-.75.75a.75.75 0 0 0 0 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l.75-.75a.75.75 0 0 1 .825-.15l3.75 2.25a.75.75 0 0 1 .375.65Z" />
        </svg>
      ),
      bg: "bg-indigo-50/70 border-indigo-200 hover:border-indigo-300",
      targetTab: "requests" as MaintenanceTabId,
      filter: "In Progress",
    },
    {
      title: "Pending Approvals",
      value: stats.pendingSupervisorApprovals,
      unit: "Orders",
      subtitle: "Supervisor verification queue",
      icon: (
        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      bg: "bg-purple-50/70 border-purple-200 hover:border-purple-300",
      targetTab: "records" as MaintenanceTabId,
      filter: "Pending Approval",
    },
    {
      title: "Total Downtime",
      value: stats.totalDowntimeHours,
      unit: "Hours",
      subtitle: "Cumulative plant outage",
      icon: (
        <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      bg: "bg-slate-50 border-slate-300 hover:border-slate-400",
      targetTab: "mttr" as MaintenanceTabId,
    },
    {
      title: "Average MTTR",
      value: stats.averageMTTRHours !== null ? stats.averageMTTRHours : "N/A",
      unit: stats.averageMTTRHours !== null ? "Hours/Rep" : "",
      subtitle: "Mean time to repair",
      icon: (
        <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      ),
      bg: "bg-teal-50/70 border-teal-200 hover:border-teal-300",
      targetTab: "mttr" as MaintenanceTabId,
    },
    {
      title: "Awaiting Safety Release",
      value: stats.machinesAwaitingSafetyRelease,
      unit: "Machines",
      subtitle: "Critical safety lock",
      icon: (
        <svg className="w-5 h-5 text-rose-700" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      ),
      bg: "bg-rose-50 border-rose-300 hover:border-rose-400",
      targetTab: "records" as MaintenanceTabId,
      filter: "Safety Critical",
    },
    {
      title: "Upcoming AMC Visits",
      value: stats.upcomingAMCVistits,
      unit: "Contracts",
      subtitle: "Active vendor service",
      icon: (
        <svg className="w-5 h-5 text-cyan-700" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6H2.25m0 0H3m0 0h12m6 0h.75m0 0a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-.75.75h-.75m0-13.5H15m0 0a.75.75 0 0 0-.75.75v12a.75.75 0 0 0 .75.75h6m-6-13.5v13.5" />
        </svg>
      ),
      bg: "bg-cyan-50/70 border-cyan-200 hover:border-cyan-300",
      targetTab: "amc" as MaintenanceTabId,
    },
  ];

  const maxDowntime = Math.max(1, ...stats.machineDowntimeDistribution.map((d) => d.hours));


  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-[#880b13] to-slate-900 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-xs mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Live Industrial ERP Telemetry
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">
            Maintenance Operations & Asset Health Control
          </h2>
          <p className="text-xs md:text-sm text-slate-200 mt-1 max-w-2xl">
            Real-time monitoring of breakdown response, preventive compliance, MTTR/MTBF metrics, and cross-functional work order lifecycle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCreateWorkEntry}
            className="flex items-center gap-2 px-3.5 py-2 bg-white text-[#880b13] rounded-xl text-xs font-bold shadow-xs hover:bg-slate-100 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Start Work Entry
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab("requests")}
            className="flex items-center gap-2 px-3.5 py-2 bg-white/15 text-white border border-white/25 rounded-xl text-xs font-bold hover:bg-white/20 transition-all cursor-pointer"
          >
            View Open Requests ({stats.openRequests})
          </button>
        </div>
      </div>

      {/* 12 Live KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
        {kpiCards.map((card, i) => (
          <div
            key={i}
            onClick={() => onNavigateTab(card.targetTab, card.filter)}
            className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs group flex flex-col justify-between ${card.bg}`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 line-clamp-1 group-hover:text-slate-900">
                {card.title}
              </span>
              <div className="p-1 rounded-lg bg-white/80 shadow-2xs shrink-0">
                {card.icon}
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {card.value}
                </span>
                {card.unit && (
                  <span className="text-[11px] font-bold text-slate-500">
                    {card.unit}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1 font-medium">
                {card.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Machine Downtime Distribution */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Machine-wise Downtime Distribution
              </h3>
              <p className="text-xs text-slate-500">
                Top machinery impacted by breakdowns & repairs (Cumulative hours)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("mttr")}
              className="text-xs text-[#880b13] font-bold hover:underline cursor-pointer"
            >
              Full Analysis &rarr;
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {stats.machineDowntimeDistribution.map((item, idx) => {
              const pct = Math.min(100, Math.round((item.hours / maxDowntime) * 100));
              return (
                <div
                  key={idx}
                  onClick={() => onNavigateTab("history", item.name)}
                  className="cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800 group-hover:text-[#880b13]">
                      {item.name}
                    </span>
                    <span className="font-bold text-slate-700">
                      {item.hours} hrs
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        idx === 0
                          ? "bg-red-500"
                          : idx === 1
                          ? "bg-amber-500"
                          : "bg-[#880b13]"
                      }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: PM Compliance Rate & Maintenance Type Breakdown */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* PM Compliance Gauge */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex-1">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  PM Schedule Compliance Rate
                </h3>
                <p className="text-xs text-slate-500">
                  Preventive maintenance completion vs schedule
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                Target: 95%
              </span>
            </div>

            <div className="flex items-center gap-6 mt-3">
              <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500"
                    strokeDasharray={`${stats.pmComplianceRate}, 100`}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-lg font-black text-slate-900">
                    {stats.pmComplianceRate}%
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-600 font-medium">Completed on time</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-slate-600 font-medium">Due Today ({stats.pmDueToday})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="text-slate-600 font-medium">Overdue ({stats.overduePMTasks})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Maintenance Types Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex-1">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Work Order Type Distribution
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Distribution across maintenance categories
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {stats.maintenanceTypeBreakdown.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onNavigateTab("records", item.type)}
                  className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors"
                >
                  <div className="font-semibold text-slate-600 truncate">{item.type}</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">{item.count} Orders</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Trends & Recurring Faults Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Breakdown Monthly Trends */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Breakdown & Downtime Trends (Last 6 Months)
              </h3>
              <p className="text-xs text-slate-500">
                Monthly breakdown count vs total production downtime hours
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">FY 2026</span>
          </div>

          <div className="grid grid-cols-6 gap-2 pt-4 border-t border-slate-100">
            {stats.breakdownMonthlyTrends.map((trend, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="text-[11px] font-bold text-slate-800 mb-1">
                  {trend.count}
                </div>
                <div className="w-8 bg-slate-100 h-28 rounded-lg flex items-end p-1">
                  <div
                    className="w-full bg-[#880b13] rounded-md transition-all duration-300"
                    style={{ height: `${Math.min(100, (trend.count / 10) * 100)}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 mt-2 truncate w-full text-center">
                  {trend.month.split(" ")[0]}
                </span>
                <span className="text-[9px] text-slate-400">
                  {trend.downtime}h
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Recurring Faults */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Top Recurring Machine Faults
                </h3>
                <p className="text-xs text-slate-500">
                  Frequent root causes flagged during maintenance
                </p>
              </div>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">
                Root Cause Analysis
              </span>
            </div>

            <div className="space-y-2.5 mt-2">
              {stats.topRecurringFaults.map((f, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px]">
                      #{i + 1}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {f.fault}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {f.count} occurrences
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Need detailed breakdown root cause?</span>
            <button
              type="button"
              onClick={() => onNavigateTab("breakdowns")}
              className="text-[#880b13] font-bold hover:underline cursor-pointer"
            >
              Open Breakdown Register &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
