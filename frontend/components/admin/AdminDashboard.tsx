"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { TABLE_LIST, TABLES } from "@/lib/tables";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";
import ExecutiveDashboardView from "./ExecutiveDashboardView";
import {
  AdminSidebar,
  AdminHeader,
  UserMasterTable,
  MachineMasterTable,
  MaintenanceRecordsTable,
  SafetyRecordsTable,
  PMPartsAMCTable,
  DocumentRegisterTable,
  NotificationsAlertsTable,
  MonthlyComplianceTable,
  BreakdownsRepairsTable,
  GenericMasterTable,
  AdminRecordModal,
  MachineQrModal,
  cleanSidebarLabel,
} from "./index";
import DeleteConfirmModal from "./DeleteConfirmModal";
import type { View } from "./AdminSidebar";
import type { Row } from "./UserMasterTable";
import type { EditorState } from "./AdminRecordModal";

interface AdminDashboardProps {
  user: SessionUser;
  initialView?: string;
  initialDb?: {
    machines?: Row[];
    maintenance?: Row[];
    safety?: Row[];
    users?: Row[];
  };
}

const getSlugForViewKey = (key: string): string => {
  const k = key.toLowerCase();
  if (k.includes("machine")) return "machines";
  if (k.includes("user")) return "users";
  if (k.includes("checklist")) return "checklists";
  if (k.includes("breakdown")) return "breakdowns";
  if (k.includes("maintenance")) return "maintenance";
  if (k.includes("fire")) return "fire-safety";
  if (k.includes("environmental") || k.includes("environment")) return "environmental-safety";
  if (k.includes("hira")) return "hira";
  if (k.includes("employee_safety")) return "employee-safety";
  if (k.includes("employee_master") || (k.includes("employee") && !k.includes("safety"))) return "employee-master";
  if (k.includes("safety")) return "safety";
  if (k.includes("parts") || k.includes("amc")) return "pm-parts";
  if (k.includes("training")) return "training";
  if (k.includes("document") || k.includes("register")) return "documents";
  if (k.includes("notification") || k.includes("alert")) return "notifications";
  if (k.includes("month") || k.includes("compliance")) return "monthly";
  if (k.includes("audit")) return "audit-logs";
  if (k.includes("dashboard")) return "dashboard";
  return k.replace(/[^a-z0-9]/g, "-");
};

const resolveInitialViewKey = (initial?: string): string => {
  if (!initial) return "9. Dashboard";
  const norm = initial.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm.includes("checklist")) return "2. Checklist Master";
  if (norm.includes("breakdown")) return "breakdowns";
  if (norm.includes("machine")) return "machines";
  if (norm.includes("user")) return "users";
  if (norm.includes("maintenance")) return "maintenance";
  if (norm.includes("fire")) return "fire_safety";
  if (norm.includes("environmental") || norm.includes("environment")) return "environmental_safety";
  if (norm.includes("hira")) return "hira";
  if (norm.includes("employeesafety")) return "employee_safety";
  if (norm.includes("employeemaster") || (norm.includes("employee") && !norm.includes("safety"))) return "employee_master";
  if (norm.includes("safety")) return "safety";
  if (norm.includes("part") || norm.includes("amc")) return "6. PM Parts AMC";
  if (norm.includes("training")) return "training";
  if (norm.includes("doc") || norm.includes("register")) return "7. Document Register";
  if (norm.includes("notif") || norm.includes("alert")) return "8. Notifications";
  if (norm.includes("month") || norm.includes("compliance")) return "10. Monthly Tracking";
  if (norm.includes("audit")) return "audit_logs";
  if (norm.includes("dash")) return "9. Dashboard";
  return initial;
};

export default function AdminDashboard({ user, initialView, initialDb }: AdminDashboardProps) {
  const [views, setViews] = useState<View[]>([]);
  const [activeView, setActiveView] = useState<string>(resolveInitialViewKey(initialView));
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Responsive Layout State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modal Dialog States
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [deleteModalRow, setDeleteModalRow] = useState<Row | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status Banner Feedback State
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: StatusType } | null>(null);

  const showStatus = (text: string, type: StatusType = "info") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleViewSelect = (key: string) => {
    setActiveView(key);
    if (typeof window !== "undefined") {
      const slug = getSlugForViewKey(key);
      window.history.pushState(null, "", `/admin/${slug}`);
    }
  };

  const DEFAULT_VIEWS: View[] = [
    { key: "9. Dashboard", label: "Dashboard", known: null },
    { key: "machines", label: "Machine Master", known: "machines" },
    { key: "maintenance", label: "Maintenance Records", known: "maintenance" },
    { key: "breakdowns", label: "Breakdowns & Repairs", known: null },
    { key: "6. PM Parts AMC", label: "PM Parts & AMC", known: null },
    { key: "2. Checklist Master", label: "Checklist Master", known: null },
    { key: "safety", label: "Safety Records", known: "safety" },
    { key: "hira", label: "HIRA (Hazard ID & Risk)", known: null },
    { key: "environmental_safety", label: "Environmental Safety", known: null },
    { key: "fire_safety", label: "Fire Safety", known: null },
    { key: "employee_safety", label: "Employee Safety", known: null },
    { key: "10. Monthly Tracking", label: "Monthly Compliance", known: null },
    { key: "users", label: "User & Role Master", known: "users" },
    { key: "employee_master", label: "Employee Master", known: null },
    { key: "training", label: "Training & Skill Matrix", known: null },
    { key: "7. Document Register", label: "Document Register", known: null },
    { key: "8. Notifications", label: "Notifications & Alerts", known: null },
    { key: "audit_logs", label: "System Audit Logs", known: null },
  ];

  // 1. Fetch available views/tables list
  const fetchViews = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tabs");
      if (!res.ok) throw new Error("Failed to load view list");
      const data = await res.json();
      const isSameView = (keyA: string, keyB: string) => {
        const normA = keyA.toLowerCase().replace(/[^a-z0-9]/g, "");
        const normB = keyB.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normA.includes("machine") && normB.includes("machine")) return true;
        if (normA.includes("user") && normB.includes("user")) return true;
        if (normA.includes("maintenance") && normB.includes("maintenance")) return true;
        if (normA.includes("safety") && normB.includes("safety")) return true;
        if (normA.includes("checklist") && normB.includes("checklist")) return true;
        if ((normA.includes("part") || normA.includes("amc")) && (normB.includes("part") || normB.includes("amc"))) return true;
        if ((normA.includes("doc") || normA.includes("register")) && (normB.includes("doc") || normB.includes("register"))) return true;
        if ((normA.includes("notif") || normA.includes("alert")) && (normB.includes("notif") || normB.includes("alert"))) return true;
        if ((normA.includes("month") || normA.includes("compliance")) && (normB.includes("month") || normB.includes("compliance"))) return true;
        if (normA.includes("dash") && normB.includes("dash")) return true;
        return normA === normB;
      };

      if (Array.isArray(data.tabs) && data.tabs.length > 0) {
        const fetchedViews: View[] = data.tabs.map((t: any) => ({
          key: t.name,
          label: t.name,
          known: t.known ?? null,
          rowCount: t.rowCount,
        }));

        // Merge defaults so core tabs and custom sheet tabs are all present without duplicates
        const mergedViews = [...DEFAULT_VIEWS];
        fetchedViews.forEach((fv) => {
          if (!mergedViews.some((v) => isSameView(v.key, fv.key))) {
            mergedViews.push(fv);
          }
        });
        setViews(mergedViews);
      } else {
        setViews(DEFAULT_VIEWS);
      }
    } catch (err: any) {
      console.error("Error fetching admin views:", err);
      setViews(DEFAULT_VIEWS);
    }
  }, []);

  const normalizeCols = (rawCols: any[]): string[] => {
    if (!Array.isArray(rawCols)) return [];
    return rawCols.map((c) => {
      if (typeof c === "string") return c;
      if (c && typeof c === "object") return c.label || c.key || String(c);
      return String(c || "");
    });
  };

  // 2. Fetch records for active view
  const fetchTableData = useCallback(async (viewKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const normalizedKey = viewKey.toLowerCase();
      if (normalizedKey.includes("dashboard") || normalizedKey === "9. dashboard") {
        setRows([]);
        setColumns([]);
        setLoading(false);
        return;
      }

      // 1. Check if it's one of the four core app tables
      let targetTable: string | null = null;
      if (normalizedKey === "machines" || normalizedKey.includes("machine master") || normalizedKey.includes("machine")) targetTable = "machines";
      else if (normalizedKey === "users" || normalizedKey.includes("user master") || normalizedKey.includes("user & role") || normalizedKey.includes("user")) targetTable = "users";
      else if (normalizedKey === "maintenance" || normalizedKey.includes("maintenance records") || normalizedKey.includes("maintenance")) targetTable = "maintenance";
      else if (normalizedKey === "safety" || normalizedKey.includes("safety records") || normalizedKey.includes("safety")) targetTable = "safety";

      if (targetTable) {
        try {
          const res = await fetch(`/api/admin/${targetTable}`);
          if (res.ok) {
            const data = await res.json();
            setRows(data.rows || []);
            setColumns(normalizeCols(data.columns || []));
            return;
          }
        } catch (e) {
          console.warn(`Fallback for targetTable ${targetTable}:`, e);
        }
      }

      // 2. Generic sheet tab or fallback
      try {
        const res = await fetch(`/api/admin/tabs?name=${encodeURIComponent(viewKey)}`);
        if (!res.ok) {
          console.warn(`Tab API returned status ${res.status} for ${viewKey}, providing fallback structure.`);
          setRows([]);
          setColumns(["ID", "Title / Name", "Category / Type", "Status", "Last Updated"]);
          return;
        }
        const data = await res.json();
        const headers: string[] = normalizeCols(data.headers || []);
        const rawRows: { row: number; cells: string[] }[] = data.rows || [];
        const formattedRows: Row[] = rawRows.map((r) => {
          const rowObj: Row = { __row: String(r.row) };
          headers.forEach((h, idx) => {
            if (h) rowObj[h] = r.cells[idx] || "";
          });
          return rowObj;
        });
        setRows(formattedRows);
        setColumns(headers.length > 0 ? headers : ["ID", "Title / Name", "Category / Type", "Status", "Last Updated"]);
      } catch (tabErr) {
        console.warn("Sheet tab fetch caught error, using clean fallback:", tabErr);
        setRows([]);
        setColumns(["ID", "Title / Name", "Category / Type", "Status", "Last Updated"]);
      }
    } catch (err: any) {
      console.error(`Error loading data for ${viewKey}:`, err);
      // Graceful error state without breaking UI
      setRows([]);
      setColumns(["ID", "Title / Name", "Category / Type", "Status", "Last Updated"]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  useEffect(() => {
    if (activeView) {
      fetchTableData(activeView);
    }
  }, [activeView, fetchTableData]);

  const machinesList = useMemo(() => {
    let source: any[] = [];
    if (activeView.toLowerCase().includes("machine") && rows.length > 0) {
      source = rows;
    } else if (initialDb?.machines && initialDb.machines.length > 0) {
      source = initialDb.machines;
    }

    const list = source.map((r: any, idx: number) => ({
      assetId: String(r["Asset ID"] || r["assetId"] || r["Machine ID"] || `SKY-00${idx + 1}`),
      name: String(r["Name"] || r["machineName"] || r["Machine Name"] || "Machine"),
      department: String(r["Category"] || r["Department"] || "Shopfloor"),
      status: String(r["Status"] || "Active"),
    }));

    if (list.length === 0) {
      return [
        { assetId: "LSR-001", name: "Laser Cutting Machine (Fiber 6kW)", department: "Cutting Shop", status: "Active" },
        { assetId: "TPP-001", name: "Turret Punch Press (CNC 30-Ton)", department: "Punching", status: "Active" },
        { assetId: "SHR-001", name: "CNC Shearing Machine (12mm)", department: "Shearing", status: "Active" },
        { assetId: "BND-001", name: "CNC Bending Press Brake (150-Ton)", department: "Bending", status: "Active" },
        { assetId: "CMP-001", name: "Screw Air Compressor (50 HP)", department: "Utilities", status: "Active" },
        { assetId: "EOT-001", name: "EOT Overhead Crane (10-Ton)", department: "Handling", status: "Active" },
        { assetId: "WLD-001", name: "CO2 MIG Welding Station #1", department: "Welding", status: "Active" },
        { assetId: "DRL-001", name: "Heavy Radial Drill Machine", department: "Drilling", status: "Active" },
        { assetId: "OVN-001", name: "Powder Coating Curing Oven", department: "Paint Shop", status: "Active" },
        { assetId: "UPS-001", name: "Online Industrial UPS (100 kVA)", department: "Electrical", status: "Active" },
        { assetId: "STB-001", name: "Servo Main Voltage Stabilizer", department: "Electrical", status: "Active" },
        { assetId: "PNL-001", name: "Main LT Electrical Switchgear Panel", department: "Electrical", status: "Active" },
        { assetId: "PNM-002", name: "Pneumatic Power Press (20-Ton)", department: "Stamping", status: "Active" },
      ];
    }
    return list;
  }, [rows, activeView, initialDb]);

  const usersList = useMemo(() => {
    let source: any[] = [];
    if (activeView.toLowerCase().includes("user") && rows.length > 0) {
      source = rows;
    } else if (initialDb?.users && initialDb.users.length > 0) {
      source = initialDb.users;
    }

    return source.map((r: any, idx: number) => ({
      userId: String(r["User ID"] || r["__id"] || `USR-00${idx + 1}`),
      name: String(r["Name"] || r["userName"] || "User"),
    }));
  }, [rows, activeView, initialDb]);

  const currentViewObj = views.find((v) => v.key === activeView);
  const currentTitle = currentViewObj ? currentViewObj.label : activeView;
  const isDashboardView = activeView.toLowerCase().includes("dashboard") || activeView === "9. Dashboard";

  const singularName = cleanSidebarLabel(currentTitle).replace(/s$/, "").replace(/Records$/, "Record");

  const handleCreateNew = () => {
    const newRow: Row = {};
    columns.forEach((c) => {
      if (c !== "__id") newRow[c] = "";
    });
    setEditor({ row: newRow, isNew: true });
  };

  const handleEditRow = (rowToEdit: Row) => {
    setEditor({ row: { ...rowToEdit }, isNew: false });
  };

  const handleSaveRow = async (updatedRow: Row) => {
    try {
      const isNew = editor?.isNew ?? false;
      const normalizedKey = activeView.toLowerCase().trim();
      let targetTable: string | null = null;
      if (normalizedKey === "machines" || normalizedKey.includes("machine master")) targetTable = "machines";
      else if (normalizedKey === "users" || normalizedKey.includes("user master")) targetTable = "users";
      else if (normalizedKey === "maintenance" || normalizedKey.includes("maintenance records")) targetTable = "maintenance";
      else if (normalizedKey === "safety" || normalizedKey === "safety records") targetTable = "safety";

      if (targetTable) {
        const rowId =
          updatedRow["recordId"] ||
          updatedRow["User ID"] ||
          updatedRow["Asset ID"] ||
          updatedRow["id"] ||
          updatedRow["__id"];

        const res = await fetch(`/api/admin/${targetTable}`, {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: rowId, row: updatedRow }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || "Failed to save record");
        }
      } else {
        // For all other modules: build cells array keyed by column order from columns state
        // If columns is empty, collect all keys from the updated row itself
        const colKeys = columns && columns.length > 0
          ? columns.filter(c => c !== "__row" && c !== "__id")
          : Object.keys(updatedRow).filter(c => c !== "__row" && c !== "__id");

        const cells = colKeys.map((col) => updatedRow[col] ?? "");
        const rowIndex = updatedRow["__row"] ? Number(updatedRow["__row"]) : undefined;

        const res = await fetch(`/api/admin/tabs?name=${encodeURIComponent(activeView)}`, {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ row: rowIndex, cells }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || "Failed to save record");
        }
      }

      showStatus(`Successfully ${isNew ? "created" : "updated"} record`, "success");
      setEditor(null);
      fetchTableData(activeView);
    } catch (err: any) {
      console.error("Save error:", err);
      showStatus(err.message || "Failed to save record", "error");
    }
  };

  const handleDeleteRow = (rowToDelete: Row) => {
    setDeleteModalRow(rowToDelete);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalRow) return;
    const rowToDelete = deleteModalRow;
    const identifier =
      rowToDelete["User ID"] ||
      rowToDelete["Asset ID"] ||
      rowToDelete["recordId"] ||
      rowToDelete["Template ID"] ||
      rowToDelete["Alert ID"] ||
      rowToDelete["partId"] ||
      rowToDelete["docId"] ||
      rowToDelete["Name"] ||
      rowToDelete["Machine Name"] ||
      "this record";

    setIsDeleting(true);
    try {
      const normalizedKey = activeView.toLowerCase().trim();
      let targetTable: string | null = null;
      if (normalizedKey === "machines" || normalizedKey.includes("machine master")) targetTable = "machines";
      else if (normalizedKey === "users" || normalizedKey.includes("user master")) targetTable = "users";
      else if (normalizedKey === "maintenance" || normalizedKey.includes("maintenance records")) targetTable = "maintenance";
      else if (normalizedKey === "safety" || normalizedKey.includes("safety records")) targetTable = "safety";

      if (targetTable) {
        const rowId =
          rowToDelete["recordId"] ||
          rowToDelete["User ID"] ||
          rowToDelete["Asset ID"] ||
          rowToDelete["id"] ||
          rowToDelete["__id"] ||
          identifier;

        const res = await fetch(`/api/admin/${targetTable}?id=${encodeURIComponent(rowId)}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || "Failed to delete record");
        }
      } else {
        const rowIndex = rowToDelete["__row"] ? Number(rowToDelete["__row"]) : undefined;
        const res = await fetch(`/api/admin/tabs?name=${encodeURIComponent(activeView)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ row: rowIndex, identifier }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || "Failed to delete tab record");
        }
      }

      // Immediately update local UI state
      setRows((prevRows) => prevRows.filter((r) => r !== rowToDelete));

      showStatus(`Successfully deleted ${identifier}`, "success");
      setDeleteModalRow(null);
      fetchTableData(activeView);
    } catch (err: any) {
      console.error("Delete error:", err);
      showStatus(err.message || "Failed to delete record", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStatusCell = (colKey: string, val: string) => {
    const l = val.toLowerCase();
    if (/^(yes|active|running|completed|resolved|closed)$/i.test(l)) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {val}
        </span>
      );
    }
    if (/^(open|pending|in progress|maintenance|warning)$/i.test(l)) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans antialiased">
      <AdminSidebar
        views={views}
        activeView={activeView}
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        onSelectView={handleViewSelect}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"}`}>
        <AdminHeader
          currentTitle={currentTitle}
          sidebarCollapsed={sidebarCollapsed}
          mobileMenuOpen={mobileMenuOpen}
          hasCurrentView={!isDashboardView}
          singular={singularName}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          onOpenQrModal={() => setQrModalOpen(true)}
          onOpenCreateModal={handleCreateNew}
        />

        {statusMsg && (
          <div className="p-4 pb-0">
            <StatusBanner message={statusMsg.text} type={statusMsg.type} />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-4">
          {isDashboardView ? (
            <ExecutiveDashboardView
              machines={initialDb?.machines || []}
              maintenance={initialDb?.maintenance || []}
              safety={initialDb?.safety || []}
              users={initialDb?.users || []}
            />
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div className="w-10 h-10 border-4 border-[#880b13] border-t-transparent rounded-full animate-spin"></div>
              <span className="mt-3 text-xs font-bold text-slate-600">Loading module data...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 rounded-2xl border border-red-200 text-center space-y-2">
              <span className="text-2xl">⚠️</span>
              <div className="text-sm font-bold text-red-900">Failed to load view</div>
              <div className="text-xs text-red-700">{error}</div>
              <button
                type="button"
                onClick={() => fetchTableData(activeView)}
                className="mt-2 rounded-xl bg-red-600 text-white px-4 py-1.5 text-xs font-bold hover:bg-red-700 transition-colors"
              >
                Retry Load
              </button>
            </div>
          ) : activeView.toLowerCase().includes("user") ? (
            <UserMasterTable rows={rows} onEdit={handleEditRow} onDelete={handleDeleteRow} />
          ) : activeView.toLowerCase().includes("machine") ? (
            <MachineMasterTable rows={rows} onEdit={handleEditRow} onDelete={handleDeleteRow} />
          ) : activeView.toLowerCase().includes("breakdown") ? (
            <BreakdownsRepairsTable rows={rows} onEdit={handleEditRow} onDelete={handleDeleteRow} renderStatusCell={renderStatusCell} />
          ) : activeView.toLowerCase().includes("maintenance") ? (
            <MaintenanceRecordsTable rows={rows} onEdit={handleEditRow} onDelete={handleDeleteRow} renderStatusCell={renderStatusCell} />
          ) : activeView.toLowerCase().includes("safety") ? (
            <SafetyRecordsTable rows={rows} onEdit={handleEditRow} onDelete={handleDeleteRow} renderStatusCell={renderStatusCell} />
          ) : activeView.toLowerCase().includes("parts") || activeView.toLowerCase().includes("amc") ? (
            <PMPartsAMCTable rows={rows} onEdit={handleEditRow} onDelete={handleDeleteRow} />
          ) : activeView.toLowerCase().includes("document") || activeView.toLowerCase().includes("register") ? (
            <DocumentRegisterTable rows={rows} onEdit={handleEditRow} onDelete={handleDeleteRow} />
          ) : activeView.toLowerCase().includes("notification") || activeView.toLowerCase().includes("alert") ? (
            <NotificationsAlertsTable rows={rows} onEdit={handleEditRow} onDelete={handleDeleteRow} />
          ) : activeView.toLowerCase().includes("month") || activeView.toLowerCase().includes("compliance") ? (
            <MonthlyComplianceTable rows={rows} onEdit={handleEditRow} onDelete={handleDeleteRow} />
          ) : (
            <GenericMasterTable cols={columns} rows={rows} onEdit={handleEditRow} onDelete={handleDeleteRow} renderStatusCell={renderStatusCell} />
          )}
        </main>
      </div>

      <AdminRecordModal
        editor={editor}
        columns={columns}
        activeViewKey={activeView}
        singularName={singularName}
        machinesList={machinesList}
        usersList={usersList}
        onClose={() => setEditor(null)}
        onSave={handleSaveRow}
      />

      <MachineQrModal
        isOpen={qrModalOpen}
        machinesList={machinesList}
        onClose={() => setQrModalOpen(false)}
      />

      <DeleteConfirmModal
        isOpen={!!deleteModalRow}
        row={deleteModalRow}
        itemName={singularName}
        onClose={() => setDeleteModalRow(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
