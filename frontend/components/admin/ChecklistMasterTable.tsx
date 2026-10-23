"use client";

import { useState, useMemo } from "react";
import type { Row } from "./UserMasterTable";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { todayString, isSunday } from "@/lib/dates";

interface MachineItem {
  assetId: string;
  name: string;
  department?: string;
  category?: string;
  location?: string;
  status?: string;
}

interface ChecklistMasterTableProps {
  rows: Row[];
  machinesList?: MachineItem[];
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
  onAddNew?: () => void;
  currentUser?: { name?: string; email?: string; role?: string };
}

interface InspectionAnswer {
  response: string;
  remarks: string;
  photoUrl: string;
}

export default function ChecklistMasterTable({
  rows,
  machinesList = [],
  onEdit,
  onDelete,
  onAddNew,
  currentUser,
}: ChecklistMasterTableProps) {
  // Filter States
  const [search, setSearch] = useState("");
  const [machineFilter, setMachineFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [photoFilter, setPhotoFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Inspection Checklist Modal State ("the checklist field to open for filled the data")
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedMachineAssetId, setSelectedMachineAssetId] = useState<string>("");
  const [inspectorName, setInspectorName] = useState<string>(
    currentUser?.name || currentUser?.email || "Admin Inspector"
  );
  const [inspectShift, setInspectShift] = useState<string>("Shift 1 (Morning)");
  const [inspectDate, setInspectDate] = useState<string>(() => todayString());
  const [answers, setAnswers] = useState<Record<string, InspectionAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: "success" | "error";
    message: string;
    details?: string;
  } | null>(null);
  const [uploadingPoint, setUploadingPoint] = useState<string | null>(null);
  const isSundayToday = useMemo(() => isSunday(todayString()), []);

  // Helper to extract clean values across field name variants
  const getAssetId = (r: Row): string =>
    String(
      r["Asset ID"] ||
        r["Asset ID / Machine"] ||
        r["Machine / Asset"] ||
        r["Machine"] ||
        r["assetId"] ||
        ""
    ).trim();

  const getCategory = (r: Row): string =>
    String(r["Category"] || r["category"] || "General").trim();

  const getCheckPoint = (r: Row): string =>
    String(
      r["Check Point"] ||
        r["Check Point / Task"] ||
        r["checkPoint"] ||
        r["Task"] ||
        ""
    ).trim();

  const getStandard = (r: Row): string =>
    String(
      r["Standard Requirement"] ||
        r["Standard / Requirement"] ||
        r["Standard Parameter"] ||
        r["standard"] ||
        "Visual / Normal"
    ).trim();

  const getFrequency = (r: Row): string =>
    String(r["Frequency"] || r["frequency"] || "Daily").trim();

  const getResponse = (r: Row): string =>
    String(r["Response"] || r["response"] || "OK / Not OK / NA").trim();

  const getRequiredPhoto = (r: Row): string => {
    const val = String(r["Required Photo"] || r["requiredPhoto"] || "No").trim();
    return /^yes$/i.test(val) ? "Yes" : "No";
  };

  const getIfNotOkAction = (r: Row): string =>
    String(
      r["If Not OK Action"] ||
        r["IF Not ok Action"] ||
        r["actionIfNotOk"] ||
        "Report to Maintenance"
    ).trim();

  const getActive = (r: Row): string => {
    const val = String(r["Active"] || r["Status"] || r["status"] || "Yes").trim();
    return /^(no|inactive|archived)$/i.test(val) ? "No" : "Yes";
  };

  // Map assetId -> Machine Name from Machine Master
  const machineNameMap = useMemo(() => {
    const map = new Map<string, string>();
    machinesList.forEach((m) => {
      if (m.assetId) map.set(m.assetId.toUpperCase(), m.name);
    });
    return map;
  }, [machinesList]);

  const getFriendlyMachineName = (assetId: string): string => {
    if (!assetId || assetId.toUpperCase() === "ALL") return "All Factory Machines";
    const found = machineNameMap.get(assetId.toUpperCase());
    if (found) return found;
    // Fallback search in machinesList with case insensitivity
    const m = machinesList.find(
      (mac) => mac.assetId?.toLowerCase() === assetId.toLowerCase()
    );
    return m ? m.name : "Machine Asset";
  };

  // Distinct Filter Option Lists
  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const c = getCategory(r);
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [rows]);

  const distinctFrequencies = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const f = getFrequency(r);
      if (f) set.add(f);
    });
    return Array.from(set).sort();
  }, [rows]);

  const distinctMachinesInChecklist = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      const aid = getAssetId(r);
      if (aid) {
        map.set(aid, getFriendlyMachineName(aid));
      }
    });
    // Also include all machines from Machine Master
    machinesList.forEach((m) => {
      if (m.assetId && !map.has(m.assetId)) {
        map.set(m.assetId, m.name);
      }
    });
    return Array.from(map.entries()).map(([assetId, name]) => ({
      assetId,
      name,
    }));
  }, [rows, machinesList, machineNameMap]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    const s = search.toLowerCase().trim();

    return rows.filter((r) => {
      const assetId = getAssetId(r).toLowerCase();
      const cat = getCategory(r).toLowerCase();
      const cp = getCheckPoint(r).toLowerCase();
      const std = getStandard(r).toLowerCase();
      const freq = getFrequency(r).toLowerCase();
      const ifNotOk = getIfNotOkAction(r).toLowerCase();
      const activeVal = getActive(r).toLowerCase();
      const photoVal = getRequiredPhoto(r).toLowerCase();
      const mName = getFriendlyMachineName(getAssetId(r)).toLowerCase();

      // Search match
      const matchesSearch =
        !s ||
        cp.includes(s) ||
        assetId.includes(s) ||
        cat.includes(s) ||
        std.includes(s) ||
        ifNotOk.includes(s) ||
        freq.includes(s) ||
        mName.includes(s);

      // Dropdown filters
      const matchesMachine =
        machineFilter === "all" ||
        getAssetId(r).toUpperCase() === machineFilter.toUpperCase() ||
        (getAssetId(r).toUpperCase() === "ALL" && machineFilter !== "all");

      const matchesCat =
        categoryFilter === "all" ||
        cat === categoryFilter.toLowerCase();

      const matchesFreq =
        frequencyFilter === "all" ||
        freq === frequencyFilter.toLowerCase();

      const matchesActive =
        activeFilter === "all" ||
        (activeFilter === "yes" && activeVal === "yes") ||
        (activeFilter === "no" && activeVal === "no");

      const matchesPhoto =
        photoFilter === "all" ||
        (photoFilter === "yes" && photoVal === "yes") ||
        (photoFilter === "no" && photoVal === "no");

      return (
        matchesSearch &&
        matchesMachine &&
        matchesCat &&
        matchesFreq &&
        matchesActive &&
        matchesPhoto
      );
    });
  }, [
    rows,
    search,
    machineFilter,
    categoryFilter,
    frequencyFilter,
    activeFilter,
    photoFilter,
    machineNameMap,
  ]);


  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Metrics
  const totalCheckpoints = rows.length;
  const activeCount = rows.filter((r) => getActive(r) === "Yes").length;
  const photoRequiredCount = rows.filter((r) => getRequiredPhoto(r) === "Yes").length;
  const dailyCount = rows.filter((r) => getFrequency(r).toLowerCase() === "daily").length;
  const coveredMachinesCount = new Set(
    rows.map((r) => getAssetId(r)).filter((a) => a && a !== "ALL")
  ).size;

  // Open Inspection Modal
  const handleOpenInspectionModal = (preselectedAssetId?: string) => {
    let chosen = preselectedAssetId;
    if (!chosen || chosen.toUpperCase() === "ALL") {
      // Pick first machine from machinesList or first row's machine
      if (machinesList.length > 0) {
        chosen = machinesList[0].assetId;
      } else if (rows.length > 0 && getAssetId(rows[0])) {
        chosen = getAssetId(rows[0]);
      } else {
        chosen = "SKY-LSR-001";
      }
    }
    setSelectedMachineAssetId(chosen);
    setAnswers({});
    setSubmitFeedback(null);
    setInspectModalOpen(true);
  };

  // Active check points for current selected machine in Inspection Modal
  const inspectionPoints = useMemo(() => {
    if (!selectedMachineAssetId) return [];
    const targetNorm = selectedMachineAssetId.toUpperCase().trim();

    return rows.filter((r) => {
      const active = getActive(r) === "Yes";
      if (!active) return false;
      const aid = getAssetId(r).toUpperCase().trim();
      // Match exact machine Asset ID OR universal factory checkpoint "ALL"
      return aid === targetNorm || aid === "ALL" || aid === "ALL MACHINES";
    });
  }, [rows, selectedMachineAssetId]);

  // Set an answer for a specific check point
  const handleSetResponse = (pointId: string, response: string) => {
    setAnswers((prev) => ({
      ...prev,
      [pointId]: {
        response,
        remarks: prev[pointId]?.remarks || "",
        photoUrl: prev[pointId]?.photoUrl || "",
      },
    }));
  };

  const handleSetRemarks = (pointId: string, remarks: string) => {
    setAnswers((prev) => ({
      ...prev,
      [pointId]: {
        response: prev[pointId]?.response || "OK",
        remarks,
        photoUrl: prev[pointId]?.photoUrl || "",
      },
    }));
  };

  const handlePhotoUpload = async (pointId: string, file: File) => {
    try {
      setUploadingPoint(pointId);
      const url = await uploadPhoto(file);
      setAnswers((prev) => ({
        ...prev,
        [pointId]: {
          response: prev[pointId]?.response || "OK",
          remarks: prev[pointId]?.remarks || "",
          photoUrl: url,
        },
      }));
    } catch (err: any) {
      alert(err.message || "Failed to upload photo");
    } finally {
      setUploadingPoint(null);
    }
  };

  // Mark All OK quick action
  const handleMarkAllOk = () => {
    const updated: Record<string, InspectionAnswer> = {};
    inspectionPoints.forEach((p) => {
      const pid = getCheckPoint(p);
      updated[pid] = {
        response: "OK",
        remarks: answers[pid]?.remarks || "Checked & verified normal",
        photoUrl: answers[pid]?.photoUrl || "",
      };
    });
    setAnswers(updated);
  };

  // Submit Inspection Checklist to /api/checklist
  const handleSubmitInspection = async () => {
    if (!selectedMachineAssetId) {
      alert("Please select a machine first.");
      return;
    }

    if (inspectionPoints.length === 0) {
      alert("No active check points configured for this machine in Checklist Master.");
      return;
    }

    if (isSundayToday) {
      alert(
        "Checklist submissions are OFF on Sunday (Weekly Off).\n\nFactory operates on General Shift: 9:00 AM – 8:00 PM (Monday to Saturday). Inspections resume on Monday at 9:00 AM."
      );
      return;
    }

    // Validate that every check point has a response
    const unanswered = inspectionPoints.filter(
      (p) => !answers[getCheckPoint(p)]?.response
    );
    if (unanswered.length > 0) {
      const names = unanswered.map((u) => getCheckPoint(u)).slice(0, 3).join(", ");
      alert(`Please select a response (OK / Not OK) for every check point. Missing: ${names}`);
      return;
    }

    setSubmitting(true);
    setSubmitFeedback(null);

    try {
      const payloadAnswers = inspectionPoints.map((p) => {
        const cp = getCheckPoint(p);
        const ans = answers[cp];
        return {
          templateId: cp,
          response: ans.response,
          remarks: ans.remarks || (ans.response === "OK" ? "Satisfactory" : "Issue noted"),
          photo: ans.photoUrl || "",
        };
      });

      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selectedMachineAssetId,
          answers: payloadAnswers,
          allowRecheck: true,
          shift: inspectShift,
          inspector: inspectorName,
          date: inspectDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to record checklist inspection");
      }

      setSubmitFeedback({
        type: "success",
        message: "Checklist inspection submitted & saved successfully!",
        details: `Recorded ${payloadAnswers.length} checkpoints for machine ${selectedMachineAssetId}. Saved directly to MongoDB Atlas.`,
      });

      // Clear answers after successful save
      setTimeout(() => {
        setAnswers({});
      }, 1000);
    } catch (err: any) {
      setSubmitFeedback({
        type: "error",
        message: err.message || "Failed to submit checklist data",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Inspect Modal Machine Object
  const currentSelectedMachine = useMemo(() => {
    return (
      machinesList.find(
        (m) => m.assetId?.toUpperCase() === selectedMachineAssetId.toUpperCase()
      ) || {
        assetId: selectedMachineAssetId,
        name: getFriendlyMachineName(selectedMachineAssetId),
        department: "Plant Floor",
        status: "Active",
      }
    );
  }, [machinesList, selectedMachineAssetId]);

  // Inspection Stats
  const answeredCount = inspectionPoints.filter(
    (p) => answers[getCheckPoint(p)]?.response
  ).length;
  const okCount = inspectionPoints.filter(
    (p) => answers[getCheckPoint(p)]?.response === "OK"
  ).length;
  const notOkCount = inspectionPoints.filter(
    (p) => answers[getCheckPoint(p)]?.response === "Not OK"
  ).length;

  return (
    <div className="space-y-4">
      {/* 1. TOP STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Checkpoints</span>
            <span className="text-base">📋</span>
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
            {totalCheckpoints}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
            Across factory equipment
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
            <span>Active Points</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-950 tracking-tight">
            {activeCount}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-emerald-700">
            Enforced in daily shifts
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800 text-xs font-bold">
            <span>Machines Covered</span>
            <span className="text-base">⚙️</span>
          </div>
          <div className="mt-1 text-2xl font-black text-blue-950 tracking-tight">
            {coveredMachinesCount}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-blue-700">
            Linked to Machine Master
          </div>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-purple-800 text-xs font-bold">
            <span>Photo (Optional)</span>
            <span className="text-base">📸</span>
          </div>
          <div className="mt-1 text-2xl font-black text-purple-950 tracking-tight">
            {photoRequiredCount}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-purple-700">
            Optional image evidence
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-amber-100 bg-amber-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
            <span>Daily Routine</span>
            <span className="text-base">⏱️</span>
          </div>
          <div className="mt-1 text-2xl font-black text-amber-950 tracking-tight">
            {dailyCount}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-amber-700">
            Every shift verification
          </div>
        </div>
      </div>

      {/* 2. ACTION & FILTER TOOLBAR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>📋</span> Checklist Master & Inspection Control
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Standard operating check points, tolerances, safety parameters, and live inspection portal
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[11px] font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>General Shift: 9:00 AM – 8:00 PM (Mon – Sat)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 text-[11px] font-black">
                <span>📅</span>
                <span>Weekly Off: Sunday (Checklist Filling Off)</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Prominent Fill / Perform Checklist Button */}
            <button
              type="button"
              onClick={() => handleOpenInspectionModal()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2 text-xs font-black text-white shadow-sm hover:from-emerald-700 hover:to-teal-800 transition-all transform active:scale-95 cursor-pointer"
              title="Open digital checklist field to fill and inspect machine data"
            >
              <span>📋</span>
              <span>Fill / Perform Checklist</span>
            </button>


            {/* Add Checklist Point Button */}
            {onAddNew && (
              <button
                type="button"
                onClick={onAddNew}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#880b13] px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-[#6e080e] transition-colors cursor-pointer"
                title="Add a new check point linked to Machine Master"
              >
                <span>+</span>
                <span>Add Checklist Point</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-attribute Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 border-t border-slate-100">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search check points, standards, machines..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#880b13] focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Machine Filter (Linked to Machine Master) */}
          <div>
            <select
              value={machineFilter}
              onChange={(e) => {
                setMachineFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#880b13] focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Machines</option>
              <option value="ALL">🌟 Universal (All Machines)</option>
              {distinctMachinesInChecklist
                .filter((m) => m.assetId !== "ALL")
                .map((m) => (
                  <option key={m.assetId} value={m.assetId}>
                    {m.assetId} — {m.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#880b13] focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Categories</option>
              {distinctCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Frequency Filter */}
          <div>
            <select
              value={frequencyFilter}
              onChange={(e) => {
                setFrequencyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#880b13] focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Frequencies</option>
              {distinctFrequencies.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Active Status Filter */}
          <div>
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#880b13] focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="yes">● Active Only</option>
              <option value="no">○ Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Filter Reset pill if active */}
        {(search ||
          machineFilter !== "all" ||
          categoryFilter !== "all" ||
          frequencyFilter !== "all" ||
          activeFilter !== "all" ||
          photoFilter !== "all") && (
          <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
            <span>
              Showing <strong>{filteredRows.length}</strong> of{" "}
              <strong>{rows.length}</strong> checklist points matching filters
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setMachineFilter("all");
                setCategoryFilter("all");
                setFrequencyFilter("all");
                setActiveFilter("all");
                setPhotoFilter("all");
                setCurrentPage(1);
              }}
              className="text-[#880b13] hover:underline font-bold"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* 3. CHECKLIST MASTER DATA TABLE */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <th className="py-3 px-3.5 w-12 text-center">#</th>
                <th className="py-3 px-3.5 min-w-[180px]">1. Asset ID / Machine</th>
                <th className="py-3 px-3.5 min-w-[130px]">2. Category</th>
                <th className="py-3 px-3.5 min-w-[220px]">3. Check Point</th>
                <th className="py-3 px-3.5 min-w-[200px]">4. Standard Requirement</th>
                <th className="py-3 px-3.5 min-w-[110px]">5. Frequency</th>
                <th className="py-3 px-3.5 min-w-[130px]">6. Response</th>
                <th className="py-3 px-3.5 min-w-[110px]">7. Photo (Optional)</th>
                <th className="py-3 px-3.5 min-w-[180px]">8. If Not OK Action</th>
                <th className="py-3 px-3.5 min-w-[90px]">9. Active</th>
                <th className="py-3 px-3.5 text-right sticky right-0 bg-slate-50/95 backdrop-blur-xs min-w-[150px] shadow-xs">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="text-3xl mb-2">📋</div>
                    <div className="font-bold text-slate-700">No Checklist Points Found</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Try resetting your search query or filters above.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const assetId = getAssetId(r);
                  const machineName = getFriendlyMachineName(assetId);
                  const cat = getCategory(r);
                  const cp = getCheckPoint(r);
                  const std = getStandard(r);
                  const freq = getFrequency(r);
                  const resp = getResponse(r);
                  const photo = getRequiredPhoto(r);
                  const action = getIfNotOkAction(r);
                  const active = getActive(r);

                  // Color category pill
                  const catColor = /elect/i.test(cat)
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : /mech/i.test(cat)
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : /safe/i.test(cat)
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : /hydr|pneu/i.test(cat)
                    ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                    : /lub/i.test(cat)
                    ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                    : "bg-slate-100 text-slate-700 border-slate-200";

                  // Color frequency pill
                  const freqColor = /daily/i.test(freq)
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : /week/i.test(freq)
                    ? "bg-sky-50 text-sky-800 border-sky-200"
                    : /month/i.test(freq)
                    ? "bg-purple-50 text-purple-800 border-purple-200"
                    : "bg-slate-50 text-slate-700 border-slate-200";

                  return (
                    <tr
                      key={r["__row"] || idx}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Row # */}
                      <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {globalIdx}
                      </td>

                      {/* 1. Asset ID / Machine (Linked to Machine Master) */}
                      <td className="py-3 px-3.5">
                        <div className="flex flex-col">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold text-xs ${
                              assetId.toUpperCase() === "ALL"
                                ? "text-indigo-700"
                                : "text-slate-900"
                            }`}
                          >
                            {assetId.toUpperCase() === "ALL" ? (
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md border border-indigo-200 text-[10px] font-black">
                                🌟 ALL
                              </span>
                            ) : (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200 text-slate-800">
                                {assetId || "—"}
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[180px] mt-0.5">
                            {machineName}
                          </span>
                        </div>
                      </td>

                      {/* 2. Category */}
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold ${catColor}`}
                        >
                          {cat}
                        </span>
                      </td>

                      {/* 3. Check Point */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 text-xs max-w-[280px]">
                          {cp}
                        </div>
                      </td>

                      {/* 4. Standard Requirement */}
                      <td className="py-3 px-3.5">
                        <div className="text-[11px] text-slate-700 font-medium bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/80 max-w-[240px]">
                          <span className="font-bold text-slate-500 mr-1">📏</span>
                          {std}
                        </div>
                      </td>

                      {/* 5. Frequency */}
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${freqColor}`}
                        >
                          {freq}
                        </span>
                      </td>

                      {/* 6. Response */}
                      <td className="py-3 px-3.5 text-slate-700 font-semibold text-[11px]">
                        <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 text-[10px] font-bold">
                          {resp}
                        </span>
                      </td>

                      {/* 7. Required Photo */}
                      <td className="py-3 px-3.5">
                        {photo === "Yes" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                            <span>📸</span> Optional
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-[11px]">
                            No
                          </span>
                        )}
                      </td>

                      {/* 8. If Not OK Action */}
                      <td className="py-3 px-3.5">
                        <div className="inline-flex items-start gap-1 text-[11px] font-medium text-amber-900 bg-amber-50/70 border border-amber-200/70 p-1.5 rounded-lg max-w-[200px]">
                          <span className="text-amber-600 text-[10px] mt-0.5">⚠️</span>
                          <span>{action}</span>
                        </div>
                      </td>

                      {/* 9. Active */}
                      <td className="py-3 px-3.5">
                        {active === "Yes" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right sticky right-0 bg-white group-hover:bg-slate-50 transition-colors shadow-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Fill Button for this machine */}
                          <button
                            type="button"
                            onClick={() => handleOpenInspectionModal(assetId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-800 hover:bg-teal-100 transition-colors cursor-pointer"
                            title="Fill and inspect checklist for this machine"
                          >
                            <span>📋</span>
                            <span>Fill</span>
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => onEdit(r)}
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:text-blue-700 transition-colors cursor-pointer"
                            title="Edit this checklist point"
                          >
                            ✏️ Edit
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => onDelete(r)}
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer"
                            title="Delete this checklist point"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 bg-slate-50/50 text-xs">
          <div className="text-slate-500 font-medium">
            Showing{" "}
            <strong>
              {filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{" "}
            to{" "}
            <strong>
              {Math.min(currentPage * pageSize, filteredRows.length)}
            </strong>{" "}
            of <strong>{filteredRows.length}</strong> items
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-2 text-slate-500 font-medium">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:outline-hidden"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-2 text-slate-600 font-bold">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MODAL: DIGITAL CHECKLIST INSPECTION FORM ("the checlist fild to open for filld the data") */}
      {inspectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xl font-bold">
                  📋
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    Live Shift Inspection Checklist
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Operator / Admin Digital Inspection Form linked with Machine Master
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                title="Close inspection"
              >
                ✕
              </button>
            </div>

            {/* Modal Sub-header: Machine Selection & Inspector Parameters */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* 1. Machine Selection from Machine Master */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                    Select Machine *
                  </label>
                  <select
                    value={selectedMachineAssetId}
                    onChange={(e) => {
                      setSelectedMachineAssetId(e.target.value);
                      setAnswers({});
                      setSubmitFeedback(null);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-600 focus:outline-hidden cursor-pointer"
                  >
                    {machinesList && machinesList.length > 0 ? (
                      machinesList.map((m) => (
                        <option key={m.assetId} value={m.assetId}>
                          {m.assetId} — {m.name}
                        </option>
                      ))
                    ) : (
                      distinctMachinesInChecklist
                        .filter((m) => m.assetId !== "ALL")
                        .map((m) => (
                          <option key={m.assetId} value={m.assetId}>
                            {m.assetId} — {m.name}
                          </option>
                        ))
                    )}
                  </select>
                </div>

                {/* 2. Shift */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                    Inspection Shift
                  </label>
                  <select
                    value={inspectShift}
                    onChange={(e) => setInspectShift(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-600 focus:outline-hidden"
                  >
                    <option value="Shift 1 (07:00 - 15:30)">Shift 1 (Morning: 07:00 - 15:30)</option>
                    <option value="Shift 2 (15:30 - 00:00)">Shift 2 (Evening: 15:30 - 00:00)</option>
                    <option value="Shift 3 (Night)">Shift 3 (Night: 00:00 - 07:00)</option>
                    <option value="General Shift">General Shift (09:00 - 17:30)</option>
                    <option value="Pre-Start Inspection">Pre-Start Run Walkaround</option>
                  </select>
                </div>

                {/* 3. Date */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                    Inspection Date
                  </label>
                  <input
                    type="date"
                    value={inspectDate}
                    onChange={(e) => setInspectDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-600 focus:outline-hidden"
                  />
                </div>

                {/* 4. Inspector Name */}
                <div>
                  <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                    Inspector / Operator
                  </label>
                  <input
                    type="text"
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    placeholder="Enter inspector name"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Machine Master Details Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-teal-50/70 border border-teal-200/80 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">🏭</span>
                  <div>
                    <span className="font-bold text-teal-950">
                      {currentSelectedMachine.name}
                    </span>{" "}
                    <span className="font-mono text-[11px] text-teal-800 bg-white px-1.5 py-0.5 rounded-md border border-teal-200">
                      {selectedMachineAssetId}
                    </span>
                    <span className="text-teal-700 ml-2 font-medium">
                      Dept: {currentSelectedMachine.department || "Plant Floor"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-teal-900">
                    Status:{" "}
                    <span className="text-emerald-700 font-black">
                      {currentSelectedMachine.status || "Running"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleMarkAllOk}
                    className="rounded-lg bg-teal-700 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-teal-800 transition-colors shadow-2xs cursor-pointer"
                  >
                    ✓ Mark All OK
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-600">
                    Inspection Progress: {answeredCount} of {inspectionPoints.length} completed
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-700">OK: {okCount}</span>
                    <span className="text-rose-700">Not OK: {notOkCount}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 transition-all duration-300"
                    style={{
                      width: `${
                        inspectionPoints.length > 0
                          ? (answeredCount / inspectionPoints.length) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Sunday Weekly Off Notification in Modal */}
            {isSundayToday && (
              <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-950 flex items-start gap-3">
                <span className="text-2xl flex-none">📅</span>
                <div>
                  <h4 className="font-black text-xs sm:text-sm text-rose-900">
                    Sunday is Weekly Off — Checklist Submissions Are Closed Today
                  </h4>
                  <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                    Factory operates on <strong>General Shift: 9:00 AM – 8:00 PM (Monday to Saturday)</strong>. Sunday is a scheduled weekly off day. Checklist filling is OFF today and will resume on Monday at 9:00 AM.
                  </p>
                </div>
              </div>
            )}

            {/* Feedback Banner */}
            {submitFeedback && (
              <div
                className={`p-3 text-xs border-b ${
                  submitFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                    : "bg-red-50 text-red-900 border-red-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {submitFeedback.type === "success" ? "✅" : "⚠️"}
                  </span>
                  <div>
                    <strong>{submitFeedback.message}</strong>
                    {submitFeedback.details && (
                      <div className="text-[11px] opacity-90 mt-0.5">
                        {submitFeedback.details}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Checklist Points Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {inspectionPoints.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="text-3xl mb-2">⚙️</div>
                  <div className="font-bold text-slate-700">
                    No active check points for machine {selectedMachineAssetId}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Add check points for this machine in Checklist Master or set universal checkpoints (Asset ID = ALL).
                  </div>
                </div>
              ) : (
                inspectionPoints.map((point, pIdx) => {
                  const cp = getCheckPoint(point);
                  const std = getStandard(point);
                  const cat = getCategory(point);
                  const freq = getFrequency(point);
                  const photoReq = getRequiredPhoto(point) === "Yes";
                  const ifNotOk = getIfNotOkAction(point);
                  const ans = answers[cp] || { response: "", remarks: "", photoUrl: "" };
                  const isBad = ans.response === "Not OK";

                  return (
                    <div
                      key={pIdx}
                      className={`rounded-2xl border transition-all p-4 ${
                        isBad
                          ? "border-rose-300 bg-rose-50/40 shadow-xs"
                          : ans.response === "OK"
                          ? "border-emerald-200 bg-white"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        {/* Point Details */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-700">
                              {pIdx + 1}
                            </span>
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {cp}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                              {cat}
                            </span>
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                              {freq}
                            </span>
                            {photoReq && (
                              <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200 flex items-center gap-1">
                                <span>📸</span> Photo (Optional)
                              </span>
                            )}
                          </div>

                          {/* Standard Requirement */}
                          <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200/70">
                            <strong className="text-slate-800">Standard Requirement:</strong>{" "}
                            {std}
                          </div>
                        </div>

                        {/* Interactive Response Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() => handleSetResponse(cp, "OK")}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              ans.response === "OK"
                                ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30"
                                : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200"
                            }`}
                          >
                            <span>✓</span> OK
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetResponse(cp, "Not OK")}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              ans.response === "Not OK"
                                ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30"
                                : "bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-800 border border-slate-200"
                            }`}
                          >
                            <span>✕</span> Not OK
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetResponse(cp, "NA")}
                            className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              ans.response === "NA"
                                ? "bg-slate-700 text-white shadow-sm"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                            }`}
                          >
                            N/A
                          </button>
                        </div>
                      </div>

                      {/* If Not OK Action Warning Box */}
                      {isBad && (
                        <div className="mt-3 p-2.5 rounded-xl bg-rose-100/70 border border-rose-300 text-xs text-rose-950 flex items-start gap-2 animate-fadeIn">
                          <span className="text-base text-rose-600">🚨</span>
                          <div>
                            <strong>ACTION REQUIRED:</strong> {ifNotOk}
                            <div className="text-[11px] text-rose-800 mt-0.5">
                              Please describe the observed defect below and take immediate corrective measures.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Observations / Remarks and Photo Upload */}
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        {/* Remarks Input */}
                        <div>
                          <input
                            type="text"
                            value={ans.remarks}
                            onChange={(e) => handleSetRemarks(cp, e.target.value)}
                            placeholder={
                              isBad
                                ? "Required: Describe defect / deviation observed..."
                                : "Optional: Value reading (e.g. 5.5 bar) or observation..."
                            }
                            className={`w-full rounded-xl border px-3 py-1.5 text-xs font-medium focus:outline-hidden ${
                              isBad && !ans.remarks
                                ? "border-rose-400 bg-rose-50/50 text-rose-950 placeholder:text-rose-400"
                                : "border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-teal-600"
                            }`}
                          />
                        </div>

                        {/* Photo Attachment */}
                        <div className="flex items-center gap-2">
                          <label className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
                            <span>📸</span>
                            <span>
                              {uploadingPoint === cp
                                ? "Uploading..."
                                : ans.photoUrl
                                ? "Change Photo"
                                : "Attach Photo (Optional)"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingPoint === cp}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoUpload(cp, file);
                              }}
                            />
                          </label>

                          {ans.photoUrl && (
                            <a
                              href={ans.photoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-xl bg-purple-50 border border-purple-200 px-2 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100"
                            >
                              <span>👁️</span> Preview
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-bold text-slate-600">
                  Ready to submit: {answeredCount} / {inspectionPoints.length}
                </span>
                {notOkCount > 0 && (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-300">
                    ⚠️ {notOkCount} Defect{notOkCount === 1 ? "" : "s"} Noted
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel / Close
                </button>

                <button
                  type="button"
                  onClick={handleSubmitInspection}
                  disabled={submitting || inspectionPoints.length === 0 || isSundayToday}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-black text-white shadow-sm transition-all ${
                    isSundayToday
                      ? "bg-slate-400 cursor-not-allowed opacity-75"
                      : "bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 disabled:opacity-50 cursor-pointer"
                  }`}
                >
                  {isSundayToday ? (
                    <>
                      <span>📅</span>
                      <span>Sunday Weekly Off (Checklist Closed)</span>
                    </>
                  ) : submitting ? (
                    <>
                      <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting to MongoDB...</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Submit Shift Inspection Checklist</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
