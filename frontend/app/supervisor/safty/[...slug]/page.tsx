import { redirect } from "next/navigation";

export default function SaftyTypoRedirectPage() {
    redirect("/supervisor/safety/dashboard");
}
