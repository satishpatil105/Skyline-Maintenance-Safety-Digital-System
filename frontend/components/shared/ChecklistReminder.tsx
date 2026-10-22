"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MachineDue {
  assetId: string;
  name: string;
  dueNow: number;
  dueTomorrow: number;
}

/**
 * Home-page reminder: how many check points are due today, and how many will
 * be due tomorrow, so nobody has to open each machine to find out.
 */
export default function ChecklistReminder() {
  const [machines, setMachines] = useState<MachineDue[] | null>(null);
  const [isWeeklyOff, setIsWeeklyOff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checklist", { cache: "no-store" })
      .then((r) => r.json())
      .then((result) => {
        if (!cancelled) {
          setMachines(result.success ? result.machines : []);
          setIsWeeklyOff(Boolean(result.isWeeklyOff || new Date().getDay() === 0));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMachines([]);
          setIsWeeklyOff(new Date().getDay() === 0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (machines === null || machines.length === 0) {
    return (
      <Link
        href="/checklist"
        className="primary-button mt-0 block bg-green-700 text-center no-underline hover:bg-green-800"
      >
        Fill Operator Checklist
      </Link>
    );
  }

  const dueNow = machines.reduce((sum, m) => sum + m.dueNow, 0);
  const dueTomorrow = machines.reduce((sum, m) => sum + m.dueTomorrow, 0);
  const dueMachines = machines.filter((m) => m.dueNow > 0);

  // Sunday is a Weekly Off: no data needs to be filled, no pending alert
  if (isWeeklyOff) {
    return (
      <section className="card border-l-4 border-l-skyline-blue bg-gradient-to-r from-blue-50/70 to-white" id="checklist-reminder">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-skyline-deep flex items-center gap-2">
            <span>📅</span>
            <span>Checklist reminders</span>
          </h2>
          <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-800 border border-blue-200">
            Weekly Off (Sunday)
          </span>
        </div>

        <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-900 leading-relaxed">
          <strong>Sunday is a weekly off.</strong> Factory operates on <strong>General Shift: 9:00 AM – 8:00 PM (Monday to Saturday)</strong>. No checklist filling or daily inspections are pending today. All routine checkpoints will resume on Monday at 9:00 AM.
        </p>

        {dueTomorrow > 0 && (
          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
            Scheduled for tomorrow (Monday): <strong>{dueTomorrow}</strong> check points across machines.
          </p>
        )}

        <Link
          href="/checklist"
          className="primary-button mt-3 block bg-slate-700 text-center no-underline hover:bg-slate-800"
        >
          View Checklist Schedule
        </Link>
      </section>
    );
  }

  return (
    <section className="card" id="checklist-reminder">
      <h2 className="mb-2 text-lg font-bold text-skyline-deep">Checklist reminders</h2>

      {dueNow > 0 ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <strong>{dueNow}</strong> check point{dueNow === 1 ? " is" : "s are"} due today on{" "}
          <strong>{dueMachines.length}</strong> machine{dueMachines.length === 1 ? "" : "s"}:{" "}
          {dueMachines.map((m) => `${m.name} (${m.dueNow})`).join(", ")}
        </p>
      ) : (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          All checklists are done for today. Well done.
        </p>
      )}

      {dueTomorrow > 0 && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Tomorrow: <strong>{dueTomorrow}</strong> check point{dueTomorrow === 1 ? " will" : "s will"} be due again.
        </p>
      )}

      <Link
        href="/checklist"
        className="primary-button block bg-green-700 text-center no-underline hover:bg-green-800"
      >
        {dueNow > 0 ? "Fill Operator Checklist" : "Open Checklist"}
      </Link>
    </section>
  );
}
