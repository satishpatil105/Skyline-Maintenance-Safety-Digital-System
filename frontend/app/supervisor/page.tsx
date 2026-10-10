import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SupervisorRootPage() {
  redirect("/supervisor/dashboard");
}
