"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Machine } from "@/lib/types";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";

export default function MachineStationLogin({
  machine,
  onSuccess,
}: {
  machine: Machine;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assignedInfo, setAssignedInfo] = useState<{ name: string; assetId: string } | null>(null);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({
    type: null,
    message: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus({ type: null, message: "" });
    setAssignedInfo(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          targetAssetId: machine["Asset ID"],
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus({
          type: "success",
          message: `Authenticated! Unlocking ${machine["Machine Name"]}...`,
        });
        if (onSuccess) {
          onSuccess();
        } else {
          router.replace(`/machine/${encodeURIComponent(machine["Asset ID"])}?record=1`);
          router.refresh();
        }
        return;
      }

      if (result.unauthorizedMachine) {
        if (result.assignedMachine && result.assignedAssetId) {
          setAssignedInfo({
            name: result.assignedMachine,
            assetId: result.assignedAssetId,
          });
        }
        setStatus({
          type: "error",
          message:
            result.message ||
            `🚫 Access Restricted: You are assigned to another machine. You can ONLY log in to and open your own machine.`,
        });
      } else {
        setStatus({
          type: "error",
          message: result.message || "Invalid credentials or unauthorized account.",
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: "Server Error: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card overflow-hidden !p-0 border-2 border-slate-300 shadow-xl rounded-3xl bg-white">
      {/* Station Header */}
      <div className="bg-gradient-to-r from-slate-900 via-skyline-deep to-slate-900 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl shadow-inner backdrop-blur-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 border border-emerald-400/30">
                Machine Scanner Station
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-mono text-white/90">
                {machine["Asset ID"]}
              </span>
            </div>
            <h3 className="mt-1 text-lg font-black text-white sm:text-xl">
              {machine["Machine Name"]}
            </h3>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {/* Notice */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-start gap-2.5">
          <span className="text-base flex-none">🔒</span>
          <div>
            <span className="font-bold block">Machine-Wise Operator Authentication</span>
            <span className="text-blue-800/90 text-[11px] leading-relaxed">
              Scan &amp; Log In: Operators can <strong>ONLY</strong> unlock and operate their designated machine. Another machine cannot be opened.
            </span>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="field-label !mt-0 text-xs" htmlFor="stationLoginEmail">
              Operator User ID or Work Email <span className="text-red-600">*</span>
            </label>
            <div className="relative mt-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">
                👤
              </span>
              <input
                id="stationLoginEmail"
                type="text"
                className="field-input !pl-9 text-sm"
                placeholder="e.g. OP-001 or name@skyline.com"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="field-label !mt-0 text-xs" htmlFor="stationLoginPassword">
              Password <span className="text-red-600">*</span>
            </label>
            <div className="relative mt-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">
                🔑
              </span>
              <input
                id="stationLoginPassword"
                type={showPassword ? "text" : "password"}
                className="field-input !pl-9 !pr-10 text-sm"
                placeholder="Enter password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-gradient-to-r from-skyline-deep to-skyline-dark py-3.5 px-4 text-center text-sm font-black text-white shadow-lg hover:from-skyline-dark hover:to-skyline-deep transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Verifying Machine Authorization...</span>
              </>
            ) : (
              <>
                <span>🔓</span>
                <span>Log In &amp; Unlock {machine["Machine Name"]}</span>
              </>
            )}
          </button>
        </form>

        <StatusBanner type={status.type} message={status.message} />

        {/* Assigned Machine Quick Hop if Operator tried another machine */}
        {assignedInfo && (
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-4 text-center shadow-md space-y-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-extrabold text-emerald-800 uppercase tracking-wide">
              Your Designated Machine Found
            </span>
            <p className="text-xs text-emerald-950 font-bold">
              You are authorized strictly for: <strong>{assignedInfo.name}</strong>
            </p>
            <a
              href={`/machine/${encodeURIComponent(assignedInfo.assetId)}`}
              className="inline-block rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-800 shadow-md transition-all"
            >
              👉 Open My Assigned Machine ({assignedInfo.name})
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
