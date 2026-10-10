import { redirect } from "next/navigation";
import { getDashboardForRole, getSessionUser, SessionUser } from "@/lib/auth";
import SupervisorDashboard from "@/components/supervisor/SupervisorDashboard";
import { readDb } from "@/lib/db";
import { ensureSafetyTabs, safetyOverview } from "@/lib/safetyDept";
import { Row } from "@/components/admin/UserMasterTable";

export const dynamic = "force-dynamic";

export default async function SupervisorDashboardPage() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
        redirect("/login?next=/supervisor");
    }

    if (sessionUser.role !== "Supervisor") {
        redirect(getDashboardForRole(sessionUser.role));
    }

    const user: SessionUser = sessionUser;

    await ensureSafetyTabs().catch((err) => console.error("[skyline] safety tabs error:", err));

    const db = await readDb().catch((err) => {
        console.error("[SupervisorDashboardPage Error reading DB]:", err);
        return null;
    });

    const safetyStats = await safetyOverview().catch((err) => {
        console.error("[SupervisorDashboardPage Error reading safetyOverview]:", err);
        return [];
    });

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

    const stats = {
        totalMachines: machines.length,
        openMaintenance,
        openSafety,
        completedTodayChecklists: maintenanceRecords.filter((m) => m.recordType === "Checklist").length,
        highRiskIncidents,
    };

    const recentMaintenance = maintenanceRecords.map((m) => ({
        recordId: m.recordId || "",
        machineName: m.machineName || "",
        assetId: m.assetId || "",
        problem: m.problem || m.checkPoint || "",
        priority: m.priority || "Normal",
        status: m.status || "Pending",
        date: m.date || "",
        assignedTo: m.assignedTo || m.technicianName || "",
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
    const DEFAULT_NOTIFICATIONS = [
        { "Alert ID": "ALT-2026-001", "Alert Title": "Fiber Laser Optics Cleaning Due", "Severity": "Warning", "Source / Machine": "Laser Machine (SKY-LSR-MCH-001)", "Date & Time": "2026-10-09 08:30" },
        { "Alert ID": "ALT-2026-002", "Alert Title": "Fine Air Compressor AMC Renewal Notice", "Severity": "Info", "Source / Machine": "Air Compressor (SKY-CMP-UTL-001)", "Date & Time": "2026-10-08 14:15" },
        { "Alert ID": "ALT-2026-003", "Alert Title": "Emergency Stop Sensor Calibration Required", "Severity": "Critical", "Source / Machine": "Punching Machine (SKY-TPP-PUN-001)", "Date & Time": "2026-10-09 07:00" },
        { "Alert ID": "ALT-2026-004", "Alert Title": "Shift 1 Daily Safety Checklist Complete", "Severity": "Info", "Source / Machine": "Plant Operations / Shift 1", "Date & Time": "2026-10-09 09:00" },
        { "Alert ID": "ALT-2026-005", "Alert Title": "Hydraulic Oil Pressure Normalization", "Severity": "Info", "Source / Machine": "Bending Machine (SKY-BND-MCH-001)", "Date & Time": "2026-10-08 16:45" },
    ];
    const notifications = (rawDb.notifications && rawDb.notifications.length > 0 ? rawDb.notifications : DEFAULT_NOTIFICATIONS);

    return (
        <SupervisorDashboard
            user={user}
            stats={stats}
            safetyOverview={safetyStats}
            recentMaintenance={recentMaintenance}
            recentSafety={recentSafety}
            checklists={(rawDb.checklists || []) as unknown as Record<string, string>[]}
            pmParts={(rawDb.pmParts || []) as unknown as Record<string, string>[]}
            documents={(rawDb.documentRegister || []) as unknown as Record<string, string>[]}
            notifications={notifications as unknown as Record<string, string>[]}
            allMachines={(rawDb.machines || []) as unknown as Row[]}
            allUsers={(rawDb.users || []) as unknown as Row[]}
            initialTab="overview"
        />
    );
}
