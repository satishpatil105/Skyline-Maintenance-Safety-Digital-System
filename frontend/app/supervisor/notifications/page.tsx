import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SupervisorDashboard from "@/components/supervisor/SupervisorDashboard";

export const dynamic = "force-dynamic";

export default async function SupervisorNotificationsPage() {
    const user = await getSessionUser();
    if (!user) {
        redirect("/login");
    }

    return (
        <SupervisorDashboard
            user={user}
            initialTab="8. Notifications"
        />
    );
}
