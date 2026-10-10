import { notFound, redirect } from "next/navigation";
import SafetyCategoryView from "@/components/supervisor/SafetyCategoryView";
import { getSessionUser } from "@/lib/auth";
import { categoryById } from "@/lib/safetyDeptConfig";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { category: string } }) {
    const c = categoryById(params.category);
    return { title: `${c?.label ?? "Safety Department"} | Skyline EHS Management` };
}

export default async function SupervisorSafetyCategoryPage({ params }: { params: { category: string } }) {
    const category = categoryById(params.category);
    if (!category) notFound();

    const user = await getSessionUser();
    if (!user) redirect(`/login?next=${encodeURIComponent("/supervisor/safety/" + category.id)}`);

    const can = (p: (typeof user.permissions)[number]) => user.role === "Admin" || user.permissions.includes(p);

    return (
        <SafetyCategoryView
            user={user}
            category={category}
            canSubmit={can("Can Submit Safety")}
            canClose={can("Can Approve Close")}
        />
    );
}
