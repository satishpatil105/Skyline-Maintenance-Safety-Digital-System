import LandingPage from "@/components/shared/LandingPage";
import { getDashboardForRole, getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();

  if (user) {
    redirect(getDashboardForRole(user.role));
  }

  return <LandingPage isLoggedIn={false} />;
}