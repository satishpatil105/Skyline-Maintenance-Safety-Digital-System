import SupervisorDashboard from "@/components/supervisor/SupervisorDashboard";
import { loadSupervisorPortalProps } from "@/lib/supervisorData";

export const dynamic = "force-dynamic";

export default async function SupervisorMaintenancePage() {
    const props = await loadSupervisorPortalProps("maintenance");
    return <SupervisorDashboard {...props} />;
}
