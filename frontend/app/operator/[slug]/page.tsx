import { redirect } from "next/navigation";
import OperatorPortal from "@/components/operator/OperatorPortal";
import { findMachineForUser, getDashboardForRole, getSessionUser } from "@/lib/auth";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Operator Station | Skyline" };

export default async function OperatorSlugPage({
    params,
}: {
    params: { slug?: string };
}) {
    const user = await getSessionUser();
    if (!user) {
        redirect(`/login?next=${encodeURIComponent(`/operator/${params?.slug || "dashboard"}`)}`);
    }

    if (user.role !== "Operator" && !user.userId?.startsWith("OP-")) {
        redirect(getDashboardForRole(user.role));
    }

    const [db, assignedMachine] = await Promise.all([
        readDb(),
        findMachineForUser(user),
    ]);

    const allMachines = (db.machines || []).map((m) => ({
        "Asset ID": m["Asset ID"] || "",
        "Machine Name": m["Machine Name"] || "",
        Department: m.Department || "",
        Location: m.Location || "",
        Status: m.Status || "Operational",
    }));

    return (
        <OperatorPortal
            user={user}
            initialTab={params?.slug || "dashboard"}
            assignedMachine={assignedMachine || null}
            allMachines={allMachines}
        />
    );
}
