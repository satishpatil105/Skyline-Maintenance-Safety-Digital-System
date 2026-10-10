import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OperatorRootPage({
  searchParams,
}: {
  searchParams?: { assetId?: string | string[]; asset?: string | string[] };
}) {
  const raw = searchParams?.assetId || searchParams?.asset;
  const assetId = Array.isArray(raw) ? raw[0] : raw;
  if (assetId && typeof assetId === "string" && assetId.trim()) {
    redirect(`/operator/machine/${encodeURIComponent(assetId.trim())}`);
  }
  redirect("/operator/dashboard");
}
