import { redirect } from "next/navigation";

export default function SaftyRootTypoRedirectPage() {
    redirect("/supervisor/safety/dashboard");
}
