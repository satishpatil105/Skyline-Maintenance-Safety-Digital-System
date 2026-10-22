"use client";

import React from "react";

export type MaintenanceTabId =
  | "dashboard"
  | "requests"
  | "records"
  | "checklists"
  | "pm"
  | "breakdowns"
  | "amc"
  | "mttr"
  | "history"
  | "spares"
  | "calendar"
  | "team"
  | "documents"
  | "reports";

interface NavItem {
  id: MaintenanceTabId;
  label: string;
  badge?: number | string;
  badgeColor?: string;
  icon: (active: boolean) => React.ReactNode;
}

interface MaintenanceSubNavProps {
  activeTab: MaintenanceTabId;
  onTabChange: (tab: MaintenanceTabId) => void;
  badgeCounts?: {
    openRequests?: number;
    pendingApprovals?: number;
    pmDueToday?: number;
    overduePM?: number;
    criticalBreakdowns?: number;
    expiringAMC?: number;
  };
}

export default function MaintenanceSubNav({
  activeTab,
  onTabChange,
  badgeCounts,
}: MaintenanceSubNavProps) {
  const navItems: NavItem[] = [
    {
      id: "dashboard",
      label: "1. Dashboard",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
        </svg>
      ),
    },
    {
      id: "requests",
      label: "2. Maintenance Requests",
      badge: badgeCounts?.openRequests || 0,
      badgeColor: badgeCounts?.openRequests ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-700",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
      ),
    },
    {
      id: "records",
      label: "3. Maintenance Records",
      badge: badgeCounts?.pendingApprovals ? `${badgeCounts.pendingApprovals} Pending` : undefined,
      badgeColor: "bg-indigo-600 text-white",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
    },
    {
      id: "checklists",
      label: "4. Checklist Records",
      badge: "34 Days",
      badgeColor: "bg-emerald-600 text-white",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
        </svg>
      ),
    },
    {
      id: "pm",
      label: "4. Preventive Maintenance",
      badge: badgeCounts?.overduePM ? `${badgeCounts.overduePM} Overdue` : badgeCounts?.pmDueToday ? `${badgeCounts.pmDueToday} Due` : undefined,
      badgeColor: badgeCounts?.overduePM ? "bg-red-600 text-white" : "bg-emerald-600 text-white",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ),
    },
    {
      id: "breakdowns",
      label: "5. Breakdown Maintenance",
      badge: badgeCounts?.criticalBreakdowns ? `${badgeCounts.criticalBreakdowns} Active` : undefined,
      badgeColor: "bg-red-600 text-white",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
    },
    {
      id: "amc",
      label: "6. AMC & Service Reports",
      badge: badgeCounts?.expiringAMC ? `${badgeCounts.expiringAMC} Renew` : undefined,
      badgeColor: "bg-purple-600 text-white",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
        </svg>
      ),
    },
    {
      id: "mttr",
      label: "7. MTTR & MTBF Reports",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      ),
    },
    {
      id: "history",
      label: "8. Machine History",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      id: "spares",
      label: "9. Spare Parts & Consumption",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      ),
    },
    {
      id: "calendar",
      label: "10. Schedule & Calendar",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
      ),
    },
    {
      id: "team",
      label: "11. Team & Work Allocation",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.999-3.199a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      ),
    },
    {
      id: "documents",
      label: "12. Maintenance Documents",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
        </svg>
      ),
    },
    {
      id: "reports",
      label: "13. Maintenance Reports",
      icon: (active) => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={active ? "2.4" : "1.8"} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200 shadow-2xs rounded-xl overflow-hidden mb-5">
      <div className="px-3 pt-2.5 pb-1 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#880b13] animate-pulse"></span>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            SkyMS Industrial Maintenance Management Module
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-700 font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          MongoDB Atlas Connected
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
        <nav className="flex space-x-1 p-1.5 min-w-max" aria-label="Maintenance Submodules">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`group flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-[#880b13] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span className={isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700"}>
                  {item.icon(isActive)}
                </span>
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? "bg-white/20 text-white" : item.badgeColor || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
