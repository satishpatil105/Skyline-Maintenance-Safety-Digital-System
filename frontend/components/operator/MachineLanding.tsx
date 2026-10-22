"use client";

import { useState } from "react";
import Link from "next/link";
import type { Machine } from "@/lib/types";
import SiteHeader from "@/components/shared/SiteHeader";
import SiteFooter from "@/components/shared/SiteFooter";

import type { SessionUser } from "@/lib/auth";

const FIELDS: (keyof Machine)[] = [
  "Asset ID",
  "Machine Name",
  "Category",
  "Department",
  "Location",
  "Make",
  "Model",
  "Serial No.",
  "Criticality",
  "Responsible Person",
  "Assigned Users",
  "Status",
  "PM Frequency",
  "AMC Vendor",
  "AMC Contact",
  "AMC Expiry",
  "Installation Date",
];

function statusClass(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "operational" || s === "running") return "bg-green-100 text-green-800";
  if (s.includes("maintenance")) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

/**
 * What a QR scan opens:
 *   - the Skyline logo, "Maintenance & Safety", and the machine's Asset ID
 *   - tap the Asset ID to open the machine details (machine master)
 *   - at the bottom, "Keep the Record": goes to the User ID + password page and
 *     then carries on in the app for this machine
 * Once someone has signed in and chosen to keep a record, `children` (the
 * maintenance / safety / edit actions, alerts and history) appear below.
 */
import MachineStationLogin from "./MachineStationLogin";

export default function MachineLanding({
  machine,
  recordHref,
  loggedIn,
  recording,
  user,
  children,
}: {
  machine: Machine;
  /** Where "Keep the Record" leads: the login page (then back here), or straight to recording. */
  recordHref: string;
  loggedIn: boolean;
  /** Signed in and already in record mode: show `children` instead of the button. */
  recording: boolean;
  user?: SessionUser | null;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const details = FIELDS.filter((f) => machine[f]);

  const backHref = user?.role === "Admin"
    ? "/admin"
    : user?.role?.toLowerCase() === "supervisor"
    ? "/supervisor/dashboard"
    : "/operator/dashboard";

  const backLabel = user?.role === "Admin"
    ? "Admin Dashboard"
    : user?.role?.toLowerCase() === "supervisor"
    ? "Supervisor Dashboard"
    : "Operator Dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50">
      {/* Ultra-Professional Corporate Branded Header */}
      <header className="bg-gradient-to-r from-[#880b13] via-[#a00d17] to-slate-900 text-white px-3.5 sm:px-6 py-3.5 sm:py-4 shadow-xl border-b border-[#a00d17]/80">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 w-full sm:w-auto">
            <span
              role="img"
              aria-label="Skyline logo"
              className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-full bg-white shadow-lg ring-2 ring-white/70 brand-badge transition transform hover:scale-105"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-base md:text-lg font-black tracking-tight leading-tight text-white truncate">
                  Skyline Project &amp; Engineers Pvt. Ltd.
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold text-emerald-300 border border-emerald-400/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Running
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-rose-200/90 mt-0.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>Machine Workstation</span>
                <span className="hidden xs:inline">·</span>
                <span className="font-extrabold text-white">{machine["Machine Name"]}</span>
                <span className="font-mono bg-white/10 px-1.5 sm:px-2 py-0.5 rounded text-[10px] text-rose-100 border border-white/15">
                  {machine["Asset ID"]}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Link
              href={backHref}
              className="flex-1 sm:flex-none justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 px-3.5 py-2 text-xs font-black text-white transition-all border border-white/20 shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <span>←</span>
              <span>{backLabel}</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex-1 sm:flex-none justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 px-3.5 py-2 text-xs font-extrabold text-white transition-all border border-white/20 shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <span>⚙️</span>
              <span>{open ? "Hide Machine Details" : "View Machine Details"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6">
        {!loggedIn && (
          <div id="station-login-section">
            <MachineStationLogin machine={machine} />
          </div>
        )}

        {open && (
          <section className="rounded-2xl bg-white p-6 sm:p-8 border border-slate-200/90 shadow-lg space-y-5 animate-fadeIn" id="machine-details">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-[#880b13] tracking-wider bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                  ASSET SPECIFICATION MASTER
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
                  <span>🏭</span> {machine["Machine Name"]} Details
                </h2>
              </div>
              <span className="font-mono text-xs font-extrabold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                {machine["Asset ID"]}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {details.map((f) => (
                <div key={f} className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-slate-100/50 p-3.5 hover:border-rose-200 transition shadow-2xs">
                  <strong className="mb-1 block text-[10px] font-black uppercase text-slate-400 tracking-wider">{f}</strong>
                  <span className="break-words text-xs font-extrabold text-slate-800 leading-snug">{machine[f]}</span>
                </div>
              ))}
            </div>

            {/* Dedicated Assigned Personnel & Operators Section */}
            {(() => {
              let rawAssigned = (machine as any).assignedUsers;
              if (!Array.isArray(rawAssigned) || rawAssigned.length === 0) {
                if (machine["Assigned Users"]) {
                  rawAssigned = typeof machine["Assigned Users"] === "string"
                    ? machine["Assigned Users"].split(",").map((s: string) => s.trim()).filter(Boolean)
                    : Array.isArray(machine["Assigned Users"]) ? machine["Assigned Users"] : [];
                }
              }
              const assignedList: string[] = Array.isArray(rawAssigned)
                ? Array.from(new Set(rawAssigned.map(String).map((s) => s.trim()).filter(Boolean)))
                : [];
              const userDetails: any[] = (machine as any).assignedUserDetails || [];

              return (
                <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">👥</span>
                      <div>
                        <h3 className="text-xs font-black text-slate-900 tracking-tight">Assigned Personnel &amp; Operators</h3>
                        <p className="text-[11px] font-medium text-slate-500">
                          Personnel authorized to operate, inspect, and service this machine
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-200">
                      {assignedList.length} Assigned
                    </span>
                  </div>

                  {assignedList.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-1">
                      No users currently assigned to this machine.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {assignedList.map((uId) => {
                        const match = userDetails.find(
                          (u: any) => String(u.userId || "").toUpperCase() === String(uId).toUpperCase()
                        );
                        const displayName = match && match.name && match.name !== uId ? match.name : uId;
                        const role = match?.role || "Operator";
                        const email = match?.email || "";
                        return (
                          <div key={uId} className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs shrink-0">
                                👤
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 truncate">{displayName}</div>
                                <div className="text-[11px] font-mono font-medium text-slate-500 flex items-center gap-1.5 truncate">
                                  <span className="bg-slate-100 px-1 py-0.2 rounded text-[10px]">{uId}</span>
                                  {email && <span className="truncate">· {email}</span>}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                              {role}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* If logged in, show children (Staff Actions, Maintenance / Safety Forms, Alerts) directly */}
        {children}
      </main>

      {/* The sticky action bar at the bottom: smooth scroll or trigger record without bubbling */}
      {!loggedIn && (
        <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_14px_rgba(160,13,23,0.08)]">
          <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-2">
            <button
              type="button"
              id="keep-record"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const el = document.getElementById("station-email");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.focus();
                } else {
                  window.location.href = recordHref;
                }
              }}
              className="primary-button !mt-0 block w-full text-center text-base font-bold shadow-md hover:opacity-95"
            >
              🔓 Enter Operator ID &amp; Keep the Record
            </button>
            <Link
              href={recordHref}
              className="text-xs text-slate-500 hover:text-skyline-deep underline text-center flex-none"
            >
              Admin / Alternate Login
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

