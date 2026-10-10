"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import type { ChecklistEntry } from "@/lib/checklist";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";
import SiteHeader from "@/components/shared/SiteHeader";
import SiteFooter from "@/components/shared/SiteFooter";
import UserBar from "@/components/shared/UserBar";
import PhotoInput from "./PhotoInput";
import { uploadPhoto } from "@/lib/uploadPhoto";

interface MachineOption {
  assetId: string;
  name: string;
  category: string;
  checkPoints: number;
  dueNow: number;
  dueTomorrow: number;
}

interface Checklist {
  machine: { assetId: string; name: string; category: string };
  today: string;
  isWeeklyOff?: boolean;
  entries: ChecklistEntry[];
  counts: { due: number; locked: number; dueTomorrow: number };
  nextUnlock: { date: string; label: string } | null;
}

interface Answer {
  response: string;
  remarks: string;
  file: File | null;
}

interface NextDue {
  frequency: string;
  count: number;
  date: string;
  label: string;
}

const MACHINE_ABBREVIATIONS: Record<string, string[]> = {
  laser: ["lsr", "laser"],
  bending: ["bnd", "bending"],
  shearing: ["shr", "shearing", "sharing"],
  sharing: ["shr", "shearing", "sharing"],
  punching: ["pnc", "pun", "tpp", "punch"],
  punch: ["pnc", "pun", "tpp", "punch"],
  powder: ["pdr", "powder"],
  compressor: ["cmp", "acm", "compressor"],
  crane: ["crn", "eot", "crane"],
  welding: ["wld", "welding", "co2"],
  drill: ["drl", "drill"],
  oven: ["ovn", "oven"],
  stabilizer: ["stb", "stabilizer"],
  panel: ["elp", "pnl", "panel"],
  pneumatic: ["pnm", "pneumatic"],
  booth: ["spb", "booth"],
  gun: ["gun"],
  grinder: ["grd", "grander", "grinder"],
  ups: ["ups"],
};

function expandDepartmentTokens(dept: string): string[] {
  const raw = dept.toLowerCase().split(/[\s/,-]+/).filter((t) => t.length > 1 && t !== "machine");
  const set = new Set<string>(raw);
  for (const t of raw) {
    if (MACHINE_ABBREVIATIONS[t]) {
      for (const a of MACHINE_ABBREVIATIONS[t]) set.add(a);
    }
  }
  return Array.from(set);
}

function isMachineOptionAuthorized(
  user: SessionUser,
  m: { assetId?: string; name?: string; category?: string; department?: string }
): boolean {
  if (user.role === "Admin" || !user.departmentMachine) return true;
  const dept = user.departmentMachine.trim().toLowerCase();
  const name = (m.name || "").toLowerCase();
  const assetId = (m.assetId || "").toLowerCase();
  const cat = (m.category || "").toLowerCase();
  const tokens = expandDepartmentTokens(dept);

  return (
    dept === name ||
    dept === assetId ||
    dept === cat ||
    name.includes(dept) ||
    dept.includes(name) ||
    (tokens.length > 0 &&
      tokens.some(
        (t) =>
          name.includes(t) ||
          cat.includes(t) ||
          assetId.includes(t) ||
          assetId.replace(/[^a-z0-9]/g, "").includes(t)
      ))
  );
}

const isBad = (response: string) => /^(not ok|no|fail|failed)$/i.test(response.trim());
const isGood = (response: string) => /^(ok|yes|pass|passed)$/i.test(response.trim());

function answerStyle(response: string) {
  if (!response) return "border-slate-300 bg-white text-slate-500";
  if (isBad(response)) return "border-red-500 bg-red-50 text-red-800 ring-1 ring-red-400";
  if (isGood(response)) return "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400";
  return "border-slate-400 bg-slate-100 text-slate-700";
}

const chipFor = (response: string) =>
  isBad(response)
    ? "bg-red-100 text-red-800"
    : isGood(response)
      ? "bg-green-100 text-green-800"
      : "bg-slate-200 text-slate-700";

const niceLongDate = (iso: string) => {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length === 3) {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const month = months[monthIndex] || parts[1];
    return `${parseInt(parts[2], 10)} ${month} ${parts[0]}`;
  }
  return iso;
};

export default function ChecklistForm({
  user,
  initialAsset,
}: {
  user: SessionUser;
  initialAsset: string;
}) {
  const [openPhotos, setOpenPhotos] = useState<Record<string, boolean>>({});
  const [machines, setMachines] = useState<MachineOption[] | null>(null);
  const [assetId, setAssetId] = useState(initialAsset || "");
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({ type: null, message: "" });
  const [done, setDone] = useState<{ message: string; notOk: number; next: NextDue[] } | null>(null);

  // Track the currently loaded asset to avoid answer wipeout on re-render
  const loadedAssetRef = useRef<string>("");

  const [today, setToday] = useState("October 10, 2026");

  useEffect(() => {
    const d = new Date();
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    setToday(`${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`);
  }, []);

  const loadChecklist = useCallback(
    async (asset: string, keepMessage = false, clearAnswers = false) => {
      if (!asset) {
        setChecklist(null);
        loadedAssetRef.current = "";
        return;
      }

      setLoading(true);
      if (!keepMessage) setStatus({ type: null, message: "" });
      try {
        const response = await fetch(`/api/checklist?assetId=${encodeURIComponent(asset)}`, { cache: "no-store" });
        if (response.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent("/checklist")}`;
          return;
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || "Could not load the checklist.");
        }

        setChecklist(result);
        loadedAssetRef.current = asset;

        if (clearAnswers) {
          setAnswers({});
          setShowErrors(false);
        }
      } catch (error) {
        setChecklist(null);
        setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadMachines = useCallback(async () => {
    try {
      const response = await fetch("/api/checklist", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/checklist")}`;
        return;
      }
      const result = await response.json();
      if (!result.success) throw new Error(result.message || "Could not load machines.");
      const list: MachineOption[] = result.machines || [];
      setMachines(list);

      // Auto-select machine if operator has none selected
      if (user.role !== "Admin" && user.departmentMachine && !loadedAssetRef.current) {
        const myMachine = list.find((m) => isMachineOptionAuthorized(user, m));
        if (myMachine) {
          setAssetId(myMachine.assetId);
          loadChecklist(myMachine.assetId, false, false);
        }
      }
    } catch (error) {
      setMachines([]);
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, [user, loadChecklist]);

  // Initial mount: load machines and initial asset once without loop
  useEffect(() => {
    loadMachines();
    if (initialAsset) {
      loadChecklist(initialAsset, false, false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Synchronize when initialAsset prop changes externally (e.g. router navigation)
  useEffect(() => {
    if (initialAsset && initialAsset !== loadedAssetRef.current) {
      setAssetId(initialAsset);
      loadChecklist(initialAsset, false, true);
    }
  }, [initialAsset, loadChecklist]);

  function handleMachineChange(newAsset: string) {
    if (newAsset === assetId) return;
    setAssetId(newAsset);
    setAnswers({});
    setShowErrors(false);
    setStatus({ type: null, message: "" });
    loadChecklist(newAsset, false, true);
  }

  function setAnswer(templateId: string, patch: Partial<Answer>) {
    setAnswers((prev) => ({
      ...prev,
      [templateId]: { ...({ response: "", remarks: "", file: null } as Answer), ...prev[templateId], ...patch },
    }));
  }

  const dueEntries = useMemo(() => checklist?.entries.filter((e) => e.status === "due") ?? [], [checklist]);
  const lockedEntries = useMemo(() => checklist?.entries.filter((e) => e.status === "locked") ?? [], [checklist]);
  const answered = dueEntries.filter((i) => (answers[i.templateId]?.response ?? "").trim()).length;

  // Due check points grouped Category-wise
  const categoryGroups = useMemo(() => {
    const map = new Map<string, ChecklistEntry[]>();
    for (const e of dueEntries) {
      const cat = (e.category || "General").trim();
      map.set(cat, [...(map.get(cat) ?? []), e]);
    }
    return [...map.entries()];
  }, [dueEntries]);

  /** What is still wrong with an item (used for both red hints and submit validation). */
  function problemsFor(item: ChecklistEntry): string | null {
    const a = answers[item.templateId];
    const response = (a?.response ?? "").trim();
    if (!response) return "Choose an answer";
    if (item.inputType === "number" && !Number.isFinite(Number(response))) return "Enter a valid number";
    if (isBad(response) && !(a?.remarks ?? "").trim()) return "Add a note explaining the issue";
    return null;
  }

  async function submit() {
    if (!checklist) return;
    setShowErrors(true);

    const firstBad = dueEntries.find((i) => problemsFor(i));
    if (firstBad) {
      const count = dueEntries.filter((i) => problemsFor(i)).length;
      setStatus({
        type: "error",
        message: `${count} check point${count === 1 ? " needs" : "s need"} attention (marked in red).`,
      });
      const el = document.getElementById(`item-${firstBad.templateId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = el.querySelector<HTMLElement>("input, select, textarea, button");
        focusable?.focus();
      }
      return;
    }

    setSubmitting(true);
    try {
      const hasFiles = dueEntries.some((i) => answers[i.templateId]?.file);
      if (hasFiles) {
        setStatus({ type: "info", message: "Uploading photo & evidence files..." });
      }

      const uploadedAnswers = await Promise.all(
        dueEntries.map(async (i) => {
          const a = answers[i.templateId];
          let photoUrl = "";
          if (a?.file) {
            photoUrl = await uploadPhoto(a.file);
          }
          return {
            templateId: i.templateId,
            response: a?.response ?? "",
            remarks: a?.remarks ?? "",
            photo: photoUrl,
          };
        })
      );

      setStatus({ type: "info", message: "Saving checklist..." });
      const response = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: checklist.machine.assetId,
          answers: uploadedAnswers,
        }),
      });
      const result = await response.json();

      if (result.success) {
        setDone({ message: result.message, notOk: result.notOk ?? 0, next: result.next ?? [] });
        setStatus({ type: null, message: "" });
        loadMachines();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setStatus({ type: "error", message: result.message || "Could not save the checklist." });
        if (response.status === 409) await loadChecklist(assetId, true, false);
      }
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    setDone(null);
    setAnswers({});
    setShowErrors(false);
    if (assetId) loadChecklist(assetId, false, true);
  }

  const selectedMachine = machines?.find((m) => m.assetId === assetId);

  return (
    <>
      {/* Compact Corporate Branded Header */}
      <header className="bg-gradient-to-r from-[#880b13] via-[#a00d17] to-slate-900 text-white px-3.5 sm:px-6 py-3.5 shadow-md border-b border-[#a00d17]">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <span
              role="img"
              aria-label="Skyline logo"
              className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-full bg-white shadow-md ring-2 ring-white/60 brand-badge"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-base font-black tracking-tight leading-tight text-white truncate">
                Skyline Project &amp; Engineers Pvt. Ltd.
              </h1>
              <p className="text-[11px] font-extrabold text-rose-200 truncate">
                Operator Shift Checklist · {selectedMachine?.name || assetId || "Machine"} ({assetId || "Checklist"})
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            {(() => {
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
                <Link
                  href={backHref}
                  className="rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 px-3 py-1 text-xs font-black text-white border border-white/20 shrink-0 flex items-center gap-1 transition-all"
                >
                  <span>←</span>
                  <span>{backLabel}</span>
                </Link>
              );
            })()}
            <span suppressHydrationWarning className="rounded-xl bg-white/15 px-3 py-1 text-[11px] font-bold text-white border border-white/20 shrink-0">
              {today}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-36">

        {/* Global status banner at the top of the form */}
        {status.message && (
          <div className="sticky top-2 z-20">
            <StatusBanner type={status.type} message={status.message} />
          </div>
        )}

        {done ? (
          <section className="card text-center shadow-lg border border-emerald-200">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-extrabold text-emerald-700">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-skyline-deep">Checklist Submitted Successfully</h2>
            <p className="mt-2 text-sm text-slate-700">{done.message}</p>

            {done.notOk > 0 && (
              <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm font-bold text-amber-900 shadow-sm">
                ⚠️ {done.notOk} checkpoint{done.notOk === 1 ? "" : "s"} marked Not OK {done.notOk === 1 ? "was" : "were"} recorded as open maintenance issues for the engineering team.
              </p>
            )}

            {done.next.length > 0 && (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/40 p-4 text-left shadow-sm">
                <p className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <span>🔒</span>
                  <span>These check points are now locked. Next scheduled inspections:</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-blue-950">
                  {done.next.map((n) => (
                    <li key={n.frequency} className="flex items-center justify-between border-b border-blue-100 pb-1 last:border-0">
                      <span>
                        <strong className="font-bold text-blue-900">{n.frequency}</strong> ({n.count} checkpoint{n.count === 1 ? "" : "s"})
                      </span>
                      <span className="font-extrabold text-blue-800 rounded bg-white/80 px-2 py-0.5 border border-blue-200">
                        {n.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-blue-800">
                  Daily checkpoints unlock automatically tomorrow morning. Not OK items come back tomorrow for routine re-inspection.
                </p>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="primary-button !mt-0 shadow-md"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startAnother();
                }}
              >
                Back to this machine
              </button>
              <Link href="/" className="primary-button !mt-0 block bg-slate-600 text-center no-underline hover:bg-slate-700 shadow-md">
                Back to home
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Machine Selection Card */}
            <section className="card shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="field-label !mt-0" htmlFor="checklistMachine">
                  Machine <span className="text-red-600">*</span>
                </label>
                {user.role !== "Admin" && user.departmentMachine && (
                  <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <span>🚜</span>
                    <span>Assigned: {user.departmentMachine}</span>
                  </span>
                )}
              </div>
              <select
                id="checklistMachine"
                className="field-input mt-2"
                value={assetId}
                disabled={machines === null}
                onChange={(e) => {
                  e.stopPropagation();
                  handleMachineChange(e.target.value);
                }}
              >
                {machines
                  ?.filter((m) => isMachineOptionAuthorized(user, m))
                  .map((m) => (
                    <option key={m.assetId} value={m.assetId}>
                      ✓ {m.name} ({m.assetId}) {m.dueNow > 0 ? `- ${m.dueNow} due` : "- all completed"}
                    </option>
                  ))}
              </select>
              {machines && machines.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  No machine has an active checklist yet. Checkpoints are defined in the Checklist Master tab.
                </p>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                <span>Operator: <strong>{user.name}</strong></span>
                {selectedMachine && (
                  <span className="font-semibold text-slate-600">Category: {selectedMachine.category}</span>
                )}
              </div>
            </section>

            {loading && (
              <div className="card text-center py-8">
                <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-skyline-deep" />
                <p className="text-sm font-semibold text-slate-600">Loading machine checklist...</p>
              </div>
            )}

            {checklist && !loading && (
              <>
                {/* Modern Workstation Stats Summary Cards */}
                <section className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-gradient-to-br from-rose-50/80 via-white to-rose-100/50 p-4 border border-rose-200/90 shadow-xs">
                    <span className="text-2xl sm:text-3xl font-black text-[#880b13] block leading-none">{checklist.counts.due}</span>
                    <span className="text-[11px] font-extrabold text-rose-900 uppercase tracking-wider mt-1.5 block">To Fill Now</span>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100/70 p-4 border border-slate-200 shadow-xs">
                    <span className="text-2xl sm:text-3xl font-black text-slate-700 block leading-none">{checklist.counts.locked}</span>
                    <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mt-1.5 block">Locked (Done)</span>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-amber-50/80 via-white to-amber-100/50 p-4 border border-amber-200/90 shadow-xs">
                    <span className="text-2xl sm:text-3xl font-black text-amber-600 block leading-none">{checklist.counts.dueTomorrow}</span>
                    <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider mt-1.5 block">Due Tomorrow</span>
                  </div>
                </section>

                {dueEntries.length === 0 && (
                  <section className="rounded-2xl bg-white p-8 text-center shadow-md border border-emerald-200 space-y-3">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl font-extrabold text-emerald-800 shadow-inner">
                      {checklist.isWeeklyOff ? "📅" : "✓"}
                    </div>
                    <h2 className="text-xl font-black text-slate-900">
                      {checklist.isWeeklyOff
                        ? `Sunday is Weekly Off for ${checklist.machine.name}`
                        : `All checks for ${checklist.machine.name} are completed`}
                    </h2>
                    {checklist.isWeeklyOff ? (
                      <p className="text-xs text-slate-600 max-w-md mx-auto">
                        No checklist submissions are required on Sunday. Routine inspections will resume on{" "}
                        <strong>
                          Monday ({checklist.nextUnlock ? niceLongDate(checklist.nextUnlock.date) : "tomorrow"})
                        </strong>.
                      </p>
                    ) : (
                      checklist.nextUnlock && (
                        <p className="text-xs text-slate-600 max-w-md mx-auto">
                          Next scheduled check: <strong>{checklist.nextUnlock.label}</strong>
                          {" "}({niceLongDate(checklist.nextUnlock.date)})
                        </p>
                      )
                    )}
                  </section>
                )}

                {/* Grouped Category Checkpoints */}
                {categoryGroups.map(([category, list]) => (
                  <section key={category} className="rounded-2xl bg-white overflow-hidden shadow-md border border-slate-200/90 space-y-0">
                    <div className="border-b border-slate-200/90 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                      <h2 className="font-black text-white flex items-center gap-2.5 text-sm sm:text-base">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                        <span>{category}</span>
                        <span className="text-xs font-bold text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                          {list.length} checkpoint{list.length === 1 ? "" : "s"}
                        </span>
                      </h2>
                      <span className="text-xs font-extrabold px-3 py-1 rounded-lg bg-white/15 text-rose-200 border border-white/20">
                        {checklist.machine.name}
                      </span>
                    </div>

                    <ol className="divide-y divide-slate-100">
                      {list.map((item) => {
                        const index = dueEntries.findIndex((e) => e.templateId === item.templateId) + 1;
                        const a = answers[item.templateId];
                        const response = a?.response ?? "";
                        const problem = showErrors ? problemsFor(item) : null;

                        return (
                          <li
                            key={item.templateId}
                            id={`item-${item.templateId}`}
                            className={`p-5 transition-all duration-200 ${problem ? "bg-red-50/80 border-l-4 border-l-red-600" : "hover:bg-slate-50/60"}`}
                          >
                            <div className="flex items-start gap-3.5">
                              <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-[#880b13] to-slate-900 text-xs font-black text-white shadow-md border border-white/20">
                                #{index < 10 ? `0${index}` : index}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-slate-900 text-base leading-snug">{item.checkPoint}</p>

                                {item.standardRequirement && (
                                  <div className="mt-2.5 flex items-start gap-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 p-3 text-xs text-amber-950 shadow-2xs">
                                    <span className="font-black text-amber-900 uppercase tracking-wider text-[10px] flex-none py-0.5 px-2 rounded bg-amber-200/80 border border-amber-300">
                                      🎯 Target Standard
                                    </span>
                                    <span className="font-semibold text-amber-900 leading-relaxed self-center">
                                      {item.standardRequirement}
                                    </span>
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                  <span className="text-[11px] font-mono text-slate-400 font-bold">{item.templateId}</span>
                                  <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-extrabold text-slate-700 border border-slate-200">
                                    {item.frequency}
                                  </span>
                                  {item.overdueDays > 0 && (
                                    <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-black text-red-700 border border-red-200">
                                      {item.nextDueLabel}
                                    </span>
                                  )}
                                  {item.requiredPhoto && (
                                    <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-extrabold text-sky-800 border border-sky-200 flex items-center gap-1">
                                      📸 Photo Optional
                                    </span>
                                  )}
                                  {item.last && isBad(item.last.response) && (
                                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-900 border border-amber-300">
                                      ⚠️ Re-check (Previous: Not OK)
                                    </span>
                                  )}
                                </div>

                                {/* Touch-Friendly High-Contrast OK / Not OK / NA Toggle Buttons */}
                                {item.inputType === "select" && item.options.length <= 4 ? (
                                  <div className="mt-3.5">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                      {item.options.map((option) => {
                                        const isSelected = response.toLowerCase() === option.toLowerCase();
                                        const isOptBad = isBad(option);
                                        const isOptGood = isGood(option);

                                        let btnStyle = "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400";
                                        if (isSelected) {
                                          if (isOptBad) {
                                            btnStyle = "border-rose-600 bg-rose-600 text-white font-black shadow-lg ring-2 ring-rose-400 scale-[1.02]";
                                          } else if (isOptGood) {
                                            btnStyle = "border-emerald-600 bg-emerald-600 text-white font-black shadow-lg ring-2 ring-emerald-400 scale-[1.02]";
                                          } else {
                                            btnStyle = "border-slate-800 bg-slate-800 text-white font-black shadow-lg ring-2 ring-slate-400 scale-[1.02]";
                                          }
                                        } else {
                                          if (isOptBad) {
                                            btnStyle = "border-rose-200 bg-rose-50/70 text-rose-800 hover:bg-rose-100 hover:border-rose-300";
                                          } else if (isOptGood) {
                                            btnStyle = "border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300";
                                          } else {
                                            btnStyle = "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100";
                                          }
                                        }

                                        return (
                                          <button
                                            key={option}
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setAnswer(item.templateId, { response: option });
                                            }}
                                            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border-2 px-3 sm:px-5 py-2.5 text-xs sm:text-sm font-black transition-all duration-200 active:scale-95 cursor-pointer shadow-xs ${btnStyle}`}
                                          >
                                            <span className="text-sm sm:text-base font-black">{isOptGood ? "✓" : isOptBad ? "✕" : "—"}</span>
                                            <span className="whitespace-nowrap">{option}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <input
                                      type="hidden"
                                      id={`ans-${item.templateId}`}
                                      value={response}
                                    />
                                  </div>
                                ) : item.inputType === "select" ? (
                                  <select
                                    id={`ans-${item.templateId}`}
                                    aria-label={`Answer for ${item.checkPoint}`}
                                    className={`mt-2.5 w-full rounded-xl border-2 px-3 py-3 text-base font-bold transition-colors ${answerStyle(response)}`}
                                    value={response}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setAnswer(item.templateId, { response: e.target.value });
                                    }}
                                  >
                                    <option value="">Select answer...</option>
                                    {item.options.map((o) => (
                                      <option key={o} value={o}>
                                        {o}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    id={`ans-${item.templateId}`}
                                    aria-label={`Answer for ${item.checkPoint}`}
                                    type={item.inputType === "number" ? "number" : "text"}
                                    inputMode={item.inputType === "number" ? "decimal" : undefined}
                                    autoComplete="off"
                                    placeholder={item.inputType === "number" ? "Enter reading / measurement..." : "Enter observations..."}
                                    className="field-input mt-2.5"
                                    value={response}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setAnswer(item.templateId, { response: e.target.value });
                                    }}
                                  />
                                )}

                                {/* Problem Details Box for Not OK responses */}
                                {isBad(response) && (
                                  <div className="mt-3.5 rounded-xl border border-red-300 bg-red-50/80 p-3.5 shadow-sm">
                                    {item.actionIfNotOk && (
                                      <p className="text-xs font-bold text-red-900 mb-2">
                                        <span className="underline">Required Action if Not OK:</span> {item.actionIfNotOk}
                                      </p>
                                    )}
                                    <label className="field-label !mt-0 text-red-900 font-bold" htmlFor={`note-${item.templateId}`}>
                                      What is wrong? Describe the defect <span className="text-red-600">*</span>
                                    </label>
                                    <textarea
                                      id={`note-${item.templateId}`}
                                      rows={2}
                                      autoComplete="off"
                                      className="field-input mt-1 border-red-300 bg-white"
                                      placeholder="Explain the issue or fault encountered..."
                                      value={a?.remarks ?? ""}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        setAnswer(item.templateId, { remarks: e.target.value });
                                      }}
                                    />
                                  </div>
                                )}

                                {/* Optional Photo / Evidence Input */}
                                {(item.requiredPhoto || isBad(response) || a?.file || openPhotos[item.templateId]) ? (
                                  <div className="mt-3.5 pt-3 border-t border-slate-200/80">
                                    <PhotoInput
                                      id={`chk-photo-${item.templateId}`}
                                      label="Photo / Evidence (Optional)"
                                      required={false}
                                      helperText="Open camera for live capture or upload an inspection photo/file. (Optional — attach if available)"
                                      onFileSelected={(file) => setAnswer(item.templateId, { file })}
                                    />
                                  </div>
                                ) : (
                                  <div className="mt-2.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setOpenPhotos((prev) => ({ ...prev, [item.templateId]: true }));
                                      }}
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-skyline-deep transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
                                    >
                                      <span>📷</span>
                                      <span>+ Attach Photo / Evidence</span>
                                    </button>
                                  </div>
                                )}

                                {problem && (
                                  <p className="mt-2 text-xs font-extrabold text-red-600 flex items-center gap-1">
                                    <span>⚠️</span>
                                    <span>{problem}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}

                {/* Locked (Done) Section */}
                {lockedEntries.length > 0 && (
                  <details className="card !p-0 overflow-hidden shadow-sm border border-slate-200" open={dueEntries.length === 0}>
                    <summary className="cursor-pointer select-none bg-slate-50 px-4 py-3 font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span>🔒</span>
                        <span>Locked: already done today ({lockedEntries.length})</span>
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {checklist.nextUnlock ? `Next check ${checklist.nextUnlock.label}` : ""}
                      </span>
                    </summary>
                    <ul className="divide-y divide-slate-100" id="locked-list">
                      {lockedEntries.map((item) => (
                        <li key={item.templateId} className="flex items-start gap-3 bg-slate-50/60 p-4" data-locked={item.templateId}>
                          <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-600">
                            🔒
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-slate-700">{item.checkPoint}</p>
                              <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {item.category}
                              </span>
                            </div>

                            {item.standardRequirement && (
                              <p className="mt-1 text-xs text-slate-600">
                                <span className="font-semibold text-slate-700">Standard / Requirement: </span>
                                <span>{item.standardRequirement}</span>
                              </p>
                            )}

                            <p className="mt-1 text-xs text-slate-400">
                              {item.templateId} · {item.frequency}
                              {item.last && (
                                <>
                                  {" "}· done {item.last.date}
                                  {item.last.by ? ` by ${item.last.by}` : ""}
                                </>
                              )}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              {item.last && (
                                <span className={`rounded px-1.5 py-0.5 font-bold ${chipFor(item.last.response)}`}>
                                  {item.last.response}
                                </span>
                              )}
                              <span
                                className={`rounded px-1.5 py-0.5 font-bold ${item.nextDueLabel === "tomorrow" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                                  }`}
                              >
                                Next check: {item.nextDueLabel}
                              </span>
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Ultra-Modern Sticky Bottom Submission Bar */}
      {!done && checklist && dueEntries.length > 0 && !loading && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-3.5 shadow-[0_-6px_25px_rgba(0,0,0,0.12)]">
          <div className="mx-auto flex max-w-3xl flex-col sm:flex-row items-center justify-between gap-3.5">
            <div className="w-full sm:flex-1">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span className="flex items-center gap-1.5">
                  <span>📊</span>
                  <span>Inspection Progress: {answered} of {dueEntries.length} answered</span>
                </span>
                <span className="font-extrabold text-[#880b13] bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                  {Math.round((answered / dueEntries.length) * 100)}%
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200/80 p-0.5 border border-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#880b13] via-rose-700 to-emerald-600 transition-all duration-300 shadow-xs"
                  style={{ width: `${(answered / dueEntries.length) * 100}%` }}
                />
              </div>
              {showErrors && dueEntries.some((i) => problemsFor(i)) && (
                <p className="mt-1 text-[11px] font-black text-rose-700 animate-pulse flex items-center gap-1">
                  <span>⚠️</span>
                  <span>{dueEntries.filter((i) => problemsFor(i)).length} check point{dueEntries.filter((i) => problemsFor(i)).length === 1 ? "" : "s"} still need attention.</span>
                </p>
              )}
            </div>

            <button
              type="button"
              className="primary-button !mt-0 w-full sm:w-auto px-8 py-3.5 text-base font-black shadow-xl hover:shadow-2xl bg-gradient-to-r from-[#880b13] via-[#a00d17] to-slate-900 text-white rounded-xl hover:opacity-95 transition-all border border-white/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                submit();
              }}
            >
              <span>{submitting ? "⏳" : "✓"}</span>
              <span>{submitting ? "Submitting Checklist..." : "Submit Checklist"}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
