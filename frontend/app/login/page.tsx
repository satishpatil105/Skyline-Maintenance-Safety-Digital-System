import { redirect } from "next/navigation";
import LoginForm from "@/components/shared/LoginForm";
import { findMachineForUser, getSessionUser } from "@/lib/auth";
import { safeNext } from "@/lib/redirect";

export const dynamic = "force-dynamic";

export const metadata = { title: "Secure Login | SkyMS — Skyline Maintenance & Safety" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string | string[]; machine?: string };
}) {
  const next = safeNext(searchParams.next);
  const user = await getSessionUser();

  if (user) {
    if (next === "/admin" && user.role !== "Admin") {
      // Allow signing in as Admin
    } else if (user.role === "Admin") {
      redirect(next && next !== "/" && next !== "/login" ? next : "/admin");
    } else if (user.role === "Supervisor") {
      redirect(next && next !== "/" && next !== "/login" ? next : "/supervisor");
    } else {
      // Operators always go directly to /operator/dashboard
      redirect("/operator/dashboard");
    }
  }

  const targetAssetId = typeof searchParams.machine === "string" ? searchParams.machine : undefined;

  return (
    <LoginForm
      next={next}
      targetAssetId={targetAssetId}
      currentUser={user ? { name: user.name, email: user.email, userId: user.userId, role: user.role } : null}
    />
  );
}
