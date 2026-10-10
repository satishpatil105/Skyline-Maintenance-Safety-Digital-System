import { redirect } from "next/navigation";
import HomeClient from "@/components/shared/HomeClient";
import { findMachineForUser, getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { home?: string };
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const role = (user.role || "").toLowerCase();

  // 1. Admin role -> Redirect to /admin/dashboard
  if (role.includes("admin")) {
    redirect("/admin/dashboard");
  }

  // 2. Supervisor / Manager role -> Redirect to /supervisor/dashboard
  if (role.includes("superv") || role.includes("manage")) {
    redirect("/supervisor/dashboard");
  }

  // 3. Operators designated to a specific machine are routed to their machine
  if (user.departmentMachine && searchParams?.home !== "1") {
    const machine = await findMachineForUser(user);
    if (machine) {
      redirect(`/machine/${encodeURIComponent(machine["Asset ID"])}`);
    }
  }

  return <HomeClient user={user} />;
}
