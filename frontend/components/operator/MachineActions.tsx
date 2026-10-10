"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import type { Machine, Permission } from "@/lib/types";
import EditMachineForm from "@/components/admin/EditMachineForm";
import MaintenanceForm from "./MaintenanceForm";
import SafetyForm from "./SafetyForm";
import UserBar from "@/components/shared/UserBar";

type Tab = "none" | "maintenance" | "safety" | "edit";

const ACTIONS: { permission: Permission; tab: Exclude<Tab, "none">; label: string; muted?: boolean }[] = [
  { permission: "Can Edit Machine", tab: "edit", label: "Edit Machine", muted: true },
];

/**
 * Shown on the QR scan page. Anyone can read the machine details. Staff who
 * are logged in see the actions their account allows; everyone else gets a
 * login button. The API routes re-check permissions on every save.
 */
export default function MachineActions({
  machine,
  user,
  initialTab,
}: {
  machine: Machine;
  user: SessionUser | null;
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab || "none");

  if (!user) {
    const next = `/machine/${encodeURIComponent(machine["Asset ID"])}`;
    return (
      <section className="card" id="machine-access">
        <h2 className="mb-1 border-b-2 border-slate-200 pb-2.5 text-xl font-bold text-skyline-deep">
          Staff Access
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          Skyline staff: log in to record maintenance, log a safety inspection
          or edit this machine.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="primary-button block text-center no-underline"
        >
          Staff Login
        </Link>
      </section>
    );
  }

  const actions = ACTIONS.filter(
    (a) => user.role === "Admin" || user.permissions.includes(a.permission)
  );
  const refresh = () => router.refresh();
  const canChecklist =
    user.role === "Admin" ||
    user.permissions.includes("Can Submit Maintenance") ||
    user.permissions.includes("Can Submit Safety");

  return (
    <>
      <section className="card" id="machine-access">
        <h2 className="mb-1 border-b-2 border-slate-200 pb-2.5 text-xl font-bold text-skyline-deep">
          Staff Actions
        </h2>

        {canChecklist && (
          <Link
            href={`/operator/checklist?asset=${encodeURIComponent(machine["Asset ID"])}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative mt-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 p-4 text-white shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 no-underline border border-emerald-500/30 overflow-hidden"
          >
            <div className="flex items-center gap-3.5 z-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-2xl shadow-inner backdrop-blur-xs group-hover:scale-110 transition-transform">
                📋
              </div>
              <div>
                <span className="block text-base font-black tracking-tight leading-tight text-white">
                  Fill Shift Checklist
                </span>
                <span className="text-xs font-semibold text-emerald-100/90 mt-0.5 block">
                  Inspect daily shift check points &amp; record parameters
                </span>
              </div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-sm font-black text-white group-hover:bg-white group-hover:text-emerald-800 transition-all z-10 shrink-0">
              ↗
            </span>
          </Link>
        )}

        {actions.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:auto-cols-fr sm:grid-flow-col">
            {actions.map((a) => (
              <button
                key={a.tab}
                type="button"
                className={`primary-button mt-0 ${a.muted ? "bg-slate-500 hover:bg-slate-600" : ""} ${tab === a.tab ? "ring-2 ring-[#880b13] ring-offset-2" : ""}`}
                onClick={() => setTab(tab === a.tab ? "none" : a.tab)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {tab === "edit" && <EditMachineForm machine={machine} email={user.email} onSaved={refresh} />}
    </>
  );
}
