"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import type { AlertItem, CategorizedAlertsResult } from "@/lib/notifications";
import type { SessionUser } from "@/lib/auth";

interface SupervisorAlertsModuleProps {
  initialAlerts?: AlertItem[];
  initialData?: CategorizedAlertsResult | null;
  user?: SessionUser;
  allMachines?: any[];
}

export default function SupervisorAlertsModule({
  initialAlerts = [],
  initialData = null,
  user,
  allMachines = [],
}: SupervisorAlertsModuleProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>(() => {
    if (initialData?.alerts && initialData.alerts.length > 0) return initialData.alerts;
    if (initialAlerts && initialAlerts.length > 0) return initialAlerts;
    return [];
  });

  const [activeCategory, setActiveCategory] = useState<"all" | "due" | "pending" | "upcoming">("all");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [machineFilter, setMachineFilter] = useState("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("Just now");

  const showToast = (text: string, type: "success" | "error") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Synchronize alerts with backend
  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/notifications?sync=true", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.allAlerts || data.alerts)) {
        setAlerts(data.allAlerts || data.alerts);
        setLastSyncedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        showToast("Notifications successfully synchronized with live database.", "success");
      } else {
        showToast("Synchronized, current alerts up to date.", "success");
      }
    } catch (err: any) {
      showToast("Sync warning: " + (err.message || "Failed to reach notification server"), "error");
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Close or Resolve an alert
  const handleCloseAlert = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!id) return;
    setActionBusyId(id);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", id }),
      });
      const data = await res.json();
      if (data.success) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
        showToast(`Alert #${id} marked as resolved & closed.`, "success");
      } else {
        showToast(data.message || "Could not close alert.", "error");
      }
    } catch (err: any) {
      showToast("Error closing alert: " + (err.message || "Request failed"), "error");
    } finally {
      setActionBusyId(null);
    }
  };

  // Categorize counts
  const categorized = useMemo(() => {
    const due = alerts.filter(
      (a) => a.categoryType === "due" || (a.daysLeft !== null && a.daysLeft <= 0)
    );
    const pending = alerts.filter(
      (a) => a.categoryType === "pending" || /breakdown|defect|pending|open|progress|not ok/i.test(a.status || a.type)
    );
    const upcoming = alerts.filter(
      (a) =>
        a.categoryType === "upcoming" ||
        (a.daysLeft !== null && a.daysLeft > 0 && a.categoryType !== "due")
    );
    const critical = alerts.filter(
      (a) => (a.priority || "").toLowerCase() === "critical"
    ).length;

    return {
      due,
      pending,
      upcoming,
      counts: {
        total: alerts.length,
        due: due.length,
        pending: pending.length,
        upcoming: upcoming.length,
        critical,
      },
    };
  }, [alerts]);

  // Unique machines for filter dropdown
  const uniqueMachines = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach((a) => {
      if (a.machine) set.add(a.machine);
    });
    return Array.from(set).sort();
  }, [alerts]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      // Category filter
      if (activeCategory === "due") {
        const isDue = item.categoryType === "due" || (item.daysLeft !== null && item.daysLeft <= 0);
        if (!isDue) return false;
      } else if (activeCategory === "pending") {
        const isPending =
          item.categoryType === "pending" ||
          /breakdown|defect|pending|open|progress|not ok/i.test(item.status || item.type);
        if (!isPending) return false;
      } else if (activeCategory === "upcoming") {
        const isUpcoming =
          item.categoryType === "upcoming" ||
          (item.daysLeft !== null && item.daysLeft > 0 && item.categoryType !== "due");
        if (!isUpcoming) return false;
      }

      // Severity filter
      if (severityFilter !== "all") {
        if ((item.priority || "").toLowerCase() !== severityFilter.toLowerCase()) {
          return false;
        }
      }

      // Machine filter
      if (machineFilter !== "all") {
        if ((item.machine || "").toLowerCase() !== machineFilter.toLowerCase()) {
          return false;
        }
      }

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const str = `${item.id} ${item.type} ${item.machine} ${item.assetId} ${item.message} ${item.assignedTo} ${item.status}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [alerts, activeCategory, severityFilter, machineFilter, search]);


  return (
    <div className="space-y-6 w-full font-sans antialiased text-slate-900">
      {/* Toast Banner */}
      {toastMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between shadow-sm transition-all animate-in fade-in ${
            toastMsg.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{toastMsg.type === "success" ? "✅" : "⚠️"}</span>
            <span>{toastMsg.text}</span>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. TOP HERO HEADER & SYNC CONTROLS */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-[#880b13] text-white p-5 sm:p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-[10px] font-black uppercase text-rose-200 tracking-wider">
              Plant Telemetry &amp; Alerts
            </span>
            <span className="text-xs text-slate-300 font-semibold">
              Last synced: {lastSyncedTime}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Notifications &amp; Alerts Hub</span>
            <span className="text-lg">🔔</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl leading-relaxed">
            Real-time shop floor notifications for overdue inspections, active machine defects, breakdown tickets, and upcoming scheduled maintenance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            title="Scan database and refresh all alerts"
          >
            <span className={isSyncing ? "animate-spin" : ""}>🔄</span>
            <span>{isSyncing ? "Scanning Database..." : "Sync Alerts Now"}</span>
          </button>
        </div>
      </div>

      {/* 2. THREE CORE CATEGORY STATS CARDS (DUE, PENDING, UPCOMING) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* DUE & OVERDUE */}
        <div
          onClick={() => setActiveCategory("due")}
          className={`relative overflow-hidden rounded-2xl bg-white p-4 border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
            activeCategory === "due"
              ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/10"
              : "border-slate-200/90 hover:border-rose-300"
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-600" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              <span>Due &amp; Overdue</span>
            </span>
            <span className="text-lg">🔴</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-rose-950">
              {categorized.counts.due}
            </span>
            <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
              Immediate Action
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Overdue PM, expired AMCs, or target dates past due.
          </p>
        </div>

        {/* PENDING ACTIONS */}
        <div
          onClick={() => setActiveCategory("pending")}
          className={`relative overflow-hidden rounded-2xl bg-white p-4 border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
            activeCategory === "pending"
              ? "border-amber-500 ring-2 ring-amber-500/30 bg-amber-50/10"
              : "border-slate-200/90 hover:border-amber-300"
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Pending Action</span>
            </span>
            <span className="text-lg">🟡</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-950">
              {categorized.counts.pending}
            </span>
            <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
              Open Defects
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Unresolved checklist defects, breakdowns, &amp; open tickets.
          </p>
        </div>

        {/* UPCOMING SCHEDULES */}
        <div
          onClick={() => setActiveCategory("upcoming")}
          className={`relative overflow-hidden rounded-2xl bg-white p-4 border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
            activeCategory === "upcoming"
              ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/10"
              : "border-slate-200/90 hover:border-blue-300"
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>Upcoming</span>
            </span>
            <span className="text-lg">🔵</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-blue-950">
              {categorized.counts.upcoming}
            </span>
            <span className="text-[10px] font-extrabold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
              Next 14–60 Days
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Upcoming PM services, calibration, &amp; AMC renewals.
          </p>
        </div>

        {/* TOTAL ACTIVE NOTIFICATIONS */}
        <div
          onClick={() => setActiveCategory("all")}
          className={`relative overflow-hidden rounded-2xl bg-white p-4 border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
            activeCategory === "all"
              ? "border-slate-800 ring-2 ring-slate-800/30 bg-slate-50/30"
              : "border-slate-200/90 hover:border-slate-400"
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-700" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
              Total Active
            </span>
            <span className="text-lg">⚪</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">
              {categorized.counts.total}
            </span>
            <span className="text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
              {categorized.counts.critical > 0 ? `${categorized.counts.critical} Critical` : "Plant Stable"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Active industrial alerts registered across all 18 modules.
          </p>
        </div>
      </div>

      {/* 3. CATEGORY PILL TABS & FILTER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3.5">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategory === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>All Alerts</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">
                {categorized.counts.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("due")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategory === "due"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60"
              }`}
            >
              <span>🔴 Due &amp; Overdue</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeCategory === "due" ? "bg-white/20 text-white" : "bg-rose-200 text-rose-900 font-extrabold"}`}>
                {categorized.counts.due}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("pending")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategory === "pending"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
              }`}
            >
              <span>🟡 Pending Action</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeCategory === "pending" ? "bg-white/20 text-white" : "bg-amber-200 text-amber-900 font-extrabold"}`}>
                {categorized.counts.pending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("upcoming")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategory === "upcoming"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60"
              }`}
            >
              <span>🔵 Upcoming Schedules</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeCategory === "upcoming" ? "bg-white/20 text-white" : "bg-blue-200 text-blue-900 font-extrabold"}`}>
                {categorized.counts.upcoming}
              </span>
            </button>
          </div>

        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search alert, machine, technician, defect..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#880b13] focus:bg-white focus:outline-hidden transition-all shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Severity Dropdown */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-700 focus:border-[#880b13] focus:bg-white focus:outline-hidden transition-all shadow-2xs cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">🚨 Critical Severity Only</option>
              <option value="high">🔴 High Priority</option>
              <option value="medium">🟡 Medium Priority</option>
              <option value="low">🟢 Low Priority</option>
            </select>
          </div>

          {/* Machine Filter Dropdown */}
          <div>
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-700 focus:border-[#880b13] focus:bg-white focus:outline-hidden transition-all shadow-2xs cursor-pointer"
            >
              <option value="all">All Machines &amp; Departments</option>
              {uniqueMachines.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. ALERTS CARDS LIST */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3 shadow-2xs">
            <span className="text-4xl block">✨</span>
            <h3 className="text-base font-black text-slate-900">
              No Alerts In This Category
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {activeCategory === "due"
                ? "Great news! There are zero overdue items or PM schedules due today. Everything is running within target parameters."
                : activeCategory === "pending"
                ? "No open defect tickets or pending machine breakdowns at this time."
                : activeCategory === "upcoming"
                ? "No preventive maintenance schedules or AMC renewals are due in the immediate upcoming window."
                : "No notifications found matching your search filter."}
            </p>
            {(search || severityFilter !== "all" || machineFilter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setSeverityFilter("all");
                  setMachineFilter("all");
                }}
                className="mt-2 text-xs font-bold text-[#880b13] underline cursor-pointer"
              >
                Clear all search filters
              </button>
            )}
          </div>
        ) : (
          filteredAlerts.map((item, idx) => {
            const isDue =
              item.categoryType === "due" || (item.daysLeft !== null && item.daysLeft <= 0);
            const isPending =
              item.categoryType === "pending" ||
              /breakdown|defect|pending|open|progress|not ok/i.test(item.status || item.type);
            const isCritical = (item.priority || "").toLowerCase() === "critical";

            // Visual card styling based on category
            const borderAccent = isDue
              ? "border-l-rose-600 bg-rose-50/15"
              : isPending
              ? "border-l-amber-500 bg-amber-50/15"
              : "border-l-blue-500 bg-blue-50/15";

            return (
              <div
                key={item.id || idx}
                className={`rounded-2xl border border-slate-200/90 border-l-4 bg-white p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all space-y-3 ${borderAccent}`}
              >
                {/* Header row: category, type, and status */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category Tag */}
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                        isDue
                          ? "bg-rose-100 text-rose-900 border-rose-300"
                          : isPending
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : "bg-blue-100 text-blue-900 border-blue-300"
                      }`}
                    >
                      {isDue ? "🔴 DUE & OVERDUE" : isPending ? "🟡 PENDING ACTION" : "🔵 UPCOMING"}
                    </span>

                    {/* Alert Type */}
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                      {item.type || "Industrial Notice"}
                    </span>

                    {/* Priority Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        isCritical
                          ? "bg-red-600 text-white animate-pulse"
                          : (item.priority || "").toLowerCase() === "high"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.priority || "Medium"} Priority
                    </span>
                  </div>

                  {/* Due Status Tag */}
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                      item.daysLeft !== null && item.daysLeft < 0
                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                        : item.daysLeft === 0
                        ? "bg-rose-600 text-white"
                        : item.daysLeft !== null && item.daysLeft > 0
                        ? "bg-blue-50 text-blue-800 border border-blue-200"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {item.daysLeft !== null && item.daysLeft < 0
                      ? `⚠️ OVERDUE by ${-item.daysLeft} day${item.daysLeft === -1 ? "" : "s"}`
                      : item.daysLeft === 0
                      ? "⚠️ DUE TODAY"
                      : item.daysLeft !== null && item.daysLeft > 0
                      ? `Due in ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"}`
                      : item.status || "Pending Review"}
                  </span>
                </div>

                {/* Body: Title and Message */}
                <div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                    {item.message}
                  </h4>
                </div>

                {/* Footer metadata & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Machine info */}
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <span>🏭</span>
                      <span>{item.machine || "Plant Floor"}</span>
                      {item.assetId && (
                        <span className="text-[10px] text-slate-500 font-semibold">
                          ({item.assetId})
                        </span>
                      )}
                    </div>

                    {/* Due Date if present */}
                    {item.dueDate && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <span>📅 Due:</span>
                        <span className="font-bold text-slate-800">{item.dueDate}</span>
                      </div>
                    )}

                    {/* Assigned Technician */}
                    {item.assignedTo && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <span>👤</span>
                        <span>{item.assignedTo}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {item.assetId && (
                      <Link
                        href={`/machine/${encodeURIComponent(item.assetId)}`}
                        className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-all"
                        title="View Machine Portal &amp; History"
                      >
                        Inspect Machine →
                      </Link>
                    )}

                    <button
                      type="button"
                      disabled={actionBusyId === item.id}
                      onClick={(e) => handleCloseAlert(item.id, e)}
                      className="rounded-xl bg-[#880b13] hover:bg-[#72070e] text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1"
                      title="Mark this alert as resolved and closed"
                    >
                      {actionBusyId === item.id ? (
                        <span>Resolving...</span>
                      ) : (
                        <>
                          <span>✓</span>
                          <span>Mark Resolved</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
