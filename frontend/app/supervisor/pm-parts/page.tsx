import SupervisorDashboard from "@/components/supervisor/SupervisorDashboard";
import { loadSupervisorPortalProps } from "@/lib/supervisorData";

export const dynamic = "force-dynamic";

export default async function SupervisorPmPartsPage() {
    const props = await loadSupervisorPortalProps("parts");
    return <SupervisorDashboard {...props} />;
}
