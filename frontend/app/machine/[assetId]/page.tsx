import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyMachinePage({
  params,
  searchParams,
}: {
  params: { assetId: string };
  searchParams: { record?: string };
}) {
  const query = searchParams.record ? `?record=${searchParams.record}` : "";
  redirect(`/operator/machine/${encodeURIComponent(params.assetId)}${query}`);
}
