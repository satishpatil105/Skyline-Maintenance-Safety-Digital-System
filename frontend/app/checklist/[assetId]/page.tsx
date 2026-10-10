import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyMachineChecklistPage({
    params,
}: {
    params: { assetId: string };
}) {
    const asset = decodeURIComponent(params.assetId || "");
    redirect(`/operator/checklist/${encodeURIComponent(asset)}`);
}
