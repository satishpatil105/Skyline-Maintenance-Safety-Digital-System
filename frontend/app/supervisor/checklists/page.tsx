import SupervisorDashboard from "@/components/supervisor/SupervisorDashboard";
import { loadSupervisorPortalProps } from "@/lib/supervisorData";

export const dynamic = "force-dynamic";

export default async function SupervisorChecklistsPage() {
    const props = await loadSupervisorPortalProps("checklist");
    return <SupervisorDashboard {...props} />;
}
