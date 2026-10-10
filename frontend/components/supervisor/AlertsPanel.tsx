"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StatusBanner from "@/components/shared/StatusBanner";

interface AlertItem {
  id: string;
  type: string;
  assetId: string;
  machine: string;
  message: string;
  priority: string;
  assignedTo: string;
  status: string;
  dueDate: string;
  daysLeft: number | null;
}

const PRIORITY_STYLE: Record<string, string> = {
  critical: "border-l-red-800",
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-400",
};

const SHOW_FIRST = 6;

/** 2026-09-25 -> 25-09-2026 */
const display = (iso: string) => iso.split("-").reverse().join("-");

function dueLabel(days: number | null, iso: string): { text: string; overdue: boolean } {
  if (days === null) return { text: "No due date", overdue: false };
  if (days < 0) return { text: `OVERDUE by ${-days} day${days === -1 ? "" : "s"}`, overdue: true };
  if (days === 0) return { text: "Due today", overdue: true };
  return { text: `Due in ${days} day${days === 1 ? "" : "s"} (${display(iso)})`, overdue: false };
}

/**
 * The open alerts from the Notifications sheet: parts to change, documents and
 * AMCs about to expire, safety actions and requests that are running late.
 * Pass an asset ID to show only that machine's alerts.
 */
export default function AlertsPanel({
  assetId,
  canClose = true,
}: {
  assetId?: string;
  /** Whether this person may mark an alert as done ("Can Approve Close"). */
  canClose?: boolean;
}) {
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const url = assetId ? `/api/notifications?assetId=${encodeURIComponent(assetId)}` : "/api/notifications";
      const result = await (await fetch(url, { cache: "no-store" })).json();
      setAlerts(result.success ? result.alerts : []);
    } catch {
      setAlerts([]);
    }
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  async function close(id: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", id }),
      });
      const result = await response.json();
      if (result.success) setAlerts((prev) => (prev ?? []).filter((a) => a.id !== id));
      else setError(result.message || "Could not close the alert.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  if (alerts === null) return null;

  const overdue = alerts.filter((a) => a.daysLeft !== null && a.daysLeft <= 0).length;
  const shown = showAll ? alerts : alerts.slice(0, SHOW_FIRST);

  return (
    <section className="card" id="alerts-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-200 pb-2.5">
        <h2 className="text-lg font-bold text-skyline-deep">
          {assetId ? "Alerts for this machine" : "Alerts"}
        </h2>
        {alerts.length > 0 && (
          <span className="flex gap-2 text-xs font-bold">
            {overdue > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">{overdue} due / overdue</span>
            )}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{alerts.length} open</span>
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          No alerts. Everything is up to date.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {shown.map((a, i) => {
            const due = dueLabel(a.daysLeft, a.dueDate);
            return (
              <li
                key={a.id || i}
                className={`rounded-lg border border-slate-200 border-l-4 bg-white p-3 text-sm ${
                  PRIORITY_STYLE[a.priority.toLowerCase()] ?? "border-l-slate-300"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                    {a.type || "Alert"}
                  </span>
                  <span className={`text-xs font-bold ${due.overdue ? "text-red-700" : "text-slate-600"}`}>
                    {due.text}
                  </span>
                </div>
                <p className="mt-1.5 text-slate-800">{a.message}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {a.priority && <strong className="text-slate-700">{a.priority} priority</strong>}
                    {a.assignedTo && ` · ${a.assignedTo}`}
                    {!assetId && a.assetId && (
                      <>
                        {" · "}
                        <Link href={`/machine/${encodeURIComponent(a.assetId)}`} className="font-bold text-skyline-deep underline">
                          {a.machine || a.assetId}
                        </Link>
                      </>
                    )}
                  </span>
                  {canClose && a.id && (
                    <button
                      type="button"
                      disabled={busy === a.id}
                      onClick={() => close(a.id)}
                      className="rounded border border-skyline-deep px-3 py-1 font-bold text-skyline-deep hover:bg-slate-50 disabled:opacity-50"
                    >
                      {busy === a.id ? "Closing..." : "Mark done"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {alerts.length > SHOW_FIRST && (
        <button
          type="button"
          className="mt-3 text-sm font-bold text-skyline-deep underline"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show fewer" : `Show all ${alerts.length} alerts`}
        </button>
      )}
      <StatusBanner type={error ? "error" : null} message={error} />
    </section>
  );
}
