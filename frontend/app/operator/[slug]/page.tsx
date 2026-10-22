import { redirect } from "next/navigation";
import OperatorPortal from "@/components/operator/OperatorPortal";
import { findMachineForUser, findMachinesForUser, getDashboardForRole, getSessionUser } from "@/lib/auth";
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

    const [db, assignedMachine, assignedMachines] = await Promise.all([
        readDb(),
        findMachineForUser(user),
        findMachinesForUser(user),
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
            assignedMachine={assignedMachine || (assignedMachines.length > 0 ? assignedMachines[0] : null)}
            assignedMachines={assignedMachines}
            allMachines={allMachines}
        />
    );
}
