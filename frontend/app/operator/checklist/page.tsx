import { redirect } from "next/navigation";
import ChecklistForm from "@/components/operator/ChecklistForm";
import { findMachineForUser, getSessionUser, isMachineAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Operator Shift Checklist | Skyline Maintenance & Safety" };

export default async function OperatorChecklistPage({
    searchParams,
}: {
    searchParams: { asset?: string | string[]; assetId?: string | string[] };
}) {
    const raw = searchParams.asset || searchParams.assetId;
    const asset = Array.isArray(raw) ? raw[0] : raw;
    const user = await getSessionUser();
    if (!user) {
        redirect(`/login?next=${encodeURIComponent("/operator/checklist" + (asset ? `?asset=${asset}` : ""))}`);
    }

    // If operator opens checklist, route directly to their assigned machine
    if (user.role === "Operator" && user.departmentMachine) {
        if (asset) {
            const auth = isMachineAuthorized(user, asset);
            if (!auth.allowed) {
                const myMachine = await findMachineForUser(user);
                if (myMachine) {
                    redirect(`/operator/checklist?asset=${encodeURIComponent(myMachine["Asset ID"])}`);
                }
            }
        } else {
            const myMachine = await findMachineForUser(user);
            if (myMachine) {
                redirect(`/operator/checklist?asset=${encodeURIComponent(myMachine["Asset ID"])}`);
            }
        }
    }

    return <ChecklistForm user={user} initialAsset={asset || ""} />;
}
