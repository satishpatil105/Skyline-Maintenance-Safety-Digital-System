import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SupervisorSafetyPage() {
    const user = await getSessionUser();
    if (!user) {
        redirect("/login?next=/supervisor/safety/dashboard");
    }
    redirect("/supervisor/safety/dashboard");
}


