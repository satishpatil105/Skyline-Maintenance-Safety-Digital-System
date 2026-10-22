"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import MaintenanceSubNav, { MaintenanceTabId } from "./MaintenanceSubNav";
import MaintenanceDashboardTab from "./MaintenanceDashboardTab";
import MaintenanceRequestsTab from "./MaintenanceRequestsTab";
import MaintenanceRecordsTab from "./MaintenanceRecordsTab";
import PreventiveMaintenanceTab from "./PreventiveMaintenanceTab";
import BreakdownMaintenanceTab from "./BreakdownMaintenanceTab";
import AMCServiceReportsTab from "./AMCServiceReportsTab";
import MTTRMTBFReportsTab from "./MTTRMTBFReportsTab";
import MachineHistoryTab from "./MachineHistoryTab";
import SparePartsConsumptionTab from "./SparePartsConsumptionTab";
import MaintenanceScheduleTab from "./MaintenanceScheduleTab";
import MaintenanceTeamTab from "./MaintenanceTeamTab";
import MaintenanceDocumentsTab from "./MaintenanceDocumentsTab";
import MaintenanceReportsTab from "./MaintenanceReportsTab";
import MaintenanceWorkEntryModal from "./MaintenanceWorkEntryModal";
import ChecklistRecordsTable from "../ChecklistRecordsTable";
import type {
  MaintenanceDashboardStats,
  MaintenanceRequest,
  MaintenanceRecordItem,
  PMScheduleItem,
  BreakdownItem,
  AMCContractItem,
  AMCServiceReportItem,
  SparePartItem,
  TechnicianItem,
  MachineMTTRMetric,
} from "@/lib/maintenanceSystem";

interface MaintenanceHubProps {
  user: SessionUser;
  machinesList?: any[];
  usersList?: any[];
  onRefreshParent?: () => void;
}

export default function MaintenanceHub({
  user,
  machinesList = [],
  usersList = [],
  onRefreshParent,
}: MaintenanceHubProps) {
  const [activeTab, setActiveTab] = useState<MaintenanceTabId>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Live state from MongoDB Atlas
  const [stats, setStats] = useState<MaintenanceDashboardStats | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [records, setRecords] = useState<MaintenanceRecordItem[]>([]);
  const [pmSchedules, setPmSchedules] = useState<PMScheduleItem[]>([]);
  const [breakdowns, setBreakdowns] = useState<BreakdownItem[]>([]);
  const [amcContracts, setAmcContracts] = useState<AMCContractItem[]>([]);
  const [amcReports, setAmcReports] = useState<AMCServiceReportItem[]>([]);
  const [spares, setSpares] = useState<SparePartItem[]>([]);
  const [team, setTeam] = useState<TechnicianItem[]>([]);
  const [mttrMetrics, setMttrMetrics] = useState<MachineMTTRMetric[]>([]);

  // Modal controls
  const [workEntryModalOpen, setWorkEntryModalOpen] = useState(false);
  const [selectedReqForWorkEntry, setSelectedReqForWorkEntry] = useState<MaintenanceRequest | null>(null);
  const [isVerificationModal, setIsVerificationModal] = useState(false);
  const [selectedRecordForVerify, setSelectedRecordForVerify] = useState<MaintenanceRecordItem | null>(null);
  const [historyTargetAssetId, setHistoryTargetAssetId] = useState<string | undefined>(undefined);
  const [tabFilter, setTabFilter] = useState<string | undefined>(undefined);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setStatusBanner({ text, type });
    setTimeout(() => {
      setStatusBanner((current) => (current?.text === text ? null : current));
    }, 5000);
  };

  // Fetch full data from Atlas Hub endpoint
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/maintenance/hub", { cache: "no-store" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch maintenance data (${res.status})`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to load maintenance records");
      }

      setStats(data.stats);
      setRequests(data.requests || []);
      setRecords(data.records || []);
      setPmSchedules(data.pmSchedules || []);
      setBreakdowns(data.breakdowns || []);
      setAmcContracts(data.amcContracts || []);
      setAmcReports(data.amcReports || []);
      setSpares(data.spares || []);
      setTeam(data.team || []);
      setMttrMetrics(data.mttrMetrics || []);
    } catch (err: any) {
      console.error("[MaintenanceHub] Fetch error:", err);
      setError(err.message || "Failed to connect to maintenance telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam) {
        const norm = tabParam.toLowerCase();
        if (norm.includes("checklist")) {
          setActiveTab("checklists");
        } else if (norm.includes("request")) {
          setActiveTab("requests");
        } else if (norm.includes("record")) {
          setActiveTab("records");
        }
      }
    }
  }, [fetchData]);

  // Tab navigation handler with optional filter
  const handleNavigateTab = (tab: MaintenanceTabId, filter?: string) => {
    setActiveTab(tab);
    setTabFilter(filter);
    if (tab === "history" && filter) {
      setHistoryTargetAssetId(filter);
    }
  };

  // API Call Dispatches
  const handleAssignRequest = async (requestId: string, technicianName: string, priority?: any, targetDate?: string) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign_request", requestId, technicianName, priority, targetDate }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to assign technician");
    showToast(data.message || "Technician assigned successfully.");
    fetchData();
  };

  const handleStartWork = async (requestId: string) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_work", requestId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to start maintenance work");
    showToast(data.message || "Maintenance work marked In Progress.");
    fetchData();
  };

  const handlePutOnHold = async (requestId: string, reason: string) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "put_on_hold", requestId, reason }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to put request on hold");
    showToast(data.message || "Request put on hold.");
    fetchData();
  };

  const handleCancelRequest = async (requestId: string, reason: string, status?: "Cancelled" | "Rejected") => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_request", requestId, reason, status }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to cancel request");
    showToast(data.message || `Request marked as ${status || "Cancelled"}.`);
    fetchData();
  };

  const handleCreateRequest = async (reqData: any) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_request", requestData: reqData }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to create maintenance request");
    showToast(data.message || "Maintenance request created successfully.");
    fetchData();
    if (onRefreshParent) onRefreshParent();
  };

  const handleReopenRequest = async (requestId: string, reason: string) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen_request", requestId, reason }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to reopen request");
    showToast(data.message || "Request reopened and returned to Open status.");
    fetchData();
  };

  const handleSubmitWorkEntry = async (workData: any) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete_request", completionData: workData }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to submit completion");
    showToast(data.message || "Maintenance request completed successfully and moved to Completed Records.");
    fetchData();
    if (onRefreshParent) onRefreshParent();
  };

  const handleVerifyWork = async (verifyData: { recordId: string; decision: "Approve" | "Reject / Rework"; remarks: string; safetyReleaseAuthorized: boolean }) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "verify_work",
        ...verifyData,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Verification failed");
    showToast(data.message || "Maintenance record verification updated.");
    fetchData();
    if (onRefreshParent) onRefreshParent();
  };

  const handleCreatePM = async (schedule: any) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_pm", schedule }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to create PM schedule");
    showToast(data.message || "Preventive Maintenance schedule created.");
    fetchData();
  };

  const handleCompletePM = async (scheduleId: string, details: any) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete_pm", scheduleId, details }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to complete PM schedule");
    showToast(data.message || "PM routine completed and linked record created.");
    fetchData();
    if (onRefreshParent) onRefreshParent();
  };

  const handleCreateBreakdown = async (breakdown: any) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_breakdown", breakdown }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to log breakdown");
    showToast(data.message || "Emergency breakdown logged and queued in Workflow B.");
    fetchData();
    if (onRefreshParent) onRefreshParent();
  };

  const handleCreateAMCContract = async (contract: any) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_amc_contract", contract }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to save contract");
    showToast(data.message || "AMC Contract registered.");
    fetchData();
  };

  const handleCreateAMCReport = async (report: any) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_amc_report", report }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to record service visit");
    showToast(data.message || "Service visit report recorded.");
    fetchData();
  };

  const handleConsumeSpare = async (consumption: any) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "consume_spare", consumption }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to log spare consumption");
    showToast(data.message || "Spare parts consumption recorded.");
    fetchData();
  };

  const handleDeleteRecord = async (recordId: string) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_record", recordId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete record");
    showToast(data.message || "Maintenance record deleted.");
    fetchData();
    if (onRefreshParent) onRefreshParent();
  };

  const handleDeletePM = async (scheduleId: string) => {
    const res = await fetch("/api/admin/maintenance/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_pm", scheduleId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete PM schedule");
    showToast(data.message || "Preventive Maintenance schedule deleted.");
    fetchData();
    if (onRefreshParent) onRefreshParent();
  };

  // Open modal handlers
  const handleOpenWorkEntryModal = (req?: MaintenanceRequest) => {
    setSelectedReqForWorkEntry(req || null);
    setIsVerificationModal(false);
    setSelectedRecordForVerify(null);
    setWorkEntryModalOpen(true);
  };

  const handleOpenVerifyModal = (rec: MaintenanceRecordItem) => {
    setSelectedRecordForVerify(rec);
    setIsVerificationModal(true);
    setSelectedReqForWorkEntry(null);
    setWorkEntryModalOpen(true);
  };

  // Badge counts for SubNav
  const badgeCounts = {
    openRequests: stats?.openRequests || 0,
    pendingApprovals: stats?.pendingSupervisorApprovals || 0,
    pmDueToday: stats?.pmDueToday || 0,
    overduePM: stats?.overduePMTasks || 0,
    criticalBreakdowns: stats?.criticalIssues || 0,
    expiringAMC: stats?.upcomingAMCVistits || 0,
  };

  return (
    <div className="w-full space-y-4">
      {/* Toast Notification Banner */}
      {statusBanner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
            statusBanner.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
              : statusBanner.type === "error"
              ? "bg-red-50 text-red-900 border-red-300"
              : "bg-blue-50 text-blue-900 border-blue-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{statusBanner.type === "success" ? "✓" : "⚠️"}</span>
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Submodule Navigation */}
      <MaintenanceSubNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setTabFilter(undefined);
        }}
        badgeCounts={badgeCounts}
      />

      {/* Loading state */}
      {loading && !stats ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="w-10 h-10 border-4 border-[#880b13] border-t-transparent rounded-full animate-spin"></div>
          <span className="mt-3 text-xs font-bold text-slate-700">Connecting to MongoDB Atlas Maintenance Telemetry...</span>
        </div>
      ) : error ? (
        <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
          <span className="text-3xl">⚠️</span>
          <div className="text-sm font-bold text-red-950">Maintenance Telemetry Offline</div>
          <div className="text-xs text-red-700 max-w-md mx-auto">{error}</div>
          <button
            type="button"
            onClick={fetchData}
            className="mt-2 rounded-xl bg-[#880b13] text-white px-4 py-2 text-xs font-bold hover:bg-[#6e090f] transition-colors cursor-pointer shadow-xs"
          >
            Reconnect to Database
          </button>
        </div>
      ) : (
        <div>
          {/* 1. Maintenance Dashboard */}
          {activeTab === "dashboard" && stats && (
            <MaintenanceDashboardTab
              stats={stats}
              onNavigateTab={handleNavigateTab}
              onOpenCreateWorkEntry={() => handleOpenWorkEntryModal()}
            />
          )}

          {/* 2. Maintenance Requests */}
          {activeTab === "requests" && (
            <MaintenanceRequestsTab
              requests={requests}
              technicians={team}
              machinesList={machinesList}
              currentUser={user}
              onAssignRequest={handleAssignRequest}
              onStartWork={handleStartWork}
              onPutOnHold={handlePutOnHold}
              onCancelRequest={handleCancelRequest}
              onCreateRequest={handleCreateRequest}
              onReopenRequest={handleReopenRequest}
              onOpenWorkEntryForRequest={(req) => handleOpenWorkEntryModal(req)}
              onRefresh={fetchData}
              initialFilter={tabFilter}
            />
          )}

          {/* 3. Maintenance Records */}
          {activeTab === "records" && (
            <MaintenanceRecordsTab
              records={records}
              onOpenRecordDetail={(rec) => handleOpenVerifyModal(rec)}
              onRefresh={fetchData}
              onDeleteRecord={handleDeleteRecord}
              initialFilter={tabFilter}
            />
          )}

          {/* 4. Checklist Records */}
          {activeTab === "checklists" && (
            <div className="bg-transparent space-y-4">
              <ChecklistRecordsTable rows={[]} />
            </div>
          )}

          {/* 4. Preventive Maintenance */}
          {activeTab === "pm" && (
            <PreventiveMaintenanceTab
              schedules={pmSchedules}
              technicians={team}
              machinesList={machinesList}
              onCompletePM={handleCompletePM}
              onCreatePM={handleCreatePM}
              onRefresh={fetchData}
              onDeletePM={handleDeletePM}
              initialFilter={tabFilter}
            />
          )}

          {/* 5. Breakdown Maintenance */}
          {activeTab === "breakdowns" && (
            <BreakdownMaintenanceTab
              breakdowns={breakdowns}
              technicians={team}
              machinesList={machinesList}
              onCreateBreakdown={handleCreateBreakdown}
              onRefresh={fetchData}
            />
          )}

          {/* 6. Internal AMC & Service Reports */}
          {activeTab === "amc" && (
            <AMCServiceReportsTab
              contracts={amcContracts}
              reports={amcReports}
              machinesList={machinesList}
              onCreateContract={handleCreateAMCContract}
              onCreateReport={handleCreateAMCReport}
              onRefresh={fetchData}
            />
          )}

          {/* 7. MTTR & MTBF Reports */}
          {activeTab === "mttr" && (
            <MTTRMTBFReportsTab
              metrics={mttrMetrics}
              onRefresh={fetchData}
              onSelectMachine={(assetId) => {
                setHistoryTargetAssetId(assetId);
                setActiveTab("history");
              }}
            />
          )}

          {/* 8. Machine History */}
          {activeTab === "history" && (
            <MachineHistoryTab
              machinesList={machinesList}
              records={records}
              requests={requests}
              pmSchedules={pmSchedules}
              breakdowns={breakdowns}
              amcReports={amcReports}
              mttrMetrics={mttrMetrics}
              initialAssetId={historyTargetAssetId}
            />
          )}

          {/* 9. Spare Parts & Consumption */}
          {activeTab === "spares" && (
            <SparePartsConsumptionTab
              spares={spares}
              technicians={team}
              machinesList={machinesList}
              onConsumeSpare={handleConsumeSpare}
              onRefresh={fetchData}
            />
          )}

          {/* 10. Schedule & Calendar */}
          {activeTab === "calendar" && (
            <MaintenanceScheduleTab
              pmSchedules={pmSchedules}
              amcContracts={amcContracts}
              requests={requests}
            />
          )}

          {/* 11. Maintenance Team */}
          {activeTab === "team" && (
            <MaintenanceTeamTab
              technicians={team}
              requests={requests}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {/* 12. Maintenance Documents */}
          {activeTab === "documents" && <MaintenanceDocumentsTab />}

          {/* 13. Maintenance Reports */}
          {activeTab === "reports" && (
            <MaintenanceReportsTab
              records={records}
              mttrMetrics={mttrMetrics}
            />
          )}
        </div>
      )}

      {/* Work Entry Modal (Workflow C & Workflow D) */}
      <MaintenanceWorkEntryModal
        isOpen={workEntryModalOpen}
        onClose={() => {
          setWorkEntryModalOpen(false);
          setSelectedReqForWorkEntry(null);
          setSelectedRecordForVerify(null);
          setIsVerificationModal(false);
        }}
        request={selectedReqForWorkEntry}
        existingRecord={selectedRecordForVerify}
        technicians={team}
        spares={spares}
        machinesList={machinesList}
        currentUser={user}
        onSubmitWorkEntry={handleSubmitWorkEntry}
        onVerifyWorkEntry={handleVerifyWork}
        isVerificationMode={isVerificationModal}
      />
    </div>
  );
}
