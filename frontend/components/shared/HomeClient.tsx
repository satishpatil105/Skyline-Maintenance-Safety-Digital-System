"use client";

import Link from "next/link";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth";
import AddMachineForm from "@/components/admin/AddMachineForm";
import AlertsPanel from "@/components/supervisor/AlertsPanel";
import ChecklistReminder from "@/components/shared/ChecklistReminder";
import MachineSearchCard from "@/components/operator/MachineSearchCard";
import MaintenanceForm from "@/components/operator/MaintenanceForm";
import SafetyForm from "@/components/operator/SafetyForm";
import UserBar from "@/components/shared/UserBar";
import SiteHeader from "@/components/shared/SiteHeader";
import type { Machine } from "@/lib/types";

import MachineQrScannerModal from "@/components/operator/MachineQrScannerModal";

import SiteFooter from "@/components/shared/SiteFooter";

type ActiveTab = "none" | "maintenance" | "safety";

export default function HomeClient({ user }: { user: SessionUser }) {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("none");
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const can = (permission: SessionUser["permissions"][number]) =>
    user.role === "Admin" || user.permissions.includes(permission);

  function handleMachineSelected(selected: Machine | null) {
    setMachine(selected);
    setActiveTab("none");
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <UserBar user={user} />

        {/* Quick Executive Dashboard Access Banner */}
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl shadow-inner border border-white/15">
                📊
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider border border-emerald-400/30">
                    Live Telemetry
                  </span>
                  <span className="text-xs text-slate-300 font-semibold">96.8% Fleet Availability</span>
                </div>
                <h3 className="mt-0.5 text-base sm:text-lg font-black text-white">
                  Dashboard &amp; Analytics
                </h3>
                <p className="text-xs text-slate-400">
                  Dynamic 30-day PM trends, equipment health donuts, workload charts &amp; safety matrix.
                </p>
              </div>
            </div>
            <Link
              href="/admin?view=dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 px-5 py-3 text-xs font-black text-white shadow-lg hover:from-violet-700 hover:to-indigo-800 hover:scale-105 transition-all text-center no-underline"
            >
              <span>📈</span>
              <span>Open Analytics Charts</span>
            </Link>
          </div>
        </div>

        <AlertsPanel canClose={can("Can Approve Close")} />

        {(can("Can Submit Maintenance") || can("Can Submit Safety")) && <ChecklistReminder />}

        {user.role !== "Admin" && user.departmentMachine && (
          <div className="overflow-hidden rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-900 to-teal-950 p-6 text-white shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/30">
                  🚜 Your Designated Workstation
                </span>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {user.departmentMachine}
                </h2>
                <p className="mt-1 text-xs text-emerald-200/90 max-w-xl">
                  You are authorized strictly for <strong>{user.departmentMachine}</strong>. Another machine cannot be opened.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-5 py-3 text-center text-xs font-black text-white hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>📷</span> Scan Machine QR
                </button>
                <Link
                  href="/checklist"
                  className="rounded-xl bg-white px-5 py-3 text-center text-xs font-black text-emerald-950 shadow-md hover:bg-emerald-50 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>📋</span> Open Inspection Checklist
                </Link>
              </div>
            </div>
          </div>
        )}

        <MachineQrScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          user={user}
        />

        <Link
          href="/safety"
          className="card !mb-0 flex items-center justify-between gap-3 transition hover:shadow-lg"
          data-testid="safety-dept-link"
        >
          <span>
            <span className="block text-lg font-bold text-skyline-deep">Safety Department</span>
            <span className="block text-sm text-slate-600">
              Fire safety, employee safety, HIRA, environmental and other records
            </span>
          </span>
          <span aria-hidden="true" className="text-2xl font-bold text-skyline-deep">&rsaquo;</span>
        </Link>

        {can("Can Add Machine") && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`primary-button mt-0 ${showAddMachine ? "bg-slate-500 hover:bg-slate-600" : ""}`}
              onClick={() => setShowAddMachine(false)}
            >
              Find Machine
            </button>
            <button
              type="button"
              className={`primary-button mt-0 ${showAddMachine ? "" : "bg-slate-500 hover:bg-slate-600"}`}
              onClick={() => setShowAddMachine(true)}
            >
              + Add Machine
            </button>
          </div>
        )}

        {showAddMachine && can("Can Add Machine") ? (
          <AddMachineForm email={user.email} />
        ) : (
          <>
            <MachineSearchCard
              user={user}
              canMaintenance={can("Can Submit Maintenance")}
              canSafety={can("Can Submit Safety")}
              onMachineSelected={handleMachineSelected}
              onOpenMaintenance={() => setActiveTab("maintenance")}
              onOpenSafety={() => setActiveTab("safety")}
            />

            {machine && activeTab === "maintenance" && (
              <MaintenanceForm machine={machine} user={user} email={user.email} />
            )}

            {machine && activeTab === "safety" && (
              <SafetyForm machine={machine} user={user} email={user.email} />
            )}
          </>
        )}
      </main>
      <div className="mt-12">
        <SiteFooter />
      </div>
    </>
  );
}

