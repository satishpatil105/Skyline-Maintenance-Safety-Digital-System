import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { getDashboardForRole, getSessionUser, SessionUser } from "@/lib/auth";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin Dashboard | Skyline" };

export default async function AdminSlugPage({
    params,
    searchParams,
}: {
    params: { slug?: string[] };
    searchParams?: { view?: string; tab?: string };
}) {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
        redirect("/login?next=/admin");
    }

    if (sessionUser.role !== "Admin") {
        redirect(getDashboardForRole(sessionUser.role));
    }

    const user: SessionUser = sessionUser;

    const slugView = params?.slug?.[0];
    const targetView = slugView || searchParams?.view || searchParams?.tab;

    const db = await readDb().catch((err) => {
        console.error("[AdminSlugPage Error reading DB]:", err);
        return null;
    });

    const initialDb = {
        machines: (db?.machines || []) as unknown as Record<string, string>[],
        maintenance: (db?.maintenanceRecords || []) as unknown as Record<string, string>[],
        safety: (db?.safetyRecords || []) as unknown as Record<string, string>[],
        users: (db?.users || []) as unknown as Record<string, string>[],
    };

    return (
        <AdminDashboard
            user={user}
            initialView={targetView}
            initialDb={initialDb}
        />
    );
}
