import SupervisorDashboard from "@/components/supervisor/SupervisorDashboard";
import { loadSupervisorPortalProps } from "@/lib/supervisorData";

export const dynamic = "force-dynamic";

export default async function SupervisorNotificationsPage() {
    const props = await loadSupervisorPortalProps("alerts");
    return <SupervisorDashboard {...props} />;
}
