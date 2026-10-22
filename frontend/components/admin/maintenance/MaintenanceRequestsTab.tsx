"use client";

import React, { useMemo, useState } from "react";
import type { MaintenanceRequest, TechnicianItem } from "@/lib/maintenanceSystem";
import type { SessionUser } from "@/lib/auth";

export type MaintenanceSection = "pending" | "in_progress" | "completed" | "on_hold" | "cancelled";

interface MaintenanceRequestsTabProps {
  requests: MaintenanceRequest[];
  technicians: TechnicianItem[];
  machinesList?: any[];
  currentUser?: SessionUser;
  onAssignRequest: (requestId: string, technicianName: string, priority?: any, targetDate?: string) => Promise<void>;
  onStartWork?: (requestId: string) => Promise<void>;
  onPutOnHold?: (requestId: string, reason: string) => Promise<void>;
  onCancelRequest?: (requestId: string, reason: string, status?: "Cancelled" | "Rejected") => Promise<void>;
  onCreateRequest?: (reqData: any) => Promise<void>;
  onReopenRequest?: (requestId: string, reason: string) => Promise<void>;
  onOpenWorkEntryForRequest: (req: MaintenanceRequest) => void;
  onRefresh: () => void;
  initialFilter?: string;
  initialSection?: MaintenanceSection;
}

export default function MaintenanceRequestsTab({
  requests,
  technicians,
  machinesList = [],
  currentUser,
  onAssignRequest,
  onStartWork,
  onPutOnHold,
  onCancelRequest,
  onCreateRequest,
  onReopenRequest,
  onOpenWorkEntryForRequest,
  onRefresh,
  initialFilter,
  initialSection = "pending",
}: MaintenanceRequestsTabProps) {
  // Active workflow section
  const [activeSection, setActiveSection] = useState<MaintenanceSection>(() => {
    if (initialFilter) {
      const lower = initialFilter.toLowerCase();
      if (lower.includes("progress") || lower === "assigned") return "in_progress";
      if (lower === "completed" || lower === "closed" || lower === "resolved") return "completed";
      if (lower === "on hold" || lower === "hold") return "on_hold";
      if (lower === "cancelled" || lower === "rejected") return "cancelled";
    }
    return initialSection;
  });

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("All");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedTech, setSelectedTech] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");
  const [selectedMaintType, setSelectedMaintType] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyMyAllocated, setOnlyMyAllocated] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals state
  const [assignModalReq, setAssignModalReq] = useState<MaintenanceRequest | null>(null);
  const [assignTech, setAssignTech] = useState("");
  const [assignPriority, setAssignPriority] = useState<any>("High");
  const [assignTargetDate, setAssignTargetDate] = useState("");

  const [holdModalReq, setHoldModalReq] = useState<MaintenanceRequest | null>(null);
  const [holdReason, setHoldReason] = useState("");

  const [cancelModalReq, setCancelModalReq] = useState<MaintenanceRequest | null>(null);
  const [cancelStatus, setCancelStatus] = useState<"Cancelled" | "Rejected">("Cancelled");
  const [cancelReason, setCancelReason] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newReqAssetId, setNewReqAssetId] = useState("");
  const [newReqMachineName, setNewReqMachineName] = useState("");
  const [newReqDept, setNewReqDept] = useState("");
  const [newReqProblem, setNewReqProblem] = useState("");
  const [newReqPriority, setNewReqPriority] = useState<"Low" | "Medium" | "High" | "Critical">("High");
  const [newReqTech, setNewReqTech] = useState("");
  const [newReqTargetDate, setNewReqTargetDate] = useState("");

  const [detailModalReq, setDetailModalReq] = useState<MaintenanceRequest | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Section Counts
  const sectionCounts = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let onHold = 0;
    let cancelled = 0;

    for (const r of requests) {
      const s = (r.status || "Open").toLowerCase();
      if (s === "open") pending++;
      else if (s === "assigned" || s === "in progress") inProgress++;
      else if (s === "completed" || s === "closed" || s === "resolved") completed++;
      else if (s === "on hold") onHold++;
      else if (s === "cancelled" || s === "rejected") cancelled++;
      else pending++;
    }
    return { pending, inProgress, completed, onHold, cancelled };
  }, [requests]);

  // Unique Lists for Dropdown Filters
  const uniqueMachines = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.machineName) set.add(r.machineName);
    });
    return Array.from(set).sort();
  }, [requests]);

  const uniqueDepts = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set).sort();
  }, [requests]);

  const uniqueTechs = useMemo(() => {
    const set = new Set<string>();
    technicians.forEach((t) => set.add(t.name));
    requests.forEach((r) => {
      if (r.technicianName) set.add(r.technicianName);
      if (r.assignedTo) set.add(r.assignedTo);
    });
    return Array.from(set).sort();
  }, [technicians, requests]);

  // Section Filtering Logic
  const sectionFilteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const s = (r.status || "Open").toLowerCase();
      if (activeSection === "pending") return s === "open";
      if (activeSection === "in_progress") return s === "assigned" || s === "in progress";
      if (activeSection === "completed") return s === "completed" || s === "closed" || s === "resolved";
      if (activeSection === "on_hold") return s === "on hold";
      if (activeSection === "cancelled") return s === "cancelled" || s === "rejected";
      return true;
    });
  }, [requests, activeSection]);

  // Toolbar & Search Filtering Logic
  const finalFilteredRequests = useMemo(() => {
    return sectionFilteredRequests.filter((r) => {
      if (selectedMachine !== "All" && r.machineName !== selectedMachine) return false;
      if (selectedDept !== "All" && r.department !== selectedDept) return false;
      if (selectedTech !== "All") {
        const assigned = r.technicianName || r.assignedTo || "";
        if (assigned !== selectedTech) return false;
      }
      if (selectedPriority !== "All" && r.priority !== selectedPriority) return false;
      if (selectedMaintType !== "All") {
        const type = (r.maintenanceType || r.source || "").toLowerCase();
        if (!type.includes(selectedMaintType.toLowerCase())) return false;
      }
      if (dateFrom && (r.reportedDate < dateFrom && (r.reportedAt?.slice(0, 10) || "") < dateFrom)) return false;
      if (dateTo && (r.reportedDate > dateTo && (r.reportedAt?.slice(0, 10) || "") > dateTo)) return false;

      if (onlyMyAllocated && currentUser) {
        const userName = (currentUser.name || "").toLowerCase();
        const userEmail = (currentUser.email || "").toLowerCase();
        const tech = (r.technicianName || r.assignedTo || "").toLowerCase();
        if (!tech.includes(userName) && !tech.includes(userEmail)) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          r.requestId.toLowerCase().includes(q) ||
          r.assetId.toLowerCase().includes(q) ||
          r.machineName.toLowerCase().includes(q) ||
          (r.department || "").toLowerCase().includes(q) ||
          r.problem.toLowerCase().includes(q) ||
          (r.actualProblem || "").toLowerCase().includes(q) ||
          r.reportedBy.toLowerCase().includes(q) ||
          (r.technicianName || r.assignedTo || "").toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [
    sectionFilteredRequests,
    selectedMachine,
    selectedDept,
    selectedTech,
    selectedPriority,
    selectedMaintType,
    dateFrom,
    dateTo,
    onlyMyAllocated,
    currentUser,
    searchTerm,
  ]);

  // Pagination calculation
  const totalItems = finalFilteredRequests.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return finalFilteredRequests.slice(start, start + pageSize);
  }, [finalFilteredRequests, currentPage, pageSize]);


  // Section Change Handler
  const handleSectionTabClick = (section: MaintenanceSection) => {
    setActiveSection(section);
    setCurrentPage(1);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedMachine("All");
    setSelectedDept("All");
    setSelectedTech("All");
    setSelectedPriority("All");
    setSelectedMaintType("All");
    setDateFrom("");
    setDateTo("");
    setOnlyMyAllocated(false);
    setCurrentPage(1);
  };

  // Modal Triggers
  const handleOpenAssignModal = (req: MaintenanceRequest) => {
    setAssignModalReq(req);
    setAssignTech(req.technicianName || req.assignedTo || technicians[0]?.name || "");
    setAssignPriority(req.priority || "High");
    setAssignTargetDate(req.targetDate || "");
  };

  const handleSaveAssignment = async () => {
    if (!assignModalReq || !assignTech) return;
    setIsActionLoading(true);
    try {
      await onAssignRequest(assignModalReq.requestId, assignTech, assignPriority, assignTargetDate);
      setAssignModalReq(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to assign technician");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStartWorkAction = async (requestId: string) => {
    setIsActionLoading(true);
    try {
      if (onStartWork) {
        await onStartWork(requestId);
      } else {
        const res = await fetch("/api/admin/maintenance/hub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start_work", requestId }),
        });
        const d = await res.json();
        if (!res.ok || !d.success) throw new Error(d.message || "Failed to start work");
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to start work");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmHold = async () => {
    if (!holdModalReq) return;
    if (!holdReason.trim()) {
      alert("Please enter a reason for putting this request on hold.");
      return;
    }
    setIsActionLoading(true);
    try {
      if (onPutOnHold) {
        await onPutOnHold(holdModalReq.requestId, holdReason);
      } else {
        const res = await fetch("/api/admin/maintenance/hub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "put_on_hold", requestId: holdModalReq.requestId, reason: holdReason }),
        });
        const d = await res.json();
        if (!res.ok || !d.success) throw new Error(d.message || "Failed to put request on hold");
      }
      setHoldModalReq(null);
      setHoldReason("");
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to put on hold");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalReq) return;
    if (!cancelReason.trim()) {
      alert("Please enter a reason for closing/cancelling this request.");
      return;
    }
    setIsActionLoading(true);
    try {
      if (onCancelRequest) {
        await onCancelRequest(cancelModalReq.requestId, cancelReason, cancelStatus);
      } else {
        const res = await fetch("/api/admin/maintenance/hub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cancel_request",
            requestId: cancelModalReq.requestId,
            reason: cancelReason,
            status: cancelStatus,
          }),
        });
        const d = await res.json();
        if (!res.ok || !d.success) throw new Error(d.message || "Failed to cancel request");
      }
      setCancelModalReq(null);
      setCancelReason("");
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to cancel request");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    const firstMachine = machinesList[0];
    const assetId = firstMachine?.assetId || firstMachine?.["Asset ID"] || "SKY-001";
    const name = firstMachine?.name || firstMachine?.["Machine Name"] || "Machinery";
    const dept = firstMachine?.Department || firstMachine?.department || "Production";

    setNewReqAssetId(assetId);
    setNewReqMachineName(name);
    setNewReqDept(dept);
    setNewReqProblem("");
    setNewReqPriority("High");
    setNewReqTech("");
    setNewReqTargetDate("");
    setCreateModalOpen(true);
  };

  const handleMachineSelectChange = (assetId: string) => {
    setNewReqAssetId(assetId);
    const m = machinesList.find((item) => (item.assetId || item["Asset ID"]) === assetId);
    if (m) {
      setNewReqMachineName(m.name || m["Machine Name"] || assetId);
      setNewReqDept(m.Department || m.department || "Plant Operations");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReqProblem.trim()) {
      alert("Please enter the Problem / Defect Description.");
      return;
    }
    setIsActionLoading(true);
    try {
      const payload = {
        assetId: newReqAssetId,
        machineName: newReqMachineName,
        department: newReqDept,
        problem: newReqProblem,
        priority: newReqPriority,
        assignedTo: newReqTech,
        technicianName: newReqTech,
        targetDate: newReqTargetDate,
        source: "Manual Request",
      };

      if (onCreateRequest) {
        await onCreateRequest(payload);
      } else {
        const res = await fetch("/api/admin/maintenance/hub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create_request", requestData: payload }),
        });
        const d = await res.json();
        if (!res.ok || !d.success) throw new Error(d.message || "Failed to create request");
      }
      setCreateModalOpen(false);
      setActiveSection(newReqTech ? "in_progress" : "pending");
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to create request");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReopenAction = async (req: MaintenanceRequest) => {
    const reason = window.prompt(`Enter reason for reopening Maintenance Request ${req.requestId}:`);
    if (!reason || !reason.trim()) return;

    setIsActionLoading(true);
    try {
      if (onReopenRequest) {
        await onReopenRequest(req.requestId, reason.trim());
      } else {
        const res = await fetch("/api/admin/maintenance/hub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reopen_request", requestId: req.requestId, reason: reason.trim() }),
        });
        const d = await res.json();
        if (!res.ok || !d.success) throw new Error(d.message || "Failed to reopen request");
      }
      setActiveSection("in_progress");
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to reopen request");
    } finally {
      setIsActionLoading(false);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch ((p || "").toLowerCase()) {
      case "critical":
        return "bg-red-100 text-red-900 border-red-300 font-extrabold animate-pulse";
      case "high":
        return "bg-orange-100 text-orange-900 border-orange-300 font-bold";
      case "medium":
        return "bg-amber-100 text-amber-900 border-amber-300 font-semibold";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const getStatusBadge = (s: string) => {
    switch ((s || "").toLowerCase()) {
      case "open":
        return "bg-amber-50 text-amber-900 border-amber-300 font-bold";
      case "assigned":
        return "bg-blue-50 text-blue-900 border-blue-300 font-semibold";
      case "in progress":
        return "bg-indigo-50 text-indigo-900 border-indigo-300 font-bold";
      case "completed":
      case "closed":
      case "resolved":
        return "bg-emerald-50 text-emerald-900 border-emerald-300 font-bold";
      case "on hold":
        return "bg-yellow-100 text-yellow-900 border-yellow-300 font-bold";
      case "cancelled":
      case "rejected":
        return "bg-rose-50 text-rose-800 border-rose-300 font-semibold";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <div className="space-y-4">
      {/* 5-Section Navigation Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#880b13]"></span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Maintenance Request Lifecycle Workflow
            </h2>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3.5 py-1.5 rounded-xl bg-[#880b13] text-white hover:bg-[#6e090f] text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            + Raise Maintenance Request
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {/* Section 1: Pending */}
          <button
            type="button"
            onClick={() => handleSectionTabClick("pending")}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeSection === "pending"
                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping"></span>
              Pending Requests
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeSection === "pending" ? "bg-white text-amber-900" : "bg-amber-100 text-amber-900"
              }`}
            >
              {sectionCounts.pending}
            </span>
          </button>

          {/* Section 2: Assigned / In Progress */}
          <button
            type="button"
            onClick={() => handleSectionTabClick("in_progress")}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeSection === "in_progress"
                ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Assigned / In Progress</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeSection === "in_progress" ? "bg-white text-indigo-900" : "bg-indigo-100 text-indigo-900"
              }`}
            >
              {sectionCounts.inProgress}
            </span>
          </button>

          {/* Section 3: Completed Maintenance Records */}
          <button
            type="button"
            onClick={() => handleSectionTabClick("completed")}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeSection === "completed"
                ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Completed Records</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeSection === "completed" ? "bg-white text-emerald-900" : "bg-emerald-100 text-emerald-900"
              }`}
            >
              {sectionCounts.completed}
            </span>
          </button>

          {/* Section 4: On Hold */}
          <button
            type="button"
            onClick={() => handleSectionTabClick("on_hold")}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeSection === "on_hold"
                ? "bg-yellow-500 text-slate-900 border-yellow-600 shadow-xs"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>On Hold</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeSection === "on_hold" ? "bg-slate-900 text-white" : "bg-yellow-100 text-yellow-900"
              }`}
            >
              {sectionCounts.onHold}
            </span>
          </button>

          {/* Section 5: Cancelled / Rejected */}
          <button
            type="button"
            onClick={() => handleSectionTabClick("cancelled")}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeSection === "cancelled"
                ? "bg-rose-700 text-white border-rose-800 shadow-xs"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Cancelled / Rejected</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeSection === "cancelled" ? "bg-white text-rose-900" : "bg-rose-100 text-rose-900"
              }`}
            >
              {sectionCounts.cancelled}
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-600">
            Section:{" "}
            <span className="font-bold text-slate-900 capitalize">
              {activeSection.replace("_", " ")}
            </span>{" "}
            — Showing <strong>{finalFilteredRequests.length}</strong> matching records
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold cursor-pointer bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={onlyMyAllocated}
                onChange={(e) => setOnlyMyAllocated(e.target.checked)}
                className="rounded text-[#880b13] focus:ring-[#880b13]"
              />
              Assigned to Me
            </label>
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer text-xs flex items-center gap-1 font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1 text-xs">
          {/* Search Box */}
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="Search Request ID, Machine, Tech, Issue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13]"
            />
          </div>

          {/* Machine Filter */}
          <div>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13] bg-white"
            >
              <option value="All">All Machines</option>
              {uniqueMachines.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13] bg-white"
            >
              <option value="All">All Departments</option>
              {uniqueDepts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Technician Filter */}
          <div>
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13] bg-white"
            >
              <option value="All">All Technicians</option>
              {uniqueTechs.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13] bg-white"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Maintenance Type Filter */}
          <div>
            <select
              value={selectedMaintType}
              onChange={(e) => setSelectedMaintType(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13] bg-white"
            >
              <option value="All">All Types</option>
              <option value="Breakdown">Breakdown</option>
              <option value="Preventive">Preventive</option>
              <option value="Corrective">Corrective</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
        </div>

        {/* Date Range & Reset Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold text-[11px]">Date Range:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-semibold px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Request ID</th>
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Machine Name & ID</th>
                <th className="py-3 px-3">Problem Description</th>
                <th className="py-3 px-3 text-center">Priority</th>
                <th className="py-3 px-3">Requested By</th>
                <th className="py-3 px-3">Assigned Tech</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <span className="text-sm font-semibold text-slate-700">No requests found in this section.</span>
                      <span className="text-xs text-slate-400 mt-0.5">
                        {activeSection === "pending"
                          ? "All incoming requests have been assigned or resolved."
                          : activeSection === "completed"
                          ? "Completed maintenance requests will appear here after technician work completion."
                          : "Try adjusting filters or switching sections."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => (
                  <tr key={req.requestId} className="hover:bg-slate-50/60 transition-colors">
                    {/* Request ID */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailModalReq(req)}
                        className="text-[#880b13] hover:underline cursor-pointer flex items-center gap-1"
                        title="View request details and audit trail"
                      >
                        {req.requestId}
                      </button>
                      <span className="text-[10px] text-slate-400 block font-sans">
                        {req.source}
                      </span>
                    </td>

                    {/* Date and Time */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                      <div className="font-semibold text-slate-800">{req.reportedDate}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {req.reportedAt ? new Date(req.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {req.department || "Operations"}
                      </span>
                    </td>

                    {/* Machine Name & ID */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{req.machineName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{req.assetId}</div>
                    </td>

                    {/* Problem Description */}
                    <td className="py-3 px-3 max-w-xs truncate text-slate-700" title={req.problem}>
                      <span className="font-medium text-slate-800">{req.problem}</span>
                      {req.actualProblem && req.actualProblem !== req.problem && (
                        <div className="text-[10px] text-emerald-700 truncate font-semibold" title={req.actualProblem}>
                          Fixed: {req.actualProblem}
                        </div>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${getPriorityBadge(req.priority)}`}>
                        {req.priority}
                      </span>
                    </td>

                    {/* Requested By */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{req.reportedBy}</div>
                    </td>

                    {/* Assigned Technician */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {req.technicianName || req.assignedTo ? (
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {req.technicianName || req.assignedTo}
                          </span>
                          {req.assignedAt && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Assigned {req.assignedAt.slice(0, 10)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-amber-600 font-bold italic">Unassigned</span>
                      )}
                    </td>

                    {/* Request Status */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] border ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                      {/* Action buttons depending on status */}
                      {req.status === "Open" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(req)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-[11px] font-bold shadow-2xs cursor-pointer"
                            title="Assign to technician"
                          >
                            Assign Tech
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartWorkAction(req.requestId)}
                            className="px-2 py-1 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-[11px] font-semibold cursor-pointer"
                            title="Start Work directly"
                          >
                            Start Work
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHoldModalReq(req);
                              setHoldReason("");
                            }}
                            className="px-2 py-1 rounded-lg border border-yellow-300 text-yellow-800 hover:bg-yellow-50 text-[11px] font-semibold cursor-pointer"
                            title="Put on hold"
                          >
                            Hold
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalReq(req);
                              setCancelReason("");
                              setCancelStatus("Cancelled");
                            }}
                            className="px-2 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-semibold cursor-pointer"
                            title="Cancel / Reject"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {(req.status === "Assigned" || req.status === "In Progress") && (
                        <>
                          {req.status === "Assigned" && (
                            <button
                              type="button"
                              onClick={() => handleStartWorkAction(req.requestId)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-[11px] font-bold shadow-2xs cursor-pointer"
                              title="Begin maintenance work"
                            >
                              Start Work
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenWorkEntryForRequest(req)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-black shadow-2xs cursor-pointer inline-flex items-center gap-1"
                            title="Complete maintenance work and transfer to Completed Maintenance Records"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            Complete Work
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(req)}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
                            title="Reassign technician"
                          >
                            Reassign
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHoldModalReq(req);
                              setHoldReason("");
                            }}
                            className="px-2 py-1 rounded-lg border border-yellow-300 text-yellow-800 hover:bg-yellow-50 text-[11px] font-semibold cursor-pointer"
                          >
                            Hold
                          </button>
                        </>
                      )}

                      {(req.status === "Completed" || req.status === "Closed" || req.status === "Resolved") && (
                        <>
                          <button
                            type="button"
                            onClick={() => setDetailModalReq(req)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-white hover:bg-slate-900 text-[11px] font-bold cursor-pointer"
                            title="View complete record & completion details"
                          >
                            View Record
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReopenAction(req)}
                            className="px-2 py-1 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 text-[11px] font-semibold cursor-pointer"
                            title="Reopen request if work needs rework"
                          >
                            Reopen
                          </button>
                        </>
                      )}

                      {req.status === "On Hold" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartWorkAction(req.requestId)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-[11px] font-bold cursor-pointer"
                            title="Resume maintenance work"
                          >
                            Resume Work
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalReq(req);
                              setCancelReason("");
                              setCancelStatus("Cancelled");
                            }}
                            className="px-2 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {(req.status === "Cancelled" || req.status === "Rejected") && (
                        <>
                          <button
                            type="button"
                            onClick={() => setDetailModalReq(req)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
                          >
                            Reason
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReopenAction(req)}
                            className="px-2 py-1 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 text-[11px] font-semibold cursor-pointer"
                          >
                            Reopen
                          </button>
                        </>
                      )}

                      {/* Detail Icon */}
                      <button
                        type="button"
                        onClick={() => setDetailModalReq(req)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-block align-middle cursor-pointer"
                        title="Audit trail & telemetry"
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

        {/* Pagination Toolbar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-slate-200 rounded-lg bg-white"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-slate-400">|</span>
            <span>
              Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, totalItems)} of {totalItems} requests
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed font-semibold"
            >
              &larr; Previous
            </button>
            <span className="px-2.5 font-bold text-slate-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed font-semibold"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Raise Maintenance Request */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#880b13]">
                  New Work Order Ticket
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Raise Maintenance Request
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Machine Asset *
                </label>
                <select
                  required
                  value={newReqAssetId}
                  onChange={(e) => handleMachineSelectChange(e.target.value)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Machine Name
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={newReqMachineName}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    value={newReqDept}
                    onChange={(e) => setNewReqDept(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Problem Description *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the malfunction, abnormal sound, breakdown stoppage, or defect..."
                  value={newReqProblem}
                  onChange={(e) => setNewReqProblem(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Priority *
                  </label>
                  <select
                    value={newReqPriority}
                    onChange={(e) => setNewReqPriority(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="Critical">Critical (Immediate Line Stoppage)</option>
                    <option value="High">High (Impacting Quality/Speed)</option>
                    <option value="Medium">Medium (Attention Needed)</option>
                    <option value="Low">Low (Minor Non-Critical)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Assign Technician (Optional)
                  </label>
                  <select
                    value={newReqTech}
                    onChange={(e) => setNewReqTech(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Leave Unassigned (Pending) --</option>
                    {technicians.map((t) => (
                      <option key={t.userId} value={t.name}>
                        {t.name} ({t.availability})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Target Completion Date (Optional)
                </label>
                <input
                  type="date"
                  value={newReqTargetDate}
                  onChange={(e) => setNewReqTargetDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-[#880b13] text-white hover:bg-[#6e090f] disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isActionLoading ? "Submitting..." : "Submit Maintenance Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Technician */}
      {assignModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Technician Allocation</span>
                <h4 className="text-sm font-bold text-slate-900">
                  Assign Request: {assignModalReq.requestId}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalReq(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900">{assignModalReq.machineName}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{assignModalReq.problem}</div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Select Maintenance Technician *
                </label>
                <select
                  value={assignTech}
                  onChange={(e) => setAssignTech(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20 focus:border-[#880b13] bg-white font-medium"
                >
                  <option value="">-- Choose Assigned Technician --</option>
                  {technicians.map((t) => (
                    <option key={t.userId} value={t.name}>
                      {t.name} ({t.role}) — {t.availability} ({t.activeWorkOrdersCount} active)
                    </option>
                  ))}
                  <option value="External Service Team">External Service Team</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Priority Level
                  </label>
                  <select
                    value={assignPriority}
                    onChange={(e) => setAssignPriority(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={assignTargetDate}
                    onChange={(e) => setAssignTargetDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAssignModalReq(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!assignTech || isActionLoading}
                onClick={handleSaveAssignment}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isActionLoading ? "Assigning..." : "Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Put Request on Hold */}
      {holdModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">
                Put Request On Hold: {holdModalReq.requestId}
              </h4>
              <button
                type="button"
                onClick={() => setHoldModalReq(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Please specify the reason why maintenance work on <strong>{holdModalReq.machineName}</strong> is being temporarily suspended.
              </p>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Reason for Hold *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Waiting for spare parts delivery from supplier, production schedule conflict..."
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setHoldModalReq(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionLoading || !holdReason.trim()}
                onClick={handleConfirmHold}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-yellow-500 text-slate-900 hover:bg-yellow-600 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isActionLoading ? "Updating..." : "Put On Hold"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancel / Reject Request */}
      {cancelModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">
                Close / Cancel Request: {cancelModalReq.requestId}
              </h4>
              <button
                type="button"
                onClick={() => setCancelModalReq(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Closure Action *
                </label>
                <select
                  value={cancelStatus}
                  onChange={(e) => setCancelStatus(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                >
                  <option value="Cancelled">Cancelled (Not Required / Duplicate)</option>
                  <option value="Rejected">Rejected (Unauthorized / False Alarm)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Recorded Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Record why this request is being closed without executing repair work..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelModalReq(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isActionLoading || !cancelReason.trim()}
                onClick={handleConfirmCancel}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isActionLoading ? "Closing..." : "Confirm Closure"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Details & Full Audit Trail */}
      {detailModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(detailModalReq.status)}`}>
                    {detailModalReq.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityBadge(detailModalReq.priority)}`}>
                    {detailModalReq.priority}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {detailModalReq.requestId} — {detailModalReq.machineName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalReq(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] block">Machine ID</span>
                  <span className="font-mono font-bold text-slate-900">{detailModalReq.assetId}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Department</span>
                  <span className="font-bold text-slate-900">{detailModalReq.department || "Operations"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Reported By</span>
                  <span className="font-bold text-slate-900">{detailModalReq.reportedBy}</span>
                  <div className="text-[10px] text-slate-500">{detailModalReq.reportedDate}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Assigned Tech</span>
                  <span className="font-bold text-slate-900">
                    {detailModalReq.technicianName || detailModalReq.assignedTo || "Unassigned"}
                  </span>
                </div>
              </div>

              {/* Problem Description */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  Initial Reported Problem
                </span>
                <p className="text-slate-800 font-medium">{detailModalReq.problem}</p>
                {detailModalReq.failedPoint && (
                  <p className="text-red-700 text-[11px] font-semibold mt-1">
                    Failed Checkpoint: {detailModalReq.failedPoint}
                  </p>
                )}
              </div>

              {/* Completion Information if Completed */}
              {(detailModalReq.status === "Completed" || detailModalReq.status === "Closed" || detailModalReq.status === "Resolved") && (
                <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-2.5">
                  <div className="font-bold text-emerald-950 uppercase text-[11px] tracking-wider flex items-center justify-between">
                    <span>Work Completion Record</span>
                    <span className="text-emerald-800 font-mono">
                      Duration: {detailModalReq.breakdownDurationHours || 0} hrs
                    </span>
                  </div>

                  {detailModalReq.actualProblem && (
                    <div>
                      <span className="text-emerald-900 font-bold block text-[11px]">Actual Fault Found:</span>
                      <p className="text-slate-800">{detailModalReq.actualProblem}</p>
                    </div>
                  )}

                  {detailModalReq.rootCause && (
                    <div>
                      <span className="text-emerald-900 font-bold block text-[11px]">Root Cause:</span>
                      <p className="text-slate-800">{detailModalReq.rootCause}</p>
                    </div>
                  )}

                  {detailModalReq.maintenanceWorkPerformed && (
                    <div>
                      <span className="text-emerald-900 font-bold block text-[11px]">Maintenance Work Performed:</span>
                      <p className="text-slate-800">{detailModalReq.maintenanceWorkPerformed}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-emerald-200/60">
                    <div>
                      <span className="text-emerald-900 font-bold block text-[11px]">Spare Parts Consumed:</span>
                      <p className="text-slate-800">
                        {detailModalReq.sparePartsUsed || "None"}
                        {detailModalReq.sparePartsQuantity ? ` (${detailModalReq.sparePartsQuantity} units)` : ""}
                      </p>
                    </div>
                    <div>
                      <span className="text-emerald-900 font-bold block text-[11px]">Completed At & By:</span>
                      <p className="text-slate-800">
                        {detailModalReq.completedAt ? detailModalReq.completedAt.replace("T", " ").slice(0, 16) : detailModalReq.reportedDate} by{" "}
                        <span className="font-bold">{detailModalReq.completedBy || detailModalReq.technicianName}</span>
                      </p>
                    </div>
                  </div>

                  {detailModalReq.remarks && (
                    <div className="pt-1">
                      <span className="text-emerald-900 font-bold block text-[11px]">Remarks:</span>
                      <p className="text-slate-700 italic">{detailModalReq.remarks}</p>
                    </div>
                  )}
                </div>
              )}

              {/* On Hold / Cancellation notes */}
              {detailModalReq.status === "On Hold" && detailModalReq.onHoldReason && (
                <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                  <span className="font-bold text-yellow-900 block text-[11px]">Reason for Hold:</span>
                  <p className="text-yellow-950">{detailModalReq.onHoldReason}</p>
                </div>
              )}

              {(detailModalReq.status === "Cancelled" || detailModalReq.status === "Rejected") && detailModalReq.cancelledReason && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="font-bold text-rose-900 block text-[11px]">Reason for {detailModalReq.status}:</span>
                  <p className="text-rose-950">{detailModalReq.cancelledReason}</p>
                </div>
              )}

              {/* Audit Trail Timeline */}
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-2">
                  Traceability & Audit Trail Timeline
                </span>
                {(!detailModalReq.auditTrail || detailModalReq.auditTrail.length === 0) ? (
                  <div className="text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    Created on {detailModalReq.createdAt?.slice(0, 10) || detailModalReq.reportedDate} by {detailModalReq.reportedBy}
                  </div>
                ) : (
                  <div className="space-y-2 border-l-2 border-slate-200 pl-3 ml-2">
                    {detailModalReq.auditTrail.map((item, idx) => (
                      <div key={idx} className="relative pb-1">
                        <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-[#880b13] border-2 border-white"></div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.action} {item.newStatus ? `-> ${item.newStatus}` : ""}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {item.timestamp ? item.timestamp.replace("T", " ").slice(0, 16) : "-"}
                          </span>
                        </div>
                        <div className="text-slate-600 text-[11px]">
                          Performed by: <strong className="text-slate-800">{item.performedBy}</strong>
                        </div>
                        {item.remarks && (
                          <div className="text-slate-500 text-[11px] italic mt-0.5">
                            "{item.remarks}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              {detailModalReq.status !== "Completed" && (
                <button
                  type="button"
                  onClick={() => {
                    const req = detailModalReq;
                    setDetailModalReq(null);
                    onOpenWorkEntryForRequest(req);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 cursor-pointer text-xs shadow-xs"
                >
                  Complete This Request &rarr;
                </button>
              )}
              {detailModalReq.status === "Completed" && (
                <button
                  type="button"
                  onClick={() => {
                    const req = detailModalReq;
                    setDetailModalReq(null);
                    handleReopenAction(req);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-amber-300 text-amber-800 font-bold hover:bg-amber-50 cursor-pointer text-xs"
                >
                  Reopen Request
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailModalReq(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
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
