import { redirect } from "next/navigation";
import ChecklistForm from "@/components/operator/ChecklistForm";
import { findMachineForUser, getSessionUser, isMachineAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { assetId: string } }) {
    const asset = decodeURIComponent(params.assetId || "");
    return { title: `Shift Checklist - ${asset} | Skyline Maintenance & Safety` };
}

export default async function MachineOperatorChecklistPage({
    params,
}: {
    params: { assetId: string };
}) {
    const asset = decodeURIComponent(params.assetId || "");
    const user = await getSessionUser();

    if (!user) {
        redirect(`/login?next=${encodeURIComponent(`/operator/checklist/${encodeURIComponent(asset)}`)}`);
    }

    // Authorization check for operators
    if (user.role !== "Admin" && user.departmentMachine) {
        const auth = isMachineAuthorized(user, asset);
        if (!auth.allowed) {
            const myMachine = await findMachineForUser(user);
            if (myMachine) {
                redirect(`/operator/checklist/${encodeURIComponent(myMachine["Asset ID"])}`);
            }
        }
    }

    return <ChecklistForm user={user} initialAsset={asset} />;
}
