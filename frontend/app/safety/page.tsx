import { redirect } from "next/navigation";
import SafetyHubView from "@/components/supervisor/SafetyHubView";
import { getSessionUser } from "@/lib/auth";
import { ensureSafetyTabs, safetyOverview } from "@/lib/safetyDept";

export const dynamic = "force-dynamic";

export const metadata = { title: "Safety Department Hub | Skyline EHS Management" };

export default async function SafetyDepartmentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/safety");

  await ensureSafetyTabs().catch((error) => console.error("[skyline] Safety Department tabs:", error));
  const stats = await safetyOverview();

  return <SafetyHubView user={user} stats={stats} />;
}