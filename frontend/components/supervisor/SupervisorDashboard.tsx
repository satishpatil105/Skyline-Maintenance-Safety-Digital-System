"use client";

import React, { useState } from "react";
import Link from "next/link";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";
import AlertsPanel from "./AlertsPanel";
import SupervisorAlertsModule from "./SupervisorAlertsModule";
import SupervisorSidebar, { SUPERVISOR_TABS } from "./SupervisorSidebar";
import SupervisorHeader from "./SupervisorHeader";
import GenericMasterTable from "../admin/GenericMasterTable";
import MaintenanceRecordsTable from "../admin/MaintenanceRecordsTable";
import ChecklistMasterTable from "../admin/ChecklistMasterTable";
import ChecklistRecordsTable from "../admin/ChecklistRecordsTable";
import PMPartsAMCTable from "../admin/PMPartsAMCTable";
import AdminRecordModal from "../admin/AdminRecordModal";
import MachineQrModal from "../admin/MachineQrModal";
import DeleteConfirmModal from "../admin/DeleteConfirmModal";
import AssetMasterTable from "../admin/AssetMasterTable";
import type { SessionUser } from "@/lib/auth";
import type { Row } from "../admin/UserMasterTable";

interface SupervisorDashboardProps {
  initialTab?: string;
  user: SessionUser;
  notificationData?: any;
  stats?: {
    totalMachines: number;
    openMaintenance: number;
    openSafety: number;
    completedTodayChecklists: number;
    highRiskIncidents: number;
  };
  safetyOverview?: Array<{
    id: string;
    label: string;
    blurb: string;
    total: number;
    open: number;
    overdue: number;
    highRisk: number;
  }>;
  recentMaintenance?: Array<{
    recordId: string;
    machineName: string;
    assetId: string;
    userId?: string;
    userName?: string;
    checklistId?: string;
    problem: string;
    priority: string;
    status: string;
    date: string;
    assignedTo: string;
    actionTaken?: string;
    completionDate?: string;
  }>;
  recentSafety?: Array<{
    recordId: string;
    machineName: string;
    assetId: string;
    safetyType: string;
    riskLevel: string;
    status: string;
    date: string;
    immediateAction: string;
  }>;
  checklists?: Array<Record<string, string>>;
  pmParts?: Array<Record<string, string>>;
  documents?: Array<Record<string, string>>;
  notifications?: Array<Record<string, string>>;
  allMachines?: Row[];
  allAssets?: Row[];
  allUsers?: Row[];
}

export function normalizeSupervisorTab(tabKey?: string): string {
  if (!tabKey) return "overview";
  const l = tabKey.toLowerCase().trim();
  if (l === "overview" || l.includes("dash") || l.includes("9.")) return "overview";
  if (l.includes("asset") || l.includes("machine")) return "assets";
  if (l.includes("maint") || l.includes("4.")) return "maintenance";
  if (l.includes("safety") || l.includes("5.")) return "safety";
  if (l.includes("checklist_record") || l.includes("checklist-record") || l.includes("checklist record") || l.includes("checklist_log")) return "checklist_records";
  if (l.includes("check") || l.includes("2.")) return "checklist";
  if (l.includes("part") || l.includes("amc") || l.includes("6.")) return "parts";
  if (l.includes("doc") || l.includes("register") || l.includes("7.")) return "documents";
  if (l.includes("alert") || l.includes("notif") || l.includes("8.")) return "alerts";
  return "overview";
}

const TAB_SLUGS: Record<string, string> = {
  overview: "dashboard",
  assets: "asset-master",
  maintenance: "maintenance-records",
  checklist_records: "checklist-records",
  safety: "safety-records",
  checklist: "checklist-master",
  parts: "pm-parts-amc",
  documents: "document-register",
  alerts: "notifications",
};

export default function SupervisorDashboard({
  initialTab = "overview",
  user,
  stats = {
    totalMachines: 33,
    openMaintenance: 2,
    openSafety: 3,
    completedTodayChecklists: 0,
    highRiskIncidents: 2,
  },
  safetyOverview = [],
  recentMaintenance = [],
  recentSafety = [],
  checklists = [],
  pmParts = [],
  documents = [],
  notifications = [],
  allMachines = [],
  allAssets = [],
  allUsers = [],
  notificationData = null,
}: SupervisorDashboardProps) {
  const [activeTab, setActiveTab] = useState<string>(() => normalizeSupervisorTab(initialTab));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Local record collections for immediate UI updates & CRUD
  const [localAssets, setLocalAssets] = useState<Row[]>(allAssets || []);
  const [localMaintenance, setLocalMaintenance] = useState(recentMaintenance);
  const [localSafety, setLocalSafety] = useState(recentSafety);
  const [localChecklists, setLocalChecklists] = useState(checklists);
  const [localPMParts, setLocalPMParts] = useState(pmParts);
  const [localDocuments, setLocalDocuments] = useState(documents);
  const [localNotifications, setLocalNotifications] = useState(notifications);
  const [localChecklistRecords, setLocalChecklistRecords] = useState<Row[]>([]);

  // Computed alert badges for notification bell and alert strips
  const dueCount = React.useMemo(() => {
    if (notificationData?.counts?.due !== undefined) return notificationData.counts.due;
    return (localNotifications || []).filter((n: any) => (n.daysLeft !== null && n.daysLeft <= 0) || n.categoryType === "due" || /overdue|due/i.test(n.status || n["Status"] || "")).length;
  }, [notificationData, localNotifications]);

  const pendingCount = React.useMemo(() => {
    if (notificationData?.counts?.pending !== undefined) return notificationData.counts.pending;
    return (localNotifications || []).filter((n: any) => n.categoryType === "pending" || /breakdown|defect|pending|open|progress|not ok/i.test(n.status || n["Status"] || n["Severity"] || "")).length;
  }, [notificationData, localNotifications]);

  // Fetch checklist inspection records when tab is checklist_records
  React.useEffect(() => {
    if (activeTab === "checklist_records" || activeTab.includes("checklist")) {
      fetch("/api/checklist/records")
        .then((r) => r.json())
        .then((data) => {
          if (data.records && Array.isArray(data.records)) {
            const formatted = data.records.map((r: any, idx: number) => ({
              __row: String(idx + 2),
              "Record ID": r.recordId || "",
              "Date": r.date || "",
              "Machine / Asset": `${r.machineName || ""} (${r.assetId || ""})`,
              "Check Point": r.checkPoint || "",
              "Frequency": r.frequency || "Daily",
              "Response / Status": r.status || r.response || "OK",
              "Remarks": r.remarks || "",
              "Action if Not OK": r.actionIfNotOk || "",
              "Operator": r.operator || r.userName || "",
              "Maintenance Ticket": r.maintenanceTicketId || "-",
              "Photo Evidence": r.photoEvidence || "",
            }));
            setLocalChecklistRecords(formatted);
          }
        })
        .catch(console.error);
    }
  }, [activeTab]);

  // Sync state if initialTab prop changes
  React.useEffect(() => {
    setActiveTab(normalizeSupervisorTab(initialTab));
  }, [initialTab]);

  // Sync state when props update from server hydration
  React.useEffect(() => {
    if (allMachines?.length) setLocalAssets(allMachines);
    if (recentMaintenance?.length) setLocalMaintenance(recentMaintenance);
    if (recentSafety?.length) setLocalSafety(recentSafety);
    if (checklists?.length) setLocalChecklists(checklists);
    if (pmParts?.length) setLocalPMParts(pmParts);
    if (documents?.length) setLocalDocuments(documents);
    if (notifications?.length) setLocalNotifications(notifications);
  }, [allMachines, recentMaintenance, recentSafety, checklists, pmParts, documents, notifications]);

  // Sync state with popstate event for back/forward navigation
  React.useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(normalizeSupervisorTab(event.state.tab));
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    const slug = TAB_SLUGS[key] || "dashboard";
    if (typeof window !== "undefined") {
      window.history.pushState({ tab: key }, "", `/supervisor/${slug}`);
    }
  };

  // Modals
  const [editor, setEditor] = useState<{ row: Row; isNew: boolean } | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [deleteModalRow, setDeleteModalRow] = useState<Row | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status Banner Feedback State
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: StatusType } | null>(null);

  const showStatus = (text: string, type: StatusType = "info") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleCreateNew = () => {
    setEditor({ row: {} as Row, isNew: true });
  };

  const handleEditRow = (row: Row) => {
    setEditor({ row: { ...row }, isNew: false });
  };

  const handleDeleteRow = (row: Row) => {
    setDeleteModalRow(row);
  };

  const handleSaveRow = async (savedRow: Row) => {
    try {
      const isNew = editor?.isNew ?? false;
      showStatus("Saving record...", "info");

      const res = await fetch("/api/supervisor/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: activeTab,
          row: savedRow,
          isNew,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to save record");
      }

      // Update local state dynamically
      if (activeTab === "assets") {
        const assetId = savedRow["Asset ID"] || savedRow["assetId"] || `AST-${Date.now().toString().slice(-4)}`;
        const astRow: Row = {
          ...savedRow,
          "Asset ID": assetId,
          "Machine Name": savedRow["Machine Name"] || savedRow["Asset Name"] || "Industrial Asset",
          "Category": savedRow["Category"] || "General Equipment",
          "Status": savedRow["Status"] || "Operational",
        };
        setLocalAssets((prev) =>
          isNew ? [astRow, ...prev] : prev.map((item) => ((item["Asset ID"] || item["assetId"]) === assetId ? astRow : item))
        );
      } else if (activeTab === "maintenance") {
        const mRow = {
          recordId: savedRow.recordId || savedRow["Record ID"] || savedRow["Maintenance ID"] || `MNT-2026-${Date.now().toString().slice(-4)}`,
          date: savedRow.date || savedRow["Date"] || new Date().toISOString().split("T")[0],
          assetId: savedRow.assetId || savedRow["Asset ID"] || "SKY-001",
          machineName: savedRow.machineName || savedRow["Machine Name"] || savedRow["Machine / Asset"] || "Machine",
          userId: savedRow.userId || savedRow["User ID"] || "",
          userName: savedRow.userName || savedRow["User Name"] || savedRow.submittedBy || "",
          checklistId: savedRow.checklistId || savedRow["Checklist ID"] || "",
          problem: savedRow.problem || savedRow["Problem / Breakdown"] || savedRow["Problem"] || savedRow["Issue"] || "Routine Inspection",
          priority: savedRow.priority || savedRow["Priority"] || "Medium",
          assignedTo: savedRow.assignedTo || savedRow["Assigned To"] || savedRow.technicianName || "Unassigned",
          actionTaken: savedRow.actionTaken || savedRow["Action Taken"] || savedRow.correctiveAction || "",
          status: savedRow.status || savedRow["Status"] || "Open",
          completionDate: savedRow.completionDate || savedRow["Completion Date"] || "",
        };
        setLocalMaintenance((prev) => (isNew ? [mRow, ...prev] : prev.map((item) => (item.recordId === mRow.recordId ? mRow : item))));
      } else if (activeTab === "safety") {
        const sRow = {
          recordId: savedRow.recordId || savedRow["Record ID"] || `SAF-2026-${Date.now().toString().slice(-4)}`,
          machineName: savedRow["Machine / Location"] || savedRow.machineName || "Plant Floor",
          assetId: savedRow.assetId || "SKY-001",
          safetyType: savedRow.safetyType || savedRow["Safety Type"] || "Safety Audit",
          riskLevel: savedRow.riskLevel || savedRow["Risk Level"] || "Normal",
          status: savedRow.status || savedRow["Status"] || "Open",
          date: savedRow.date || savedRow["Date"] || "2026-10-09",
          immediateAction: savedRow.immediateAction || savedRow["Immediate Action Taken"] || "Inspected",
        };
        setLocalSafety((prev) => (isNew ? [sRow, ...prev] : prev.map((item) => (item.recordId === sRow.recordId ? sRow : item))));
      } else if (activeTab === "checklist") {
        setLocalChecklists((prev) => (isNew ? [savedRow as any, ...prev] : prev.map((item) => ((item["Asset ID / Machine"] || item["Check Point"]) === (savedRow["Asset ID / Machine"] || savedRow["Check Point"]) ? (savedRow as any) : item))));
      } else if (activeTab === "parts") {
        setLocalPMParts((prev) => (isNew ? [savedRow as any, ...prev] : prev.map((item) => ((item["Part Name / Code"] || item["partId"]) === (savedRow["Part Name / Code"] || savedRow["partId"]) ? (savedRow as any) : item))));
      } else if (activeTab === "documents") {
        setLocalDocuments((prev) => (isNew ? [savedRow as any, ...prev] : prev.map((item) => ((item["Doc ID"] || item["Document Title"]) === (savedRow["Doc ID"] || savedRow["Document Title"]) ? (savedRow as any) : item))));
      } else if (activeTab === "alerts") {
        setLocalNotifications((prev) => (isNew ? [savedRow as any, ...prev] : prev.map((item) => ((item["Alert ID"] || item["Alert Title"]) === (savedRow["Alert ID"] || savedRow["Alert Title"]) ? (savedRow as any) : item))));
      }

      showStatus(`Successfully ${isNew ? "added" : "updated"} record`, "success");
      setEditor(null);
    } catch (err: any) {
      console.error("Save error:", err);
      showStatus(err.message || "Failed to save record", "error");
    }
  };

  const handleConfirmDelete = async (rowToDelete: Row) => {
    setIsDeleting(true);
    showStatus("Processing deletion request...", "info");
    try {
      const id =
        rowToDelete.recordId ||
        rowToDelete["Record ID"] ||
        rowToDelete["Asset ID / Machine"] ||
        rowToDelete["Part Name / Code"] ||
        rowToDelete["Doc ID"] ||
        rowToDelete["Document Title"] ||
        rowToDelete["Alert ID"] ||
        rowToDelete["Alert Title"] ||
        rowToDelete.__id;

      const res = await fetch(`/api/supervisor/records?tab=${encodeURIComponent(activeTab)}&id=${encodeURIComponent(String(id))}`, {
        method: "DELETE",
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to delete record");
      }

      if (activeTab === "assets") {
        setLocalAssets((prev) => prev.filter((a) => (a["Asset ID"] || a["assetId"] || a["Machine ID"]) !== id));
      } else if (activeTab === "maintenance") {
        setLocalMaintenance((prev) => prev.filter((m) => m.recordId !== id && (m as any)["Record ID"] !== id));
      } else if (activeTab === "safety") {
        setLocalSafety((prev) => prev.filter((s) => s.recordId !== id && (s as any)["Record ID"] !== id));
      } else if (activeTab === "checklist") {
        setLocalChecklists((prev) => prev.filter((c) => (c["Asset ID / Machine"] || c["Check Point"]) !== id));
      } else if (activeTab === "parts") {
        setLocalPMParts((prev) => prev.filter((p) => (p["Part Name / Code"] || p["partId"]) !== id));
      } else if (activeTab === "documents") {
        setLocalDocuments((prev) => prev.filter((d) => (d["Doc ID"] || d["Document Title"]) !== id));
      } else if (activeTab === "alerts") {
        setLocalNotifications((prev) => prev.filter((n) => (n["Alert ID"] || n["Alert Title"]) !== id));
      }

      showStatus("Record deleted successfully.", "success");
      setDeleteModalRow(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      showStatus(err.message || "Failed to delete record", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStatusCell = (colKey: string, val: string) => {
    const l = (val || "").toLowerCase();
    if (/^(yes|active|running|completed|ok|resolved|open|active)$/i.test(l)) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {val}
        </span>
      );
    }
    if (/^(no|inactive|stopped|failed|not ok|critical|closed)$/i.test(l)) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
          {val}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200">
        {val}
      </span>
    );
  };

  const formattedMaintenanceRows = (localMaintenance || []).map((m: any) => ({
    "Record ID": m.recordId || m["Record ID"] || m["Maintenance ID"] || "",
    "Maintenance ID": m.recordId || m["Record ID"] || m["Maintenance ID"] || "",
    recordId: m.recordId || m["Record ID"] || m["Maintenance ID"] || "",
    date: m.date || m["Date"] || "",
    "Date": m.date || m["Date"] || "",
    assetId: m.assetId || m["Asset ID"] || "",
    "Asset ID": m.assetId || m["Asset ID"] || "",
    machineName: m.machineName || m["Machine Name"] || "",
    "Machine Name": m.machineName || m["Machine Name"] || "",
    "Machine / Asset": `${m.machineName || ""} (${m.assetId || ""})`,
    userId: m.userId || m["User ID"] || "",
    "User ID": m.userId || m["User ID"] || "",
    userName: m.userName || m["User Name"] || m.submittedBy || "",
    "User Name": m.userName || m["User Name"] || m.submittedBy || "",
    checklistId: m.checklistId || m["Checklist ID"] || "",
    "Checklist ID": m.checklistId || m["Checklist ID"] || "",
    problem: m.problem || m["Problem / Breakdown"] || m["Problem"] || m["Issue"] || "",
    "Problem / Breakdown": m.problem || m["Problem / Breakdown"] || m["Problem"] || m["Issue"] || "",
    priority: m.priority || m["Priority"] || "Medium",
    "Priority": m.priority || m["Priority"] || "Medium",
    assignedTo: m.assignedTo || m["Assigned To"] || m.technicianName || "",
    "Assigned To": m.assignedTo || m["Assigned To"] || m.technicianName || "",
    actionTaken: m.actionTaken || m["Action Taken"] || m.correctiveAction || m["Corrective Action"] || "",
    "Action Taken": m.actionTaken || m["Action Taken"] || m.correctiveAction || m["Corrective Action"] || "",
    correctiveAction: m.actionTaken || m["Action Taken"] || m.correctiveAction || m["Corrective Action"] || "",
    status: m.status || m["Status"] || "Open",
    "Status": m.status || m["Status"] || "Open",
    completionDate: m.completionDate || m["Completion Date"] || "",
    "Completion Date": m.completionDate || m["Completion Date"] || "",
    __id: m.recordId || m["Record ID"] || "",
  })) as unknown as Row[];

  const formattedSafetyRows = (localSafety || []).map((s) => ({
    "Record ID": s.recordId,
    "Safety Type": s.safetyType,
    "Machine / Location": `${s.machineName} (${s.assetId})`,
    "Risk Level": s.riskLevel || "Medium Risk",
    "Action / Recommendation": s.immediateAction || "Under Review",
    "Status": s.status || "Open",
    "Date": s.date || "Today",
    __id: s.recordId,
    recordId: s.recordId,
    machineName: s.machineName,
    assetId: s.assetId,
    safetyType: s.safetyType,
    riskLevel: s.riskLevel,
    immediateAction: s.immediateAction,
    status: s.status,
    date: s.date,
  })) as unknown as Row[];

  const formattedChecklistRows = (localChecklists || []).map((c, i) => ({
    "Asset ID": c["Asset ID"] || c["Asset ID / Machine"] || c["Machine / Asset"] || c["Machine"] || c["assetId"] || `CHK-${i + 1}`,
    "Asset ID / Machine": c["Asset ID"] || c["Asset ID / Machine"] || c["Machine / Asset"] || c["Machine"] || c["assetId"] || `CHK-${i + 1}`,
    "Category": c["Category"] || c["category"] || "General",
    "Check Point": c["Check Point / Task"] || c["Check Point"] || c["checkPoint"] || c["Task"] || "Shift Verification",
    "Standard Requirement": c["Standard Requirement"] || c["Standard / Requirement"] || c["Standard Parameter"] || "Visual / Normal",
    "Frequency": c["Frequency"] || c["frequency"] || "Daily",
    "Response": c["Response"] || c["response"] || "OK / Not OK / NA",
    "Required Photo": c["Required Photo"] || c["requiredPhoto"] || "No",
    "If Not OK Action": c["If Not OK Action"] || c["IF Not ok Action"] || "Report to Maintenance",
    "Active": c["Active"] || c["Status"] || "Yes",
    "Status": c["Active"] || c["Status"] || "Active",
    __id: String(i + 1),
    ...c,
  })) as unknown as Row[];

  const formattedPMPartsRows = (localPMParts || []).map((p, i) => ({
    "Item / Part ID": p["Part ID"] || p["Item / Part ID"] || p["Part Name / Code"] || p["partId"] || `PRT-${i + 1}`,
    "Part Name": p["Part Name"] || p["Part Name / Code"] || p["partName"] || "Spare Part",
    "Machine / Asset": p["Machine Model"] || p["Machine / Asset"] || p["Machine / Category"] || p["Machine"] || "General",
    "Vendor / AMC": p["Supplier Name"] || p["Vendor / AMC"] || p["AMC Provider"] || p["vendor"] || "Internal",
    "Quantity": p["Stock Quantity"] || p["Quantity"] || p["Stock / Condition"] || p["stock"] || "1",
    "Expiry / Due Date": p["AMC Expiry"] || p["Expiry / Due Date"] || p["dueDate"] || "N/A",
    __id: String(i + 1),
  })) as unknown as Row[];

  const formattedDocumentRows = (localDocuments || []).map((d, i) => ({
    "Doc ID": d["Doc ID"] || d["Document ID"] || `DOC-2026-${String(i + 1).padStart(3, "0")}`,
    "Document Title": d["Document Title"] || d["title"] || `SOP-${i + 1}`,
    "Category": d["Category"] || d["category"] || "Standard",
    "Machine / Department": d["Machine / Department"] || d["department"] || "Plant Operations",
    "Revision Date": d["Revision Date"] || d["date"] || "N/A",
    __id: String(i + 1),
  })) as unknown as Row[];

  const formattedNotificationRows = (localNotifications || []).map((n, i) => ({
    "Alert ID": n["Alert ID"] || n["alertId"] || `ALT-2026-${String(i + 1).padStart(3, "0")}`,
    "Alert Title": n["Alert Title"] || n["title"] || "System Alert Notice",
    "Severity": n["Severity"] || n["severity"] || "Warning",
    "Source / Machine": n["Source / Machine"] || n["machineName"] || n["source"] || "Plant System",
    "Date & Time": n["Date & Time"] || n["timestamp"] || n["date"] || "Today",
    __id: String(i + 1),
  })) as unknown as Row[];

  // Combined Shop Floor Stream
  const activityLogs = [
    ...(recentSafety || []).map((s) => ({
      id: s.recordId,
      icon: "🛡️",
      title: `Safety Audit: ${s.machineName || s.assetId}`,
      subtitle: s.immediateAction || "Condition Inspected",
      author: "Inspector",
      date: s.date || "Today",
      badge: s.riskLevel || "High",
      isCritical: (s.riskLevel || "").toLowerCase().includes("high") || (s.riskLevel || "").toLowerCase().includes("critical"),
    })),
    ...(recentMaintenance || []).map((m) => ({
      id: m.recordId,
      icon: "🛠️",
      title: `${m.assetId || m.machineName} · ${m.problem || "Maintenance Inspection"}`,
      subtitle: m.problem || "Preventive Maintenance completed",
      author: m.assignedTo || "Operator",
      date: m.date || "Today",
      badge: m.status || "Pending",
      isCritical: false,
    })),
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans antialiased">
      {/* LEFT SIDEBAR WITH ADMIN UI LOOK */}
      <SupervisorSidebar
        tabs={SUPERVISOR_TABS}
        activeTab={activeTab}
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        onSelectTab={(tab) => handleTabChange(tab)}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />

      {/* RIGHT CONTENT AREA */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"
          }`}
      >
        {/* TOP HEADER WITH BREADCRUMB & QR SCAN / ADD RECORD BUTTONS */}
        <SupervisorHeader
          activeTab={activeTab}
          sidebarCollapsed={sidebarCollapsed}
          mobileMenuOpen={mobileMenuOpen}
          dueAlertsCount={dueCount}
          pendingAlertsCount={pendingCount}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          onOpenQrModal={() => setQrModalOpen(true)}
          onOpenCreateModal={handleCreateNew}
          onNavigateToAlerts={() => setActiveTab("alerts")}
        />

        {statusMsg && (
          <div className="p-4 pb-0">
            <StatusBanner message={statusMsg.text} type={statusMsg.type} />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: OVERVIEW DASHBOARD - STREAMLINED CORE SUPERVISOR OPERATIONAL INFO */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* 1. SUPERVISOR WELCOME STRIP */}
              <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-[#880b13] to-slate-900 text-white p-5 shadow-sm flex items-center justify-between border border-slate-800">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-black uppercase text-rose-200">
                      Shift 1 Supervisor Hub
                    </span>
                    <span className="text-xs text-slate-300 font-bold">Plant Operations</span>
                  </div>
                  <h2 className="text-xl font-black text-white">
                    Welcome, {user?.name || "Supervisor"} 🦺
                  </h2>
                </div>
              </div>

              {/* URGENT NOTIFICATIONS & ALERTS STRIP */}
              {(dueCount > 0 || pendingCount > 0) && (
                <div
                  onClick={() => setActiveTab("alerts")}
                  className="p-4 rounded-2xl bg-gradient-to-r from-rose-950 via-[#880b13] to-slate-900 text-white border border-rose-500/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-white/10 shrink-0">⚠️</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-rose-200">
                          Plant Floor Attention Required
                        </span>
                        {dueCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-black animate-pulse">
                            {dueCount} Due / Overdue
                          </span>
                        )}
                        {pendingCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-black">
                            {pendingCount} Pending Action
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-rose-100/90 font-medium mt-0.5">
                        Overdue PM inspections, machine defects, or breakdown tickets require supervisor action.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-black text-rose-100 group-hover:translate-x-1 transition-transform shrink-0">
                    <span>Open Alerts Center</span>
                    <span>→</span>
                  </div>
                </div>
              )}

              {/* 2. CORE SUPERVISOR METRICS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="relative overflow-hidden rounded-2xl bg-white p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                  <span className="text-[10px] font-extrabold uppercase text-slate-400">Active Machines</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-slate-900">{stats.totalMachines}</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {stats.totalMachines}/{stats.totalMachines} Online
                    </span>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white p-4 border border-amber-200/90 bg-amber-50/20 shadow-2xs flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
                  <span className="text-[10px] font-extrabold uppercase text-amber-700">Open Breakdowns</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-amber-950">{stats.openMaintenance}</span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                      Work Orders
                    </span>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white p-4 border border-rose-200/90 bg-rose-50/20 shadow-2xs flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-rose-600" />
                  <span className="text-[10px] font-extrabold uppercase text-rose-700">Open Hazards</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-rose-950">{stats.openSafety}</span>
                    <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300">
                      {stats.highRiskIncidents} High Risk
                    </span>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white p-4 border border-indigo-200/90 bg-indigo-50/20 shadow-2xs flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
                  <span className="text-[10px] font-extrabold uppercase text-indigo-700">Checklists Today</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-indigo-950">{stats.completedTodayChecklists}</span>
                    <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-300">
                      Shift 1
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. QUICK ACTION PORTALS */}
              <div className="grid sm:grid-cols-3 gap-4">
                <Link
                  href="/supervisor/safety/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl bg-gradient-to-br from-rose-800 via-[#880b13] to-slate-900 text-white shadow-sm hover:shadow-md transition-all group border border-rose-700/50"
                >

                  <div className="flex items-center justify-between">
                    <span className="text-xl p-2 rounded-xl bg-white/10">🦺</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/20 text-rose-100">Safety Hub</span>
                  </div>
                  <h3 className="text-sm font-black mt-3 group-hover:translate-x-1 transition-transform flex items-center gap-1.5">
                    <span>Safety Department Hub</span>
                    <span className="text-xs">↗</span>
                  </h3>
                  <p className="text-[11px] text-rose-100/80 mt-0.5 leading-tight font-medium">
                    PPE distribution, incident logs, &amp; fire safety.
                  </p>
                </Link>


                <Link
                  href="/checklist"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl bg-gradient-to-br from-indigo-800 via-indigo-950 to-slate-900 text-white shadow-sm hover:shadow-md transition-all group border border-indigo-700/50"
                  title="Open Digital Checklists in a new tab"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl p-2 rounded-xl bg-white/10">📋</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/20 text-indigo-100">Checklists</span>
                  </div>
                  <h3 className="text-sm font-black mt-3 group-hover:translate-x-1 transition-transform flex items-center justify-between">
                    <span>Digital Checklists</span>
                    <span className="text-xs">↗</span>
                  </h3>
                  <p className="text-[11px] text-indigo-100/80 mt-0.5 leading-tight font-medium">
                    Inspect shift checklists &amp; review operator logs.
                  </p>
                </Link>

                <div
                  onClick={() => setActiveTab("parts")}
                  className="p-4 rounded-2xl bg-gradient-to-br from-cyan-800 via-slate-900 to-slate-950 text-white shadow-sm hover:shadow-md transition-all group border border-cyan-700/50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl p-2 rounded-xl bg-white/10">⚙️</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/20 text-cyan-100">PM &amp; AMC</span>
                  </div>
                  <h3 className="text-sm font-black mt-3 group-hover:translate-x-1 transition-transform">
                    PM Parts &amp; Stock Register →
                  </h3>
                  <p className="text-[11px] text-cyan-100/80 mt-0.5 leading-tight font-medium">
                    Spare stock levels &amp; vendor AMC contracts.
                  </p>
                </div>
              </div>


              {/* 5. RECENT PLANT TELEMETRY & LOG STREAM */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-rose-50 text-[#880b13] font-bold text-xs">⚡</span>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Recent Telemetry &amp; Logs</h3>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live Feed
                  </span>
                </div>

                <div className="space-y-2">
                  {activityLogs.slice(0, 5).map((log, i) => (
                    <div
                      key={log.id + i}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${log.isCritical ? "bg-rose-50/40 border-rose-200/80" : "bg-slate-50/60 border-slate-200/70"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0 p-1.5 rounded-lg bg-white border border-slate-200/80">
                          {log.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 truncate">{log.title}</p>
                          <p className="text-[11px] text-slate-500 truncate font-medium">{log.subtitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-md font-black text-[10px] ${log.isCritical
                            ? "bg-rose-100 text-rose-800"
                            : /completed|closed/i.test(log.badge)
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {log.badge}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 1b: DEDICATED ASSET MASTER MODULE */}
          {activeTab === "assets" && (
            <AssetMasterTable
              rows={localAssets}
              onEdit={handleEditRow}
              onDelete={handleDeleteRow}
              onAddNew={handleCreateNew}
            />
          )}

          {/* TAB 2: MAINTENANCE WORK ORDERS USING DEDICATED MAINTENANCE RECORDS TABLE */}
          {activeTab === "maintenance" && (
            <MaintenanceRecordsTable
              rows={formattedMaintenanceRows}
              onEdit={handleEditRow}
              onDelete={handleDeleteRow}
              renderStatusCell={renderStatusCell}
            />
          )}

          {/* TAB 3: SAFETY RECORDS USING ADMIN MASTER TABLE ENGINE */}
          {activeTab === "safety" && (
            <GenericMasterTable
              cols={["Record ID", "Safety Type", "Machine / Location", "Risk Level", "Action / Recommendation", "Status", "Date"]}
              rows={formattedSafetyRows}
              onEdit={handleEditRow}
              onDelete={handleDeleteRow}
              renderStatusCell={renderStatusCell}
            />
          )}

          {/* TAB 3b: DEDICATED CHECKLIST RECORDS MODULE */}
          {activeTab === "checklist_records" && (
            <ChecklistRecordsTable
              rows={localChecklistRecords}
              onDelete={handleDeleteRow}
              renderStatusCell={renderStatusCell}
            />
          )}

          {/* TAB 4: INSPECTION CHECKLISTS USING DEDICATED CHECKLIST MASTER TABLE ENGINE */}
          {activeTab === "checklist" && (
            <ChecklistMasterTable
              rows={formattedChecklistRows}
              onEdit={handleEditRow}
              onDelete={handleDeleteRow}
              onAddNew={handleCreateNew}
              currentUser={user}
            />
          )}

          {/* TAB 5: PM PARTS & AMC USING DEDICATED TABLE ENGINE */}
          {activeTab === "parts" && (
            <PMPartsAMCTable
              rows={formattedPMPartsRows}
              onEdit={handleEditRow}
              onDelete={handleDeleteRow}
            />
          )}

          {/* TAB 6: DOCUMENT REGISTER USING ADMIN MASTER TABLE ENGINE */}
          {activeTab === "documents" && (
            <GenericMasterTable
              cols={["Doc ID", "Document Title", "Category", "Machine / Department", "Revision Date"]}
              rows={formattedDocumentRows}
              onEdit={handleEditRow}
              onDelete={handleDeleteRow}
              renderStatusCell={renderStatusCell}
            />
          )}

          {/* TAB 7: DEDICATED NOTIFICATIONS & ALERTS MODULE (PENDING, UPCOMING & DUE) */}
          {activeTab === "alerts" && (
            <SupervisorAlertsModule
              initialAlerts={localNotifications as any}
              initialData={notificationData}
              user={user}
              allMachines={allMachines}
            />
          )}
        </main>
      </div>

      {/* MODAL DIALOGS */}
      {editor && (
        <AdminRecordModal
          editor={editor}
          activeViewKey={activeTab}
          activeView={activeTab}
          singularName={
            activeTab === "assets"
              ? "Asset"
              : activeTab === "maintenance"
                ? "Maintenance Record"
                : activeTab === "safety"
                  ? "Safety Record"
                : activeTab === "checklist"
                  ? "Checklist Item"
                  : activeTab === "parts"
                    ? "PM Part / Stock"
                    : activeTab === "documents"
                      ? "Document"
                      : activeTab === "alerts"
                        ? "Notification / Alert"
                        : "Record"
          }
          columns={["Record ID", "Machine", "Asset ID", "Problem", "Priority", "Status", "Assigned To"]}
          machinesList={(allMachines || []).map((m) => ({ assetId: String(m["Asset ID"] || m["assetId"] || ""), name: String(m["Machine Name"] || m["name"] || "") }))}
          usersList={(allUsers || []).map((u) => ({ userId: String(u["User ID"] || u["userId"] || ""), name: String(u["Name"] || u["name"] || "") }))}
          onClose={() => setEditor(null)}
          onSave={handleSaveRow}
          onSuccess={(msg: string) => {
            showStatus(msg, "success");
            setEditor(null);
          }}
        />
      )}

      {qrModalOpen && (
        <MachineQrModal
          isOpen={qrModalOpen}
          machinesList={(allMachines || []).map((m) => ({ assetId: String(m["Asset ID"] || m["assetId"] || ""), name: String(m["Machine Name"] || m["name"] || "") }))}
          onClose={() => setQrModalOpen(false)}
        />
      )}

      {deleteModalRow && (
        <DeleteConfirmModal
          isOpen={Boolean(deleteModalRow)}
          row={deleteModalRow}
          isDeleting={isDeleting}
          onClose={() => setDeleteModalRow(null)}
          onConfirm={() => handleConfirmDelete(deleteModalRow)}
        />
      )}
    </div>
  );
}
