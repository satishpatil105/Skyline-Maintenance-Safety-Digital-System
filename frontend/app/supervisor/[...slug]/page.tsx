import SupervisorDashboard from "@/components/supervisor/SupervisorDashboard";
import { loadSupervisorPortalProps } from "@/lib/supervisorData";

export const dynamic = "force-dynamic";

export const metadata = { title: "Supervisor Portal | Skyline Digital System" };

export default async function SupervisorSlugPage({
    params,
    searchParams,
}: {
    params: { slug?: string[] };
    searchParams?: { tab?: string; view?: string };
}) {
    const rawSlug = params?.slug?.[0] || searchParams?.tab || searchParams?.view;
    const props = await loadSupervisorPortalProps(rawSlug);
    return <SupervisorDashboard {...props} />;
}
