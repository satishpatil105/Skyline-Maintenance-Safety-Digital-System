"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { Row } from "./UserMasterTable";

interface ChecklistRecordsTableProps {
  rows?: Row[];
  onEdit?: (row: Row) => void;
  onDelete?: (row: Row) => void;
  renderStatusCell?: (colKey: string, val: string) => React.ReactNode;
}

interface ParsedRecord {
  rawRow: Row;
  recordId: string;
  date: string;
  machineWithAsset: string;
  machineName: string;
  assetId: string;
  checkPoint: string;
  category: string;
  standardRequirement: string;
  frequency: string;
  statusRaw: string;
  response: string;
  isOk: boolean;
  isNotOk: boolean;
  isPending: boolean;
  isOverdue: boolean;
  isCompleted: boolean;
  isUnverified: boolean;
  isSunday: boolean;
  remarks: string;
  actionIfNotOk: string;
  operator: string;
  maintenanceTicket: string | null;
  photoEvidence: string;
}

export default function ChecklistRecordsTable({
  rows = [],
  onDelete,
  renderStatusCell,
}: ChecklistRecordsTableProps) {
  // 1. Live API Data State (if rows not passed or empty)
  const [apiRecords, setApiRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiStats, setApiStats] = useState<any | null>(null);

  // 2. Filter States (Default historical window up to 2026-10-23)
  const [startDate, setStartDate] = useState("2026-09-18");
  const [endDate, setEndDate] = useState("2026-10-23");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedOperator, setSelectedOperator] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "completed" | "ok" | "not_ok" | "pending" | "overdue" | "unverified"
  >("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");

  // 3. Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<"date" | "recordId" | "machine" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 4. Modal States
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<ParsedRecord | null>(null);

  // Fetch from API if rows is empty or not passed
  const fetchRecordsFromApi = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/checklist/records?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setApiRecords(data.records || []);
        setApiStats(data.stats || null);
      }
    } catch (err) {
      console.warn("Failed to fetch checklist records from API:", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (!rows || rows.length === 0) {
      fetchRecordsFromApi();
    }
  }, [rows, fetchRecordsFromApi]);

  // Determine active source records
  const sourceRows: any[] = useMemo(() => {
    if (rows && rows.length > 0) return rows;
    return apiRecords;
  }, [rows, apiRecords]);

  // Parse records into structured representation
  const parsedRecords: ParsedRecord[] = useMemo(() => {
    return sourceRows.map((r, index) => {
      const getVal = (keys: string[], idx: number, fallback = "") => {
        for (const k of keys) {
          if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") {
            return String(r[k]).trim();
          }
        }
        if (Array.isArray(r.cells) && r.cells[idx] !== undefined) {
          const v = String(r.cells[idx] ?? "").trim();
          if (v) return v;
        }
        return fallback;
      };

      const recordId = getVal(["Record ID", "recordId", "Log ID", "logId"], 0, `REC-${index + 1}`);
      const date = getVal(["Date", "date", "Created Date"], 1, "2026-10-21");
      const machineWithAsset = getVal(
        ["Machine / Asset", "Machine Name", "machineName", "Asset ID", "assetId"],
        2,
        "General Machinery"
      );
      const machineName = getVal(["Machine Name", "machineName"], 2, machineWithAsset.split(" (")[0] || machineWithAsset);
      const assetId = getVal(["Asset ID", "assetId"], 2, "");
      const checkPoint = getVal(["Check Point", "checkPoint", "Task", "Check Point / Task"], 3, "Routine Check Point");
      const category = getVal(["Category", "category"], 3, "General Maintenance");
      const standardRequirement = getVal(["Standard Requirement", "standardRequirement", "Standard Parameter"], 3, "Visual / Normal");
      const frequency = getVal(["Frequency", "frequency"], 4, "Daily");
      const statusRaw = getVal(["Response / Status", "Status", "status", "Response", "response", "result"], 5, "Pending");
      const response = getVal(["Response", "response"], 5, "");
      const remarks = getVal(["Remarks", "remarks", "Problem / Breakdown", "problem"], 6, "");
      const actionIfNotOk = getVal(["Action if Not OK", "actionIfNotOk", "If Not OK Action"], 7, "");
      const operator = getVal(["Operator", "operator", "Operator / Inspector", "userName", "Submitted By", "submittedBy"], 8, "Unassigned");
      const maintenanceTicket = getVal(["Maintenance Ticket", "maintenanceTicketId", "Breakdown Ticket"], 9, "-");
      const photoEvidence = getVal(["Photo Evidence", "photoEvidence", "photo"], 10, "");

      const isHistoricalScheduled = Boolean(r.isHistoricalScheduled || (r.rawDoc && r.rawDoc.isHistoricalScheduled));
      const requiresVerification = Boolean(
        r.requiresVerification || (r.rawDoc && r.rawDoc.requiresVerification) || isHistoricalScheduled
      );
      const isSunday = Boolean(r.isSunday || (r.rawDoc && r.rawDoc.isSunday));

      const sNorm = statusRaw.toLowerCase().trim();
      const isNotOk = sNorm === "not ok" || sNorm === "failed" || sNorm === "defect";
      const isOk = sNorm === "ok" || sNorm === "passed";
      const isPending = sNorm === "pending";
      const isOverdue = sNorm === "overdue";
      const isCompleted = isOk || isNotOk;
      const isUnverified = requiresVerification || isHistoricalScheduled || isOverdue || isPending;

      return {
        rawRow: r,
        recordId,
        date,
        machineWithAsset,
        machineName,
        assetId,
        checkPoint,
        category,
        standardRequirement,
        frequency,
        statusRaw,
        response,
        isOk,
        isNotOk,
        isPending,
        isOverdue,
        isCompleted,
        isUnverified,
        isSunday,
        remarks,
        actionIfNotOk,
        operator,
        maintenanceTicket: maintenanceTicket !== "-" && maintenanceTicket ? maintenanceTicket : null,
        photoEvidence,
      };
    });
  }, [sourceRows]);

  // Distinct lists for filter dropdowns
  const uniqueMachines = useMemo(() => {
    const set = new Set<string>();
    parsedRecords.forEach((r) => {
      if (r.machineWithAsset) set.add(r.machineWithAsset);
    });
    return Array.from(set).sort();
  }, [parsedRecords]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    parsedRecords.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [parsedRecords]);

  const uniqueOperators = useMemo(() => {
    const set = new Set<string>();
    parsedRecords.forEach((r) => {
      if (r.operator && r.operator !== "Unassigned") set.add(r.operator);
    });
    return Array.from(set).sort();
  }, [parsedRecords]);

  // Known Sundays within 18 Sep 2026 to 21 Oct 2026
  const SUNDAYS_SET = useMemo(
    () => new Set(["2026-09-20", "2026-09-27", "2026-10-04", "2026-10-11", "2026-10-18"]),
    []
  );

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    const list = parsedRecords.filter((r) => {
      // 1. Date Range
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;

      // 2. Machine filter
      if (selectedMachine !== "all" && r.machineWithAsset !== selectedMachine) {
        return false;
      }

      // 3. Category / Type filter
      if (selectedCategory !== "all" && r.category !== selectedCategory) {
        return false;
      }

      // 4. Operator filter
      if (selectedOperator !== "all" && r.operator !== selectedOperator) {
        return false;
      }

      // 5. Frequency filter
      if (frequencyFilter !== "all" && r.frequency.toLowerCase() !== frequencyFilter.toLowerCase()) {
        return false;
      }

      // 6. Status filter
      if (statusFilter === "completed" && !r.isCompleted) return false;
      if (statusFilter === "ok" && !r.isOk) return false;
      if (statusFilter === "not_ok" && !r.isNotOk) return false;
      if (statusFilter === "pending" && !r.isPending) return false;
      if (statusFilter === "overdue" && !r.isOverdue) return false;
      if (statusFilter === "unverified" && !r.isUnverified) return false;

      // 7. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          r.recordId.toLowerCase().includes(q) ||
          r.machineWithAsset.toLowerCase().includes(q) ||
          r.checkPoint.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.remarks.toLowerCase().includes(q) ||
          r.operator.toLowerCase().includes(q) ||
          (r.maintenanceTicket && r.maintenanceTicket.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });

    // Sort list
    return list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        cmp = a.date.localeCompare(b.date);
        if (cmp === 0) cmp = a.recordId.localeCompare(b.recordId);
      } else if (sortField === "recordId") {
        cmp = a.recordId.localeCompare(b.recordId);
      } else if (sortField === "machine") {
        cmp = a.machineWithAsset.localeCompare(b.machineWithAsset);
      } else if (sortField === "status") {
        cmp = a.statusRaw.localeCompare(b.statusRaw);
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });
  }, [
    parsedRecords,
    startDate,
    endDate,
    selectedMachine,
    selectedCategory,
    selectedOperator,
    frequencyFilter,
    statusFilter,
    searchTerm,
    sortField,
    sortOrder,
  ]);

  // KPI Metrics (Calculated respecting the Sunday weekly off rule)
  const stats = useMemo(() => {
    // If backend stats available and no local sub-filtering active, use backend stats
    if (apiStats && !selectedMachine.length) {
      // return apiStats
    }

    // Exclude routine daily records on Sunday if any
    const validRecords = parsedRecords.filter((r) => {
      if (r.isSunday) return false;
      if (SUNDAYS_SET.has(r.date) && r.frequency.toLowerCase() === "daily") return false;
      return true;
    });

    const totalScheduled = validRecords.length;
    const okCount = validRecords.filter((r) => r.isOk).length;
    const notOkCount = validRecords.filter((r) => r.isNotOk).length;
    const completedCount = okCount + notOkCount;
    const pendingCount = validRecords.filter((r) => r.isPending).length;
    const overdueCount = validRecords.filter((r) => r.isOverdue).length;
    const unverifiedCount = validRecords.filter((r) => r.isUnverified).length;
    const completionPercentage = totalScheduled > 0 ? Number(((completedCount / totalScheduled) * 100).toFixed(1)) : 0;
    const machinesCount = uniqueMachines.length;

    return {
      totalScheduled,
      completedCount,
      okCount,
      notOkCount,
      pendingCount,
      overdueCount,
      unverifiedCount,
      completionPercentage,
      machinesCount,
      sundaysExcluded: SUNDAYS_SET.size,
    };
  }, [parsedRecords, uniqueMachines, apiStats, SUNDAYS_SET]);

  // Paginated records
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  const handleSort = (field: "date" | "recordId" | "machine" | "status") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setPage(1);
  };


  return (
    <div className="space-y-5">
      {/* 1. Header Banner & Official Sunday Weekly Off Notification */}
      <div className="bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl p-4 shadow-2xs backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
            📅
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-black text-slate-900 tracking-tight">
                34-Day Historical Inspection Schedule (18 Sep 2026 – 21 Oct 2026)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300 uppercase tracking-wide">
                MongoDB Atlas Synced
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                Sunday Weekly Off Active
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              Every Sunday is official weekly off. All 5 Sundays (20 Sep, 27 Sep, 4 Oct, 11 Oct, 18 Oct 2026) are strictly excluded from routine daily scheduling, overdue flags, and completion percentages.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
          <div className="text-right px-3 py-1.5 bg-white/90 border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Inspection Period</span>
            <span className="text-xs font-black text-slate-900">34 Days (29 Working + 5 Sun Off)</span>
          </div>

        </div>
      </div>

      {/* 2. Key Performance Indicators (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Total Scheduled Inspections */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Scheduled</span>
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">{stats.totalScheduled}</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500">
            Across {stats.machinesCount} active assets
          </div>
        </div>

        {/* KPI 2: Completed Inspections */}
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/90 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-emerald-50/30 to-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Completed</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-700">{stats.completedCount}</span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-md">
              {stats.okCount} OK / {stats.notOkCount} Not OK
            </span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-emerald-700">
            Verified actual records
          </div>
        </div>

        {/* KPI 3: Pending Inspections (Today) */}
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200/90 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-amber-50/30 to-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending (Today)</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-700">{stats.pendingCount}</span>
            <span className="text-[10px] font-semibold text-amber-800">21 Oct 2026</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-amber-700">
            Awaiting today's shift log
          </div>
        </div>

        {/* KPI 4: Overdue Inspections */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-300 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Overdue (Past)</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-800">{stats.overdueCount}</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500">
            Past scheduled, unexecuted
          </div>
        </div>

        {/* KPI 5: Completion Percentage */}
        <div className="bg-white p-3.5 rounded-2xl border border-indigo-200/90 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-indigo-50/30 to-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Completion %</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-black text-indigo-700">{stats.completionPercentage}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(stats.completionPercentage, 2)}%` }}
            ></div>
          </div>
          <div className="mt-1 text-[10px] font-medium text-indigo-700">
            Sundays excluded
          </div>
        </div>

        {/* KPI 6: Flagged / Breakdown Tickets */}
        <div className="bg-white p-3.5 rounded-2xl border border-rose-200/90 shadow-2xs hover:shadow-xs transition-shadow bg-linear-to-br from-rose-50/30 to-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Not OK Tickets</span>
            <span className="w-2 h-2 rounded-full bg-[#880b13]"></span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-black text-[#880b13]">{stats.notOkCount}</span>
            <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded-md">In Maint.</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-rose-700">
            Breakdowns auto-logged
          </div>
        </div>
      </div>

      {/* 3. Comprehensive Filters: Date Range, Machine, Category, Operator, Status */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        {/* Row 1: Date Range Filter with Quick Preset Buttons */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Date Range:
            </span>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13]"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13]"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setStartDate("2026-09-18");
                  setEndDate("2026-10-21");
                  setPage(1);
                }}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                34-Day Period
              </button>

              <button
                type="button"
                onClick={() => {
                  setStartDate("2026-10-21");
                  setEndDate("2026-10-21");
                  setPage(1);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                Today (21 Oct)
              </button>

              <button
                type="button"
                onClick={() => {
                  setStartDate("2026-10-14");
                  setEndDate("2026-10-21");
                  setPage(1);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                Past 7 Days
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-slate-500">
              Total records: <span className="text-slate-900 font-black">{filteredRecords.length}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Search, Machine, Category, Operator, Frequency Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search checkpoint, asset, operator, ticket..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Machine Filter */}
          <div>
            <select
              value={selectedMachine}
              onChange={(e) => {
                setSelectedMachine(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13]"
            >
              <option value="all">All Machines &amp; Assets ({uniqueMachines.length})</option>
              {uniqueMachines.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Category / Type Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13]"
            >
              <option value="all">All Checklist Types ({uniqueCategories.length})</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Operator Filter */}
          <div>
            <select
              value={selectedOperator}
              onChange={(e) => {
                setSelectedOperator(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13]"
            >
              <option value="all">All Operators ({uniqueOperators.length})</option>
              {uniqueOperators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Status Filter Pills Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Status:</span>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Records
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("completed");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "completed"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Completed ({stats.completedCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("ok");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "ok"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              Passed OK ({stats.okCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("not_ok");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "not_ok"
                  ? "bg-[#880b13] text-white shadow-2xs"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Flagged Not OK ({stats.notOkCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("pending");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "pending"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Pending Today ({stats.pendingCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("overdue");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "overdue"
                  ? "bg-slate-700 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300"
              }`}
            >
              Overdue ({stats.overdueCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("unverified");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "unverified"
                  ? "bg-amber-700 text-white shadow-2xs"
                  : "bg-amber-50/60 text-amber-900 hover:bg-amber-100 border border-amber-300"
              }`}
            >
              Unverified Historical ({stats.unverifiedCount})
            </button>
          </div>

          {/* Frequency Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500">Frequency:</span>
            <select
              value={frequencyFilter}
              onChange={(e) => {
                setFrequencyFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. The Checklist Records Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider select-none">
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    Scheduled Date &amp; Shift
                    {sortField === "date" && (
                      <span className="text-[#880b13]">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("recordId")}
                >
                  <div className="flex items-center gap-1">
                    Record ID
                    {sortField === "recordId" && (
                      <span className="text-[#880b13]">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    )}
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("machine")}
                >
                  <div className="flex items-center gap-1">
                    Machine &amp; Asset ID
                    {sortField === "machine" && (
                      <span className="text-[#880b13]">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Check Point / Parameter</th>
                <th className="py-3 px-4">Frequency</th>
                <th
                  className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Status / Traceability
                    {sortField === "status" && (
                      <span className="text-[#880b13]">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Assigned Operator</th>
                <th className="py-3 px-4">Action / Maintenance</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-8 h-8 border-3 border-[#880b13] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold text-slate-600">Loading checklist records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="text-3xl">📋</span>
                      <span className="text-sm font-bold text-slate-600">No checklist records match the filter</span>
                      <span className="text-xs text-slate-400">Try adjusting your date range or filter selections</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, i) => (
                  <tr
                    key={r.recordId || i}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => setSelectedDetailRecord(r)}
                  >
                    {/* Scheduled Date & Shift */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span className="font-mono">{r.date}</span>
                        {r.date === "2026-10-21" && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-black uppercase">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">General (9 AM – 8 PM)</div>
                    </td>

                    {/* Record ID */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-xs font-bold text-slate-800 max-w-[160px] truncate" title={r.recordId}>
                        {r.recordId}
                      </div>
                      <div className="text-[10px] text-slate-400">{r.category}</div>
                    </td>

                    {/* Machine & Asset */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 max-w-[200px] truncate" title={r.machineWithAsset}>
                        {r.machineWithAsset}
                      </div>
                      {r.assetId && (
                        <div className="text-[10px] font-mono text-slate-400">{r.assetId}</div>
                      )}
                    </td>

                    {/* Check Point */}
                    <td className="py-3 px-4 max-w-[260px]">
                      <div className="font-semibold text-slate-800 line-clamp-2" title={r.checkPoint}>
                        {r.checkPoint}
                      </div>
                      {r.remarks && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5 truncate" title={r.remarks}>
                          Note: {r.remarks}
                        </div>
                      )}
                    </td>

                    {/* Frequency */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        {r.frequency}
                      </span>
                    </td>

                    {/* Status / Traceability */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      {r.isOk ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.8 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                          <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Passed (OK)
                        </span>
                      ) : r.isNotOk ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.8 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                          Flagged (Not OK)
                        </span>
                      ) : r.isPending ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            Pending Today
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Overdue (Scheduled)
                          </span>
                          <span className="text-[9px] font-semibold text-amber-800 mt-0.5">
                            Unverified Historical
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Operator */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 text-xs">{r.operator}</div>
                    </td>

                    {/* Action / Maintenance Routing */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.maintenanceTicket ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#880b13] bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 w-fit">
                            <svg className="w-3 h-3 text-[#880b13]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.007v.008H12v-.008z" />
                            </svg>
                            {r.maintenanceTicket}
                          </span>
                          <span className="text-[10px] font-bold text-rose-700">Ticket in Maintenance</span>
                        </div>
                      ) : r.isCompleted ? (
                        <span className="text-[11px] text-slate-400 font-medium">None (Inspection OK)</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Scheduled entry</span>
                      )}
                    </td>

                    {/* Details Button */}
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDetailRecord(r);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View Full Record Details"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>records per page</span>
            <span className="text-slate-400">|</span>
            <span className="font-semibold">
              Showing {filteredRecords.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(page * pageSize, filteredRecords.length)} of {filteredRecords.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              « First
            </button>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              ‹ Prev
            </button>

            <span className="px-3 py-1 font-bold text-slate-900 bg-slate-100 rounded-lg">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next ›
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Last »
            </button>
          </div>
        </div>
      </div>

      {/* 5. Detailed Inspection Record Modal */}
      {selectedDetailRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedDetailRecord(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Checklist Inspection Record Traceability
                </span>
                <h3 className="text-base font-black text-slate-900 mt-0.5">
                  {selectedDetailRecord.recordId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Unverified / Scheduled Historical Notice */}
            {selectedDetailRecord.isUnverified && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs flex items-start gap-2.5">
                <span className="text-lg">⚠️</span>
                <div>
                  <div className="font-bold text-amber-900">Historical Scheduled Inspection Slot</div>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    This entry represents a scheduled machine inspection during the 34-day historical schedule. In accordance with SkyMS maintenance traceability rules, unperformed historical dates are not populated with fabricated answers and remain clearly identified.
                  </div>
                </div>
              </div>
            )}

            {/* Record Properties Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Machine / Asset</span>
                <span className="font-bold text-slate-900 block mt-0.5">{selectedDetailRecord.machineWithAsset}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Scheduled Date &amp; Shift</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {selectedDetailRecord.date} • General (9 AM – 8 PM)
                </span>
              </div>

              <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Check Point Description</span>
                <span className="font-bold text-slate-900 block mt-0.5 leading-relaxed">
                  {selectedDetailRecord.checkPoint}
                </span>
              </div>

              {selectedDetailRecord.standardRequirement && (
                <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Standard Requirement / Tolerance</span>
                  <span className="font-semibold text-slate-700 block mt-0.5 leading-relaxed">
                    {selectedDetailRecord.standardRequirement}
                  </span>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Inspection Frequency</span>
                <span className="font-bold text-slate-900 block mt-0.5">{selectedDetailRecord.frequency}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Inspection Status</span>
                <div className="mt-1">
                  {selectedDetailRecord.isOk ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                      Passed (OK)
                    </span>
                  ) : selectedDetailRecord.isNotOk ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                      Flagged (Not OK)
                    </span>
                  ) : selectedDetailRecord.isPending ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                      Pending (Today's Inspection)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-xs font-bold">
                      Overdue (Uncompleted)
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Assigned Operator</span>
                <span className="font-bold text-slate-900 block mt-0.5">{selectedDetailRecord.operator}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Maintenance Ticket</span>
                <span className="font-bold text-[#880b13] block mt-0.5">
                  {selectedDetailRecord.maintenanceTicket || "None"}
                </span>
              </div>

              {selectedDetailRecord.actionIfNotOk && (
                <div className="col-span-2 bg-rose-50/60 p-3 rounded-xl border border-rose-200/60">
                  <span className="text-[10px] font-bold text-rose-800 block uppercase">Corrective Action If Not OK</span>
                  <span className="text-slate-800 font-medium block mt-0.5 leading-relaxed">
                    {selectedDetailRecord.actionIfNotOk}
                  </span>
                </div>
              )}

              {selectedDetailRecord.remarks && (
                <div className="col-span-2 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
                  <span className="text-[10px] font-bold text-amber-800 block uppercase">Technician Remarks</span>
                  <span className="text-slate-800 font-medium block mt-0.5">{selectedDetailRecord.remarks}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
