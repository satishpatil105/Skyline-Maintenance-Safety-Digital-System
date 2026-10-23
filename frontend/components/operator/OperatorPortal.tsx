"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import logoImg from "@/app/logo.png";
import MachineSearchCard from "./MachineSearchCard";
import MachineQrScannerModal from "./MachineQrScannerModal";
import MaintenanceForm from "./MaintenanceForm";
import SafetyForm from "./SafetyForm";
import { SessionUser } from "@/lib/auth";
import type { Machine } from "@/lib/types";

interface OperatorPortalProps {
  user: SessionUser;
  initialTab?: string;
  assignedMachine: {
    "Asset ID": string;
    "Machine Name": string;
    Department?: string;
    Location?: string;
    Status?: string;
  } | null;
  assignedMachines?: Array<{
    "Asset ID": string;
    "Machine Name": string;
    Department?: string;
    Location?: string;
    Status?: string;
  }>;
  allMachines?: Array<{
    "Asset ID": string;
    "Machine Name": string;
    Department?: string;
    Location?: string;
    Status?: string;
  }>;
}

export default function OperatorPortal({
  user,
  initialTab = "dashboard",
  assignedMachine = null,
  assignedMachines = [],
  allMachines = [],
}: OperatorPortalProps) {
  const [currentMachine, setCurrentMachine] = useState(
    assignedMachine || (assignedMachines.length > 0 ? assignedMachines[0] : null)
  );

  useEffect(() => {
    if (assignedMachine) {
      setCurrentMachine(assignedMachine);
    } else if (assignedMachines.length > 0) {
      setCurrentMachine(assignedMachines[0]);
    }
  }, [assignedMachine, assignedMachines]);

  const [showScanner, setShowScanner] = useState(false);

  type ActionTab = "hub" | "maintenance" | "safety" | "shift-checklist";

  const getInitialAction = (slug?: string): ActionTab => {
    const s = (slug || "").toLowerCase();
    if (s.includes("maint") || s.includes("breakdown")) return "maintenance";
    if (s.includes("safety") || s.includes("hazard")) return "safety";
    if (s.includes("checklist") || s.includes("shift")) return "shift-checklist";
    return "hub";
  };

  const [activeAction, setActiveAction] = useState<ActionTab>(() =>
    getInitialAction(initialTab)
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showSafetyForm, setShowSafetyForm] = useState(false);

  const [stats, setStats] = useState({
    openBreakdowns: 0,
    safetyHazards: 0,
    checklistsToday: 1,
    totalMaintenance: 0,
    totalSafety: 0,
    recentActivity: [] as Array<{
      id: string;
      type: string;
      title: string;
      priority: string;
      status: string;
      date: string;
    }>,
    priorityCounts: { Critical: 0, High: 0, Medium: 0, Low: 0 },
  });

  const loadDashboardStats = useCallback(async () => {
    try {
      const [mRes, sRes, cRes] = await Promise.all([
        fetch("/api/maintenance", { cache: "no-store" }),
        fetch("/api/safety", { cache: "no-store" }),
        fetch("/api/checklist", { cache: "no-store" }),
      ]);
      const mJson = await mRes.json();
      const sJson = await sRes.json();
      const cJson = await cRes.json().catch(() => ({}));
      const checklistMachines = Array.isArray(cJson?.machines) ? cJson.machines : [];
      const checklistsDueToday = checklistMachines.reduce((sum: number, m: any) => sum + (Number(m.dueNow) || 0), 0);

      const assignedAsset = (currentMachine?.["Asset ID"] || user?.departmentMachine || "").trim().toLowerCase();
      const assignedName = (currentMachine?.["Machine Name"] || user?.departmentMachine || "").trim().toLowerCase();

      // Strictly exclude routine checklist inspection records (CHK-...) so only genuine breakdown tickets are counted and shown
      let mRecords = (mJson.success && Array.isArray(mJson.records) ? mJson.records : []).filter((r: any) => {
        const id = String(r.recordId || r["Record ID"] || r.logId || r["Log ID"] || "");
        const type = String(r.recordType || r["Record Type"] || r.maintenanceType || "").toLowerCase();
        return !id.startsWith("CHK-") && type !== "inspection";
      });
      let sRecords = sJson.success && Array.isArray(sJson.records) ? sJson.records : [];

      if (user?.role !== "Admin" && user?.role !== "Supervisor" && (assignedAsset || assignedName)) {
        mRecords = mRecords.filter((r: any) => {
          const rAsset = (r.assetId || r["Asset ID"] || "").trim().toLowerCase();
          const rName = (r.machineName || r["Machine Name"] || r["Machine / Equipment"] || r["Machine"] || "").trim().toLowerCase();
          return (assignedAsset && rAsset && (rAsset === assignedAsset || rAsset.includes(assignedAsset) || assignedAsset.includes(rAsset))) ||
            (assignedName && rName && (rName === assignedName || rName.includes(assignedName) || assignedName.includes(rName)));
        });

        sRecords = sRecords.filter((r: any) => {
          const rAsset = (r.assetId || r["Asset ID"] || "").trim().toLowerCase();
          const rName = (r.machineName || r["Machine Name"] || r["Machine / Equipment"] || r["Machine"] || "").trim().toLowerCase();
          return (assignedAsset && rAsset && (rAsset === assignedAsset || rAsset.includes(assignedAsset) || assignedAsset.includes(rAsset))) ||
            (assignedName && rName && (rName === assignedName || rName.includes(assignedName) || assignedName.includes(rName)));
        });
      }

      const openBreakdowns = mRecords.filter((r: any) => {
        const st = (r.status || r["Status"] || "").toLowerCase();
        return st === "open" || st === "in progress" || st === "pending";
      }).length;

      const safetyHazards = sRecords.filter((r: any) => {
        const st = (r.status || r["Status"] || "").toLowerCase();
        return st === "open" || st === "in progress" || st === "pending";
      }).length;

      const prioCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
      mRecords.forEach((r: any) => {
        const p = (r.priority || r["Priority"] || "Medium").trim();
        if (p in prioCounts) (prioCounts as any)[p]++;
        else prioCounts.Medium++;
      });

      const recent = [
        ...mRecords.map((r: any) => ({
          id: String(r.recordId || r["Record ID"] || "BD-001"),
          type: "Breakdown Ticket",
          title: String(r.problem || r["Problem / Breakdown"] || r["Problem / Request"] || r["Breakdown Issue"] || "Machine Maintenance"),
          priority: String(r.priority || r["Priority"] || "Medium"),
          status: String(r.status || r["Status"] || "Open"),
          date: String(r.date || r["Date"] || (r.createdAt ? String(r.createdAt).slice(0, 10) : "Today")),
        })),
        ...sRecords.map((r: any) => ({
          id: String(r.recordId || r["Record ID"] || "SAF-001"),
          type: "Safety Hazard",
          title: String(r.hazardDescription || r["Observation Details"] || "Safety Observation"),
          priority: String(r.riskLevel || r["Risk Level"] || "Medium"),
          status: String(r.status || r["Status"] || "Open"),
          date: String(r.date || r["Date"] || (r.createdAt ? String(r.createdAt).slice(0, 10) : "Today")),
        })),
      ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5);

      setStats({
        openBreakdowns,
        safetyHazards,
        checklistsToday: checklistsDueToday,
        totalMaintenance: mRecords.length,
        totalSafety: sRecords.length,
        recentActivity: recent,
        priorityCounts: prioCounts,
      });
    } catch (err) {
      console.warn("Error loading dashboard stats", err);
    }
  }, [currentMachine, user]);

  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

  useEffect(() => {
    setActiveAction(getInitialAction(initialTab));
  }, [initialTab]);

  const handleActionChange = (action: ActionTab) => {
    setActiveAction(action);
    const slug =
      action === "hub"
        ? "dashboard"
        : action === "maintenance"
          ? "breakdown-ticket"
          : action === "safety"
            ? "safety-observation"
            : "shift-checklist";

    if (typeof window !== "undefined") {
      window.history.pushState({ action }, "", `/operator/${slug}`);
    }
  };

  const safeMachines = Array.isArray(allMachines) ? allMachines : [];

  const activeLabel =
    activeAction === "hub"
      ? "Dashboard"
      : activeAction === "maintenance"
        ? "Breakdown Ticket"
        : activeAction === "safety"
          ? "Safety Observation"
          : "Shift Checklist";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ==================================================
          LEFT SIDEBAR: EXECUTIVE SUPERVISOR STYLE LAYOUT
      ================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 shadow-lg lg:shadow-none transition-all duration-300 ease-in-out ${mobileMenuOpen
          ? "translate-x-0 w-64"
          : "-translate-x-full lg:translate-x-0 " + (sidebarCollapsed ? "w-16" : "w-60")
          }`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center px-3.5 border-b border-slate-100 justify-between shrink-0 bg-white">
          <div className={`flex items-center gap-2.5 overflow-hidden ${sidebarCollapsed ? "justify-center w-full" : ""}`}>
            <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shadow-xs">
              <Image src={logoImg} alt="Skyline Logo" width={32} height={32} className="object-contain" priority />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex flex-col justify-center space-y-0.5">
                <span className="text-[11px] font-black text-[#880b13] tracking-tight truncate leading-tight" title="Skyline Project & Engineers">
                  Skyline Project &amp; Engineers
                </span>
                <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest leading-none">
                  OPERATOR
                </span>
              </div>
            )}
          </div>

          {/* Mobile drawer close button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden"
            title="Close Sidebar Menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Sidebar Nav Links */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {/* Tab 1: Dashboard */}
          <button
            type="button"
            onClick={() => {
              handleActionChange("hub");
              setMobileMenuOpen(false);
            }}
            title={sidebarCollapsed ? "Dashboard" : undefined}
            className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${sidebarCollapsed ? "justify-center px-0 py-2.5" : "justify-start px-3 py-2.5 gap-3"
              } ${activeAction === "hub"
                ? "bg-[#880b13] text-white shadow-xs font-black border border-rose-900"
                : "bg-transparent hover:bg-rose-50 text-slate-700 hover:text-[#880b13]"
              }`}
          >
            <div className={`flex items-center justify-center ${sidebarCollapsed ? "w-full" : "gap-2.5 min-w-0"}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${activeAction === "hub" ? "bg-white/20 text-white" : "bg-rose-100 text-[#880b13]"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
                </svg>
              </span>
              {!sidebarCollapsed && <span className="truncate text-left font-bold text-xs">Dashboard</span>}
            </div>
          </button>

          {/* Tab 2: Breakdown Ticket */}
          <button
            type="button"
            onClick={() => {
              handleActionChange("maintenance");
              setMobileMenuOpen(false);
            }}
            title={sidebarCollapsed ? "Breakdown Ticket" : undefined}
            className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${sidebarCollapsed ? "justify-center px-0 py-2.5" : "justify-start px-3 py-2.5 gap-3"
              } ${activeAction === "maintenance"
                ? "bg-[#880b13] text-white shadow-xs font-black border border-rose-900"
                : "bg-transparent hover:bg-rose-50 text-slate-700 hover:text-[#880b13]"
              }`}
          >
            <div className={`flex items-center justify-center ${sidebarCollapsed ? "w-full" : "gap-2.5 min-w-0"}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${activeAction === "maintenance" ? "bg-white/20 text-white" : "bg-[#880b13]/10 text-[#880b13]"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.398-3.03 1.164l-6.84 6.84a2.25 2.25 0 0 1-3.182-3.182l6.84-6.84c.766-.766 1.255-1.954 1.164-3.03A4.5 4.5 0 0 1 16.5 2.25a.75.75 0 0 1 .65.375l2.25 3.75a.75.75 0 0 1-.15.825l-.75.75a.75.75 0 0 0 0 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l.75-.75a.75.75 0 0 1 .825-.15l3.75 2.25a.75.75 0 0 1 .375.65Z" />
                </svg>
              </span>
              {!sidebarCollapsed && <span className="truncate text-left font-bold text-xs">Breakdown Ticket</span>}
            </div>
          </button>

          {/* Tab 3: Safety Observation */}
          <button
            type="button"
            onClick={() => {
              handleActionChange("safety");
              setMobileMenuOpen(false);
            }}
            title={sidebarCollapsed ? "Safety Observation" : undefined}
            className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${sidebarCollapsed ? "justify-center px-0 py-2.5" : "justify-start px-3 py-2.5 gap-3"
              } ${activeAction === "safety"
                ? "bg-[#880b13] text-white shadow-xs font-black border border-rose-900"
                : "bg-transparent hover:bg-rose-50 text-slate-700 hover:text-[#880b13]"
              }`}
          >
            <div className={`flex items-center justify-center ${sidebarCollapsed ? "w-full" : "gap-2.5 min-w-0"}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${activeAction === "safety" ? "bg-white/20 text-white" : "bg-[#880b13]/10 text-[#880b13]"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </span>
              {!sidebarCollapsed && <span className="truncate text-left font-bold text-xs">Safety Observation</span>}
            </div>
          </button>



        </div>

        {/* Sidebar Footer: Logged in User Profile & Logout Button */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 shrink-0">
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? "justify-center flex-col" : "justify-between"}`}>
            <div className={`flex items-center min-w-0 ${sidebarCollapsed ? "justify-center w-full" : "gap-2"}`}>
              <div className="w-8 h-8 rounded-xl bg-[#880b13] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs" title={user?.name || "Operator"}>
                {(user?.name || "O").charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-900 truncate">{user?.name || "Operator"}</div>
                  <div className="text-[10px] font-semibold text-slate-400 truncate max-w-[110px]" title={user?.email || "operator@skyline.com"}>
                    {user?.email || "operator@skyline.com"}
                  </div>
                </div>
              )}
            </div>

            <a
              href="/api/auth/logout"
              className={`rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-[#880b13] border border-slate-200 transition-all shadow-xs flex items-center justify-center shrink-0 text-xs font-bold cursor-pointer group ${sidebarCollapsed ? "w-8 h-8 p-0" : "px-2 py-1.5 gap-1.5"
                }`}
              title="Logout / Exit Session"
              aria-label="Logout"
            >
              <svg className="w-4 h-4 text-slate-500 group-hover:text-[#880b13] transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              {!sidebarCollapsed && <span>Logout</span>}
            </a>
          </div>
        </div>
      </aside>

      {/* ==================================================
          RIGHT MAIN CONTENT AREA WITH EXACT MARGINS
      ================================================== */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"
          }`}
      >
        {/* Top Header Bar with Hamburger and Breadcrumb */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="p-1.5 rounded-xl text-slate-500 hover:text-[#880b13] hover:bg-slate-100 transition-colors border border-slate-200 shadow-xs shrink-0 cursor-pointer"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              aria-label="Toggle Navigation Sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
                <span className="text-xs font-bold text-slate-400 hidden sm:inline">Skyline Operator</span>
                <span className="text-xs font-bold text-slate-300 hidden sm:inline">/</span>
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate leading-tight">
                  {activeLabel}
                </h1>
              </div>
            </div>
          </div>

          {/* Right: Header Action Buttons */}
          {activeAction === "hub" && (
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 px-3.5 py-1.5 text-xs font-extrabold shadow-2xs transition-all cursor-pointer shrink-0"
              title="Scan Machine QR Code"
            >
              <span>📷</span>
              <span>Scan Machine QR</span>
            </button>
          )}

          {activeAction === "maintenance" && (
            <button
              type="button"
              onClick={() => setShowMaintenanceForm((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold shadow-md transition-all cursor-pointer shrink-0 ${showMaintenanceForm
                ? "bg-slate-800 hover:bg-slate-900 text-white"
                : "bg-gradient-to-r from-[#880b13] to-[#b71520] hover:from-[#70090f] hover:to-[#991019] text-white"
                }`}
            >
              {showMaintenanceForm ? (
                <>
                  <span>✕</span>
                  <span>Close Form</span>
                </>
              ) : (
                <>
                  <span>➕</span>
                  <span>Raise Breakdown Ticket</span>
                </>
              )}
            </button>
          )}

          {activeAction === "safety" && (
            <button
              type="button"
              onClick={() => setShowSafetyForm((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold shadow-md transition-all cursor-pointer shrink-0 ${showSafetyForm
                ? "bg-slate-800 hover:bg-slate-900 text-white"
                : "bg-gradient-to-r from-rose-700 to-red-800 hover:from-rose-800 hover:to-red-900 text-white"
                }`}
            >
              {showSafetyForm ? (
                <>
                  <span>✕</span>
                  <span>Close Form</span>
                </>
              ) : (
                <>
                  <span>➕</span>
                  <span>Report Safety Observation</span>
                </>
              )}
            </button>
          )}
        </header>

        {/* Dashboard Content Pages */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* PAGE VIEW 1: DASHBOARD */}
          {activeAction === "hub" && (
            <div className="space-y-6">
              {/* Welcome Banner */}
              <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-[#880b13] to-slate-900 text-white p-6 shadow-sm flex flex-col justify-between border border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-[10px] font-black uppercase text-rose-200 border border-white/10">
                      SHIFT 1 OPERATOR HUB
                    </span>
                    <span className="text-xs text-slate-300 font-bold">• Plant Operations</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
                    Welcome, {user?.name || "Operator"} 🚜
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-200 max-w-2xl mt-1">
                    Inspect your assigned workstation, complete shift checklists, report breakdown tickets, and log safety observations.
                  </p>

                  {/* Multi-machine switcher for operators with > 1 machines assigned */}
                  {assignedMachines.length > 1 && (
                    <div className="mt-3.5 flex items-center gap-2.5 flex-wrap bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/20">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>⚙️</span> Active Workstation:
                      </span>
                      <select
                        value={currentMachine?.["Asset ID"] || ""}
                        onChange={(e) => {
                          const m = assignedMachines.find((x) => x["Asset ID"] === e.target.value);
                          if (m) setCurrentMachine(m);
                        }}
                        className="rounded-lg bg-slate-900 text-white text-xs font-bold px-3 py-1.5 shadow-xs border border-white/20 outline-hidden cursor-pointer"
                      >
                        {assignedMachines.map((m) => (
                          <option key={m["Asset ID"]} value={m["Asset ID"]}>
                            {m["Asset ID"]} — {m["Machine Name"]} ({m.Department || "Plant"})
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-rose-200 font-medium">
                        ({assignedMachines.length} machines assigned to you)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Empty state alert when operator has 0 machines assigned */}
              {!currentMachine && assignedMachines.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/90 p-5 text-slate-800 space-y-2 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h3 className="font-extrabold text-amber-900 text-sm">No Machines Assigned</h3>
                      <p className="text-xs text-amber-800 font-medium">
                        Your user account ({user?.userId || user?.name}) currently has no machines assigned.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    To perform machine inspections, daily checklists, or raise breakdown work orders, please contact your supervisor or plant administrator to assign machines to your profile in <strong>User Management / Machine Master</strong>.
                  </p>
                </div>
              )}

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="relative overflow-hidden rounded-2xl bg-white p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">ASSIGNED MACHINE</span>
                  <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-base sm:text-lg font-black text-slate-900 truncate">
                      {currentMachine?.["Asset ID"] || "NO MACHINE"}
                    </span>
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${
                      currentMachine ? "text-emerald-800 bg-emerald-100 border-emerald-300" : "text-slate-600 bg-slate-100 border-slate-300"
                    }`}>
                      {currentMachine?.Department || "Unassigned"}
                    </span>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white p-4 border border-amber-200 bg-amber-50/20 shadow-xs flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">OPEN BREAKDOWNS</span>
                  <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-2xl font-black text-amber-950">{stats.openBreakdowns}</span>
                    <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 shrink-0">
                      Work Orders ({stats.totalMaintenance} Total)
                    </span>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white p-4 border border-rose-200 bg-rose-50/20 shadow-xs flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-rose-600" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700">SAFETY HAZARDS</span>
                  <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-2xl font-black text-rose-950">{stats.safetyHazards}</span>
                    <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300 shrink-0">
                      Inspections ({stats.totalSafety} Total)
                    </span>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white p-4 border border-indigo-200 bg-indigo-50/20 shadow-xs flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">CHECKLISTS TODAY</span>
                  <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-2xl font-black text-indigo-950">{stats.checklistsToday}</span>
                    <span className="text-[10px] font-extrabold text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-300 shrink-0">
                      Shift 1 Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Hub Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-[#880b13] to-[#b71520] text-white p-5 shadow-xs flex flex-col justify-between border border-rose-900">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                      MY WORKSTATION
                    </span>
                    <h3 className="text-base font-black mt-2">
                      {currentMachine?.["Machine Name"] || "No Machine Assigned"}
                    </h3>
                    <p className="text-xs text-rose-100 mt-1">
                      {currentMachine?.["Asset ID"]
                        ? `Asset ID: ${currentMachine["Asset ID"]}`
                        : "Contact your supervisor to assign a machine to your account."}
                    </p>
                  </div>
                  {currentMachine?.["Asset ID"] ? (
                    <Link
                      href={`/operator/machine/${encodeURIComponent(currentMachine["Asset ID"])}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-white/20 hover:bg-white hover:text-[#880b13] px-3.5 py-2 rounded-xl transition w-fit"
                    >
                      <span>Open Station</span>
                      <span>→</span>
                    </Link>
                  ) : (
                    <span className="mt-4 inline-block text-[11px] font-semibold text-rose-200">
                      Unassigned
                    </span>
                  )}
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-950 text-white p-5 shadow-xs flex flex-col justify-between border border-indigo-800">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                      CHECKLISTS
                    </span>
                    <h3 className="text-base font-black mt-2">Digital Shift Checklists</h3>
                    <p className="text-xs text-indigo-200 mt-1">
                      Inspect daily shift check points and record machine parameters.
                    </p>
                  </div>
                  <Link
                    href={currentMachine?.["Asset ID"] ? `/operator/checklist/${encodeURIComponent(currentMachine["Asset ID"])}` : "/operator/checklist"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-white/20 hover:bg-white hover:text-indigo-950 px-3.5 py-2 rounded-xl transition w-fit"
                  >
                    <span>Fill Checklist</span>
                    <span>→</span>
                  </Link>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white p-5 shadow-xs flex flex-col justify-between border border-slate-800">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                      QUICK SCAN
                    </span>
                    <h3 className="text-base font-black mt-2">Machine QR Scanner</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Scan any machine QR code label with your device camera.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-900 bg-white hover:bg-slate-100 px-3.5 py-2 rounded-xl transition w-fit cursor-pointer"
                  >
                    <span>📷 Scan QR Code</span>
                  </button>
                </div>
              </div>

              {/* Analytics & Workstation Performance Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Workstation Health & Reliability Gauge */}
                <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">RELIABILITY INDEX</span>
                      <h4 className="text-base font-black text-slate-900 mt-0.5">Workstation Health</h4>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 border border-emerald-200">
                      98.4% Optimal
                    </span>
                  </div>

                  <div className="flex items-center justify-around py-2">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-100"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-[#880b13] stroke-current"
                          strokeWidth="3.5"
                          strokeDasharray="98, 100"
                          strokeLinecap="round"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-2xl font-black text-slate-900 block leading-none">98%</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Up-time</span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">MTBF (Mean Time)</span>
                        <span className="font-extrabold text-slate-900 text-sm">124.5 Hours</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">MTTR (Repair Time)</span>
                        <span className="font-extrabold text-emerald-700 text-sm">0.8 Hours</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Shift Status: <strong className="text-slate-800">Operational</strong></span>
                    <span>Safety Record: <strong className="text-emerald-700">Zero Hazards</strong></span>
                  </div>
                </div>

                {/* 2. Breakdown Priority Breakdown Chart */}
                <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">MAINTENANCE METRICS</span>
                      <span className="text-xs font-bold text-slate-500">{stats.totalMaintenance} Tickets Logged</span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 mt-0.5">Ticket Priority Distribution</h4>
                  </div>

                  <div className="space-y-3 py-1">
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-600"></span>Critical</span>
                        <span>{stats.priorityCounts?.Critical || 0}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-red-600 h-2 rounded-full transition-all duration-500" style={{ width: `${stats.totalMaintenance > 0 ? ((stats.priorityCounts?.Critical || 0) / stats.totalMaintenance) * 100 : 0}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span>High</span>
                        <span>{stats.priorityCounts?.High || 0}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${stats.totalMaintenance > 0 ? ((stats.priorityCounts?.High || 0) / stats.totalMaintenance) * 100 : 0}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Medium / Normal</span>
                        <span>{stats.priorityCounts?.Medium || 0}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${stats.totalMaintenance > 0 ? ((stats.priorityCounts?.Medium || 0) / stats.totalMaintenance) * 100 : 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span>Low</span>
                        <span>{stats.priorityCounts?.Low || 0}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-slate-400 h-2 rounded-full transition-all duration-500" style={{ width: `${stats.totalMaintenance > 0 ? ((stats.priorityCounts?.Low || 0) / stats.totalMaintenance) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleActionChange("maintenance")}
                      className="text-[#880b13] font-bold hover:underline"
                    >
                      View All Tickets →
                    </button>
                    <span className="text-slate-400 text-[11px]">Synced Live</span>
                  </div>
                </div>

                {/* 3. Recent Workstation Activity Timeline */}
                <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">LIVE AUDIT LOG</span>
                      <span className="text-xs font-bold text-emerald-700">● Active Stream</span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 mt-0.5">Recent Workstation Activity</h4>
                  </div>

                  {stats.recentActivity.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No maintenance or safety records logged yet for this workstation.
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {stats.recentActivity.map((act, idx) => (
                        <li key={act.id + idx} className="flex items-start justify-between gap-2 p-2 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${act.type === "Breakdown Ticket" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                                {act.type === "Breakdown Ticket" ? "🛠️ Ticket" : "⚠️ Safety"}
                              </span>
                              <span className="text-xs font-bold text-slate-900 truncate">{act.title}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">{act.id} · {act.date}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${(act.status || "").toLowerCase() === "completed" || (act.status || "").toLowerCase() === "resolved" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                            {act.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="pt-3 border-t border-slate-100 text-right">
                    <button
                      type="button"
                      onClick={() => handleActionChange("safety")}
                      className="text-xs font-bold text-rose-700 hover:underline"
                    >
                      Log New Safety Concern →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAGE VIEW 2: BREAKDOWN TICKET */}
          {activeAction === "maintenance" && (
            <MaintenanceForm
              machine={currentMachine || ({} as Machine)}
              user={user}
              showForm={showMaintenanceForm}
              onToggleForm={setShowMaintenanceForm}
              onSaved={() => {
                loadDashboardStats();
              }}
            />
          )}

          {/* PAGE VIEW 3: SAFETY OBSERVATION */}
          {activeAction === "safety" && (
            <SafetyForm
              machine={currentMachine || ({} as Machine)}
              user={user}
              showForm={showSafetyForm}
              onToggleForm={setShowSafetyForm}
            />
          )}

          {/* PAGE VIEW 4: SHIFT CHECKLIST */}
          {activeAction === "shift-checklist" && (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-800 uppercase tracking-wider">
                    Shift 1 Workstation Audit
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 flex items-center gap-2">
                    <span>📋</span> Digital Shift Checklist
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Daily machine inspection checkpoints and shift parameter logs.
                  </p>
                </div>
                <Link
                  href={currentMachine?.["Asset ID"] ? `/checklist/${encodeURIComponent(currentMachine["Asset ID"])}` : "/checklist"}
                  className="px-4 py-2 bg-[#880b13] hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <span>✏️ Open Full Interactive Checklist</span>
                  <span>→</span>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">1. Hydraulic &amp; Pneumatic Pressure</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">NORMAL (45 BAR)</span>
                  </div>
                  <p className="text-xs text-slate-500">Check oil pressure gauge, hose lines, and pneumatic pressure valves before operation.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">2. Emergency Stop &amp; Interlocks</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">PASS / OK</span>
                  </div>
                  <p className="text-xs text-slate-500">Verify emergency push button function and safety light curtain sensors.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">3. Cooling &amp; Temperature Level</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">OPTIMAL (24°C)</span>
                  </div>
                  <p className="text-xs text-slate-500">Inspect chiller fluid level and verify heat exchanger temperature status.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">4. Guide Rail Lubrication</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">VERIFIED</span>
                  </div>
                  <p className="text-xs text-slate-500">Check auto-lube reservoir level and wipe down linear motion rails.</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showScanner && (
        <MachineQrScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          user={user}
        />
      )}
    </div>
  );
}
