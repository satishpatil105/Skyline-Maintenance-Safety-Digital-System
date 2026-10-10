import Link from "next/link";
import { redirect } from "next/navigation";
import ChangePasswordForm from "@/components/shared/ChangePasswordForm";
import SiteHeader from "@/components/shared/SiteHeader";
import SiteFooter from "@/components/shared/SiteFooter";
import UserBar from "@/components/shared/UserBar";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Account | Skyline Maintenance & Safety" };

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        <SiteHeader title="My Account" subtitle={user.email} />
        <main className="mx-auto max-w-md space-y-5 px-4 py-6">
          <UserBar user={user} />
          <ChangePasswordForm />
          <p className="text-center text-sm">
            <Link href="/" className="font-bold text-skyline-deep underline">
              Back to the app
            </Link>
          </p>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

