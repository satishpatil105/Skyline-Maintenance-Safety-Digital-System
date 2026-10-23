import { redirect } from "next/navigation";
import { getDashboardForRole, getSessionUser, SessionUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { todayString } from "@/lib/dates";
import { ensureSafetyTabs, safetyOverview } from "@/lib/safetyDept";
import { Row } from "@/components/admin/UserMasterTable";

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

export async function loadSupervisorPortalProps(initialTabRaw?: string) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/login?next=/supervisor");
  }

  if (sessionUser.role !== "Supervisor" && sessionUser.role !== "Admin") {
    redirect(getDashboardForRole(sessionUser.role));
  }

  const user: SessionUser = sessionUser;
  const initialTab = normalizeSupervisorTab(initialTabRaw);

  ensureSafetyTabs().catch(() => {});

  const [db, safetyStats] = await Promise.all([
    readDb().catch((err) => {
      console.error("[loadSupervisorPortalProps Error reading DB]:", err);
      return null;
    }),
    safetyOverview().catch((err) => {
      console.error("[loadSupervisorPortalProps Error reading safetyOverview]:", err);
      return [];
    }),
  ]);

  const maintenanceRecords = db?.maintenanceRecords || [];
  const safetyRecords = db?.safetyRecords || [];
  const machines = db?.machines || [];

  const openMaintenance = maintenanceRecords.filter(
    (m) => m.status?.toLowerCase() !== "completed" && m.status?.toLowerCase() !== "closed"
  ).length;

  const openSafety = safetyRecords.filter(
    (s) => s.status?.toLowerCase() !== "completed" && s.status?.toLowerCase() !== "closed"
  ).length;

  const highRiskIncidents = safetyRecords.filter((s) => {
    const risk = (s.riskLevel || "").toLowerCase();
    return risk.includes("high") || risk.includes("critical");
  }).length;

  const today = todayString();
  const checklistRecords = (db as any)?.checklistRecords || [];
  const completedTodayChecklists = checklistRecords.filter((cr: any) => {
    const d = cr.date || (cr.createdAt ? String(cr.createdAt).slice(0, 10) : "");
    const s = String(cr.status || cr.response || "").toUpperCase();
    return d === today && (s === "OK" || s === "PASSED" || s === "NOT OK" || s === "FAILED");
  }).length;

  const stats = {
    totalMachines: machines.length,
    openMaintenance,
    openSafety,
    completedTodayChecklists,
    highRiskIncidents,
  };

  const recentMaintenance = maintenanceRecords.map((m: any) => ({
    recordId: m.recordId || m["Record ID"] || "",
    date: m.date || m["Date"] || "",
    assetId: m.assetId || m["Asset ID"] || "",
    machineName: m.machineName || m["Machine Name"] || "",
    userId: m.userId || m["User ID"] || "",
    userName: m.userName || m["User Name"] || m.submittedBy || "",
    checklistId: m.checklistId || m["Checklist ID"] || "",
    problem: m.problem || m["Problem / Breakdown"] || m["Problem"] || m.checkPoint || "",
    priority: m.priority || m["Priority"] || "Medium",
    assignedTo: m.assignedTo || m["Assigned To"] || m.technicianName || "",
    actionTaken: m.actionTaken || m["Action Taken"] || m.correctiveAction || "",
    status: m.status || m["Status"] || "Open",
    completionDate: m.completionDate || m["Completion Date"] || "",
  }));

  const recentSafety = safetyRecords.map((s) => ({
    recordId: s.recordId || "",
    machineName: s.machineName || "",
    assetId: s.assetId || "",
    safetyType: s.safetyType || "Observation",
    riskLevel: s.riskLevel || "Medium Risk",
    status: s.status || "Open",
    date: s.date || "",
    immediateAction: s.immediateAction || s.correctiveAction || "",
  }));

  const rawDb = (db || {}) as any;
  const DEFAULT_NOTIFICATIONS: any[] = [];
  let categorizedNotifs: any = null;
  try {
    const { getCategorizedAlerts } = await import("./notifications");
    categorizedNotifs = await getCategorizedAlerts();
  } catch (err) {
    console.warn("Failed to load categorized alerts for supervisor:", err);
  }

  const notifications = (categorizedNotifs?.alerts && categorizedNotifs.alerts.length > 0)
    ? categorizedNotifs.alerts
    : (rawDb.notifications && rawDb.notifications.length > 0 ? rawDb.notifications : []);

  return {
    user,
    stats,
    safetyOverview: safetyStats,
    recentMaintenance,
    recentSafety,
    checklists: (rawDb.checklists || []) as unknown as Record<string, string>[],
    pmParts: (rawDb.pmParts || []) as unknown as Record<string, string>[],
    documents: (rawDb.documentRegister || []) as unknown as Record<string, string>[],
    notifications: notifications as unknown as any[],
    notificationData: categorizedNotifs,
    allMachines: (rawDb.machines || []) as unknown as Row[],
    allAssets: (rawDb.assets || []) as unknown as Row[],
    allUsers: (rawDb.users || []) as unknown as Row[],
    initialTab,
  };
}
