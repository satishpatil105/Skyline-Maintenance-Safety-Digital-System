import Link from "next/link";
import type { Metadata } from "next";
import AlertsPanel from "@/components/supervisor/AlertsPanel";
import MachineActions from "@/components/operator/MachineActions";
import MachineLanding from "@/components/operator/MachineLanding";
import SiteHeader from "@/components/shared/SiteHeader";
import { findMachineForUser, getSessionUser, isMachineAuthorized } from "@/lib/auth";
import { getMachineProfile } from "@/lib/db";

// Always read fresh data: this is the page a QR scan lands on.
export const dynamic = "force-dynamic";

function decode(value: string) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function generateMetadata({
    params,
}: {
    params: { assetId: string };
}): Metadata {
    return { title: `${decode(params.assetId)} | Skyline Maintenance & Safety` };
}

export default async function OperatorMachinePage({
    params,
    searchParams,
}: {
    params: { assetId: string };
    searchParams: { record?: string };
}) {
    const assetId = decode(params.assetId);
    const [profile, user] = await Promise.all([getMachineProfile(assetId), getSessionUser()]);

    if (!profile) {
        return (
            <div className="min-h-screen flex flex-col justify-between bg-slate-50/50">
                <div>
                    <SiteHeader title="Machine Lookup · Skyline Systems" />
                    <main className="mx-auto max-w-2xl px-4 py-12 text-center">
                        <div className="card rounded-3xl border-2 border-rose-200 bg-white p-8 sm:p-10 shadow-xl space-y-4">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-3xl shadow-inner text-rose-700">
                                ⚠️
                            </div>
                            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 uppercase tracking-wider">
                                QR Scan &amp; Lookup Notice
                            </span>
                            <h2 className="text-2xl font-black text-slate-900">
                                Machine Not Found
                            </h2>
                            <p className="text-sm text-slate-600 max-w-md mx-auto">
                                No machine or plant asset is registered with identifier:
                            </p>
                            <div className="inline-block bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 font-mono text-sm font-black text-slate-800">
                                {assetId || "(Empty Identifier)"}
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 text-left text-xs text-slate-600 space-y-2 mt-4">
                                <p className="font-bold text-slate-700">Diagnostic details &amp; possible reasons:</p>
                                <ul className="list-disc list-inside space-y-1 text-slate-500">
                                    <li>The machine code on the QR label may differ from the Asset ID in Machine Master.</li>
                                    <li>The machine record might not yet be published or synchronized in MongoDB.</li>
                                    <li>Verify the machine exists under Admin Panel &rarr; Machine Master.</li>
                                </ul>
                            </div>
                            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                                <Link
                                    href={`/operator/machine/${encodeURIComponent(assetId)}`}
                                    className="w-full sm:w-auto rounded-xl bg-[#880b13] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#6f0912] transition-colors"
                                >
                                    🔄 Retry Lookup
                                </Link>
                                <Link
                                    href="/operator/dashboard"
                                    className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                    Operator Dashboard
                                </Link>
                                <Link
                                    href="/admin/machines"
                                    className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                    Machine Master
                                </Link>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    const { machine, maintenance, safety } = profile;

    // Authorization Check: Machine-wise operator restriction
    if (user && !isMachineAuthorized(user, machine).allowed) {
        const assignedMachine = await findMachineForUser(user);
        return (
            <div className="min-h-screen flex flex-col justify-between">
                <div>
                    <SiteHeader title="Machine Authorization Restriction" />
                    <main className="mx-auto max-w-2xl px-4 py-12 text-center">
                        <div className="card border-2 border-red-200 bg-red-50/40 p-8 rounded-3xl shadow-xl">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-3xl shadow-inner">
                                🚫
                            </div>
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800 uppercase tracking-wider">
                                Access Restricted · Machine Unauthorized
                            </span>
                            <h2 className="mt-3 text-2xl font-black text-slate-900">
                                Another Machine Cannot Be Opened
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                You are signed in as <strong>{user.name}</strong> ({user.userId || user.email}).
                            </p>

                            <div className="mt-5 rounded-2xl bg-white p-4 border border-red-200 text-left space-y-2 text-xs shadow-sm">
                                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                    <span className="text-slate-500 font-semibold uppercase">Your Assigned Machine</span>
                                    <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                        ✓ {user.departmentMachine}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-slate-500 font-semibold uppercase">Scanned / Attempted</span>
                                    <span className="font-extrabold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                                        ✗ {machine["Machine Name"]} ({machine["Asset ID"]})
                                    </span>
                                </div>
                            </div>

                            <p className="mt-4 text-xs text-red-700 font-medium">
                                Operators are authorized strictly for their designated machine. Another machine cannot be opened or inspected.
                            </p>

                            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                                {assignedMachine && (
                                    <Link
                                        href={`/operator/machine/${encodeURIComponent(assignedMachine["Asset ID"])}`}
                                        className="w-full sm:w-auto rounded-xl bg-skyline-deep px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-skyline-dark"
                                    >
                                        👉 Open My Assigned Machine ({user.departmentMachine})
                                    </Link>
                                )}
                                <Link
                                    href="/operator/dashboard"
                                    className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-6 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                >
                                    Return to Operator Dashboard
                                </Link>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    const recordPath = `/operator/machine/${encodeURIComponent(machine["Asset ID"])}?record=1`;
    const recording = Boolean(user);
    const initialTab =
        searchParams.record === "maintenance" || searchParams.record === "1"
            ? "maintenance"
            : searchParams.record === "safety"
                ? "safety"
                : undefined;

    const openIssues = maintenance.filter(
        (r) => !/^(completed|closed|done|cancelled)$/i.test((r.result || r.status || "").trim())
    ).length;

    return (
        <MachineLanding
            machine={machine}
            recordHref={user ? recordPath : `/login?next=${encodeURIComponent(recordPath)}`}
            loggedIn={Boolean(user)}
            recording={recording}
            user={user}
        >
            {user && (
                <>
                    <MachineActions machine={machine} user={user} initialTab={initialTab} />

                    <AlertsPanel
                        assetId={machine["Asset ID"]}
                        canClose={user.role === "Admin" || user.permissions.includes("Can Approve Close")}
                    />
                </>
            )}
        </MachineLanding>
    );
}
