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
            <div className="min-h-screen flex flex-col justify-between">
                <div>
                    <SiteHeader title="Machine not found" />
                    <main className="mx-auto max-w-2xl px-4 py-12 text-center">
                        <div className="card">
                            <h2 className="text-xl font-bold text-red-700">Machine not found</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                No machine is registered with Asset ID <strong>{assetId}</strong>.
                            </p>
                            <Link href="/operator/dashboard" className="primary-button mt-5 inline-block w-auto px-6 no-underline">
                                Return to Operator Dashboard
                            </Link>
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
