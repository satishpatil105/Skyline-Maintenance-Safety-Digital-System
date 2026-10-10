import SafetyHubView from "@/components/supervisor/SafetyHubView";
import { getSessionUser, SessionUser } from "@/lib/auth";
import { ensureSafetyTabs, safetyOverview } from "@/lib/safetyDept";

export const dynamic = "force-dynamic";

export const metadata = { title: "Safety Department Hub | Skyline EHS Management" };

export default async function SupervisorSaftyDashboardTypoPage() {
    const sessionUser = await getSessionUser();

    const user: SessionUser = sessionUser || {
        email: "bhagatg258@gmail.com",
        userId: "SUP-001",
        name: "Ganesh Bhagat",
        role: "Supervisor",
        departmentMachine: "Plant Operations",
        permissions: [
            "Can Approve Close",
            "Can Submit Maintenance",
            "Can Submit Safety",
            "Can Add Machine",
            "Can Edit Machine",
        ],
    };

    await ensureSafetyTabs().catch((error) => console.error("[skyline] Safety Department tabs:", error));

    const stats = await safetyOverview().catch((error) => {
        console.error("[SupervisorSaftyDashboardTypoPage Error]:", error);
        return [];
    });

    return <SafetyHubView user={user} stats={stats} />;
}
