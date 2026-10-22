import SupervisorDashboard from "@/components/supervisor/SupervisorDashboard";
import { loadSupervisorPortalProps } from "@/lib/supervisorData";

export const dynamic = "force-dynamic";

export const metadata = { title: "Supervisor Dashboard | Skyline Digital System" };

export default async function SupervisorDashboardPage() {
    const props = await loadSupervisorPortalProps("overview");
    return <SupervisorDashboard {...props} />;
}
