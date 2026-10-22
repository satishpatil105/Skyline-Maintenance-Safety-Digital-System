import SupervisorDashboard from "@/components/supervisor/SupervisorDashboard";
import { loadSupervisorPortalProps } from "@/lib/supervisorData";

export const dynamic = "force-dynamic";

export default async function SupervisorDocumentsPage() {
    const props = await loadSupervisorPortalProps("documents");
    return <SupervisorDashboard {...props} />;
}
