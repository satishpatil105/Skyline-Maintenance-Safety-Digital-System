import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyChecklistPage({
  searchParams,
}: {
  searchParams: { asset?: string | string[]; assetId?: string | string[] };
}) {
  const raw = searchParams.asset || searchParams.assetId;
  const asset = Array.isArray(raw) ? raw[0] : raw;
  const query = asset ? `?asset=${encodeURIComponent(asset)}` : "";
  redirect(`/operator/checklist${query}`);
}
