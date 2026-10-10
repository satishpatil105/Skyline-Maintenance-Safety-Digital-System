"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { uploadPhoto } from "@/lib/uploadPhoto";
import {
  FINISHED,
  STATUSES,
  categoryById,
  hiraFigures,
  type CategoryId,
  type DeptField,
} from "@/lib/safetyDeptConfig";
import type { DeptRecord } from "@/lib/safetyDept";
import PhotoInput from "@/components/operator/PhotoInput";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";
import EmployeeSafetyHub from "./EmployeeSafetyHub";

const todayLocal = () => new Date().toLocaleDateString("en-CA");

const RATING_STYLE: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-900 border-emerald-300",
  medium: "bg-amber-100 text-amber-900 border-amber-300",
  high: "bg-orange-100 text-orange-900 border-orange-300",
  critical: "bg-rose-100 text-rose-900 border-rose-300 font-black",
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "-");

type Filter = "all" | "open" | "overdue" | "finished";

// Helper function to extract meaningful values from dynamic MongoDB records
function getRecordDetails(r: DeptRecord) {
  const v = r.values || {};

  // Extract Location / Machine
  const location =
    v["Location / Area"] ||
    v["Location"] ||
    v["Area"] ||
    v["Machine / Equipment"] ||
    v["Department / Section"] ||
    v["Department"] ||
    v["Section"] ||
    v["Plant Area"] ||
    v["Process / Activity"] ||
    v["Workstation"] ||
    v["Site"] ||
    (r.title && r.title !== r.recordId ? r.title : "Main Plant");

  // Extract Safety Type / Title
  const safetyType =
    v["Safety Type"] ||
    v["Check Point"] ||
    v["Category"] ||
    v["Hazard Description"] ||
    v["Activity / Operation"] ||
    v["Aspect / Activity"] ||
    v["Equipment Name"] ||
    r.title ||
    "Safety Audit";

  // Extract Risk Level
  const riskLevel =
    v["Risk Rating"] ||
    v["Severity"] ||
    v["Initial Risk Rating"] ||
    v["Risk Level"] ||
    v["Risk Score"] ||
    "Medium";

  // Extract Action / Recommendation
  const recommendation =
    v["Corrective Action"] ||
    v["Control Measures"] ||
    v["Control Action"] ||
    v["Recommendation"] ||
    v["Mitigation"] ||
    v["Remarks"] ||
    v["Description"] ||
    "Under Review";

  // Extract Date
  const dateVal =
    r.date ||
    v["Date"] ||
    v["Inspection Date"] ||
    v["Audit Date"] ||
    v["Report Date"] ||
    v["Created Date"] ||
    v["Incident Date"] ||
    v["Date Logged"] ||
    v["Date of Inspection"] ||
    v["Logged Date"] ||
    new Date().toISOString().slice(0, 10);

  return { location, safetyType, riskLevel, recommendation, dateVal };
}

export default function SafetyDeptClient({
  category: categoryId,
  canSubmit,
  canClose,
  externalShowForm,
  onToggleForm,
}: {
  category: CategoryId;
  canSubmit: boolean;
  canClose: boolean;
  externalShowForm?: boolean;
  onToggleForm?: () => void;
}) {
  if (categoryId === "employee") {
    return <EmployeeSafetyHub canSubmit={canSubmit} canClose={canClose} />;
  }

  const category = categoryById(categoryId)!;

  const emptyForm = useCallback(() => {
    const v: Record<string, string> = { Date: todayLocal(), Status: "Open", Remarks: "" };
    for (const f of category.fields) v[f.label] = "";
    return v;
  }, [category]);

  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [internalShowForm, setInternalShowForm] = useState(false);
  const showForm = externalShowForm !== undefined ? externalShowForm : internalShowForm;
  const setShowForm = (val?: boolean) => {
    if (onToggleForm) {
      onToggleForm();
    } else {
      setInternalShowForm((s) => (val !== undefined ? val : !s));
    }
  };
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({ type: null, message: "" });
  const [selectedRecord, setSelectedRecord] = useState<DeptRecord | null>(null);

  // Auto-fill logged-in user details if fields exist
  useEffect(() => {
    fetch("/api/reference")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.currentUser) {
          setForm((prev) => {
            const next = { ...prev };
            if ("Responsible Person" in next && !next["Responsible Person"]) {
              next["Responsible Person"] = res.currentUser.name;
            }
            if ("Employee Name" in next && !next["Employee Name"]) {
              next["Employee Name"] = res.currentUser.name;
            }
            if ("Employee ID" in next && !next["Employee ID"] && res.currentUser.userId) {
              next["Employee ID"] = res.currentUser.userId;
            }
            return next;
          });
        }
      })
      .catch(() => undefined);
  }, []);

  const [records, setRecords] = useState<DeptRecord[] | null>(null);
  const [loadError, setLoadError] = useState("");

  // Multiple Top Filters
  const [filter, setFilter] = useState<Filter>("all");
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/safety-dept/${categoryId}`, { cache: "no-store" });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || "Could not load the records.");
      setRecords(result.records);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, filterRisk, filterLocation, search]);

  const figures = useMemo(() => (categoryId === "hira" ? hiraFigures(form) : null), [categoryId, form]);
  const set = (label: string, value: string) => setForm((prev) => ({ ...prev, [label]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus({ type: "info", message: "Saving record to database..." });
    try {
      const body: Record<string, string> = { ...form };
      if (photo) {
        setStatus({ type: "info", message: "Uploading photo..." });
        body["Photo / Evidence"] = await uploadPhoto(photo);
        setStatus({ type: "info", message: "Saving record..." });
      }
      const response = await fetch(`/api/safety-dept/${categoryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.success) {
        setStatus({ type: "success", message: result.message });
        setForm(emptyForm());
        setPhoto(null);
        setShowForm(false);
        setFilter("all");
        await load();
      } else {
        setStatus({ type: "error", message: result.message || "Could not save the record." });
      }
    } catch (error) {
      setStatus({ type: "error", message: "Server Error: " + (error instanceof Error ? error.message : String(error)) });
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const list = records ?? [];
    return {
      all: list.length,
      open: list.filter((r) => !FINISHED.test(r.status)).length,
      overdue: list.filter((r) => r.overdue).length,
      finished: list.filter((r) => FINISHED.test(r.status)).length,
    };
  }, [records]);

  // Unique machine / location options gathered dynamically
  const uniqueLocations = useMemo(() => {
    if (!records) return [];
    const setLocs = new Set<string>();
    records.forEach((r) => {
      const { location } = getRecordDetails(r);
      if (location && location !== "—") setLocs.add(location);
    });
    return Array.from(setLocs).sort();
  }, [records]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (records ?? []).filter((r) => {
      const { location, riskLevel } = getRecordDetails(r);

      // Filter 1: Status
      if (filter === "open" && FINISHED.test(r.status)) return false;
      if (filter === "overdue" && !r.overdue) return false;
      if (filter === "finished" && !FINISHED.test(r.status)) return false;

      // Filter 2: Risk Level
      if (filterRisk !== "all") {
        if (!riskLevel.toLowerCase().includes(filterRisk.toLowerCase())) return false;
      }

      // Filter 3: Machine / Location
      if (filterLocation !== "all" && location !== filterLocation) return false;

      // Filter 4: Text Search
      if (!q) return true;
      return (
        r.recordId.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        location.toLowerCase().includes(q) ||
        riskLevel.toLowerCase().includes(q) ||
        Object.values(r.values).some((v) => v.toLowerCase().includes(q))
      );
    });
  }, [records, filter, filterRisk, filterLocation, search]);

  // Pagination calculations
  const totalPages = Math.ceil(shown.length / rowsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return shown.slice(start, start + rowsPerPage);
  }, [shown, currentPage, rowsPerPage]);

  function renderField(f: DeptField) {
    const id = `f-${slug(f.label)}`;
    const wrap = f.half ? "" : "sm:col-span-2";
    const value = form[f.label] ?? "";

    if (f.computed) return null;
    return (
      <div key={f.label} className={wrap}>
        <label className="field-label" htmlFor={id}>
          {f.label}
          {f.required && <span className="text-[#880b13]"> *</span>}
        </label>
        {f.kind === "select" ? (
          <select id={id} className="field-input" required={f.required} value={value} onChange={(e) => set(f.label, e.target.value)}>
            <option value="">{f.required ? "Select..." : "- none -"}</option>
            {f.options?.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : f.kind === "textarea" ? (
          <textarea id={id} className="field-input min-h-[5rem]" required={f.required} maxLength={2000} placeholder={f.placeholder} value={value} onChange={(e) => set(f.label, e.target.value)} />
        ) : (
          <input
            id={id}
            className="field-input"
            type={f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"}
            min={f.kind === "number" ? 0 : undefined}
            step={f.kind === "number" ? "any" : undefined}
            required={f.required}
            maxLength={300}
            placeholder={f.placeholder}
            value={value}
            onChange={(e) => set(f.label, e.target.value)}
          />
        )}
        {f.help && <p className="mt-1 text-xs text-slate-500">{f.help}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans">
      <StatusBanner type={status.type} message={status.message} />

      {/* RECORD CREATION FORM MODAL / EXPANDABLE SECTION */}
      {showForm && canSubmit && (
        <form className="rounded-2xl bg-white border border-slate-200/90 p-6 shadow-md space-y-4" onSubmit={save}>
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">
              Create New {category.label} Record
            </h3>
            <span className="text-xs font-bold text-[#880b13] bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
              MongoDB Live Entry
            </span>
          </div>

          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="f-date">Date</label>
              <input id="f-date" type="date" className="field-input" required value={form.Date} onChange={(e) => set("Date", e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="f-status">Status</label>
              <select id="f-status" className="field-input" value={form.Status} onChange={(e) => set("Status", e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {category.fields.map(renderField)}

            {figures && (
              <div className="sm:col-span-2" data-testid="risk-box">
                <p className="field-label">Risk Rating Calculation (Likelihood x Severity)</p>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  {(
                    [
                      ["Initial Risk", figures["Risk Score"], figures["Risk Rating"]],
                      ["Residual Risk", figures["Residual Score"], figures["Residual Rating"]],
                    ] as const
                  ).map(([name, score, rating]) => (
                    <div key={name} className="rounded-xl border border-slate-200 p-3 text-xs bg-slate-50">
                      <span className="text-slate-500 font-bold">{name}: </span>
                      {score ? (
                        <strong className={`rounded-lg px-2 py-0.5 border ${RATING_STYLE[rating.toLowerCase()] ?? ""}`}>
                          {score} - {rating}
                        </strong>
                      ) : (
                        <span className="text-slate-400 italic">Select Likelihood &amp; Severity</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400 font-medium">1-4 Low Risk, 5-9 Medium, 10-14 High, 15-25 Critical.</p>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="f-remarks">Remarks &amp; Notes</label>
              <textarea id="f-remarks" className="field-input min-h-[4rem]" maxLength={2000} value={form.Remarks} onChange={(e) => set("Remarks", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <PhotoInput
                id="f-photo"
                label="Photo / Evidence (Optional)"
                required={false}
                helperText="Take photo or upload evidence document. (Optional)"
                onFileSelected={setPhoto}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#880b13] hover:bg-rose-900 px-5 py-2 text-xs font-black text-white shadow-2xs transition disabled:opacity-50 cursor-pointer"
              disabled={saving}
            >
              {saving ? "Saving..." : `Save Record`}
            </button>
          </div>
        </form>
      )}

      {/* SEARCH & 3-4 FILTER DROPDOWNS BAR (MATCHING REFERENCE SCREENSHOT) */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96 lg:w-[450px]">
          <input
            type="search"
            placeholder="Search by ID, title, source, category, check point..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#880b13] focus:ring-1 focus:ring-[#880b13] shadow-2xs transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0 justify-end">
          {/* Filter 1: Status */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#880b13] shadow-2xs transition cursor-pointer"
          >
            <option value="all">All Statuses ({counts.all})</option>
            <option value="open">Open ({counts.open})</option>
            <option value="overdue">Overdue ({counts.overdue})</option>
            <option value="finished">Closed ({counts.finished})</option>
          </select>

          {/* Filter 2: Risk Level */}
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#880b13] shadow-2xs transition cursor-pointer"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
            <option value="critical">Critical Risk</option>
          </select>

          {/* Filter 3: Machine / Location */}
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#880b13] shadow-2xs transition cursor-pointer max-w-[180px] truncate"
          >
            <option value="all">All Machine / Locations</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
      </div>

      {loadError && <StatusBanner type="error" message={loadError} />}
      {!records && !loadError && (
        <div className="py-12 text-center text-slate-400 text-xs font-medium">
          Loading safety records from database...
        </div>
      )}

      {/* HORIZONTAL TABLE WRAPPER WITH SCROLLBAR (MATCHING SCREENSHOT) */}
      {records && (
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto w-full [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-rose-50/70 border-b border-rose-100/90 text-[11px] font-black tracking-wider uppercase text-slate-700">
                  <th className="py-3.5 px-4">RECORD ID</th>
                  <th className="py-3.5 px-4">SAFETY TYPE</th>
                  <th className="py-3.5 px-4">MACHINE / LOCATION</th>
                  <th className="py-3.5 px-4">RISK LEVEL</th>
                  <th className="py-3.5 px-4">ACTION / RECOMMENDATION</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4">DATE</th>
                  <th className="py-3.5 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {!shown.length ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                      No safety records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => {
                    const finished = FINISHED.test(r.status);
                    const { location, safetyType, riskLevel, recommendation, dateVal } = getRecordDetails(r);

                    return (
                      <tr key={r.recordId + r.row} className="hover:bg-rose-50/20 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-black text-[#880b13]">
                          <span className="bg-rose-50 border border-rose-200/80 rounded px-2 py-0.5 text-[11px] shadow-2xs">
                            {r.recordId}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 max-w-[220px] truncate" title={safetyType}>
                          {safetyType}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-[200px] truncate" title={location}>
                          {location}
                        </td>
                        <td className="py-3.5 px-4 font-bold">
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${riskLevel.toLowerCase().includes("high") ? "bg-orange-100 text-orange-800 border border-orange-200" :
                            riskLevel.toLowerCase().includes("critical") ? "bg-rose-100 text-rose-800 border border-rose-200" :
                              riskLevel.toLowerCase().includes("low") ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                                "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}>
                            {riskLevel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-[220px] truncate" title={recommendation}>
                          {recommendation}
                        </td>
                        <td className="py-3.5 px-4">
                          {r.overdue ? (
                            <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                              Overdue
                            </span>
                          ) : /in progress|progress/i.test(r.status) ? (
                            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              In Progress
                            </span>
                          ) : finished ? (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {r.status || "Resolved"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                              {r.status || "Open"}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {dateVal}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(r)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-[#880b13] transition shadow-2xs cursor-pointer"
                            title="Edit record status"
                          >
                            <span>✏️</span>
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION BAR (MATCHING REFERENCE SCREENSHOT) */}
          {shown.length > 0 && (
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-semibold text-slate-500 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Showing <strong className="text-slate-900">{Math.min(shown.length, (currentPage - 1) * rowsPerPage + 1)}</strong>–
                  <strong className="text-slate-900">{Math.min(shown.length, currentPage * rowsPerPage)}</strong> of{" "}
                  <strong className="text-slate-900">{shown.length}</strong> items
                </span>
                <span className="text-slate-300 hidden sm:inline">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#880b13] shadow-2xs transition cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                >
                  ← Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg text-xs font-black transition cursor-pointer ${currentPage === page ? "bg-[#880b13] text-white shadow-2xs" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EDIT RECORD MODAL FOR SUPERVISORS */}
      {selectedRecord && (
        <EditRecordModal
          record={selectedRecord}
          categoryId={categoryId}
          canClose={canClose}
          onClose={() => setSelectedRecord(null)}
          onChanged={async () => {
            setSelectedRecord(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function EditRecordModal({
  record,
  categoryId,
  canClose,
  onClose,
  onChanged,
}: {
  record: DeptRecord;
  categoryId: CategoryId;
  canClose: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const category = categoryById(categoryId)!;
  const [next, setNext] = useState(record.status || "Open");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: StatusType; message: string }>({ type: null, message: "" });

  const finished = FINISHED.test(record.status);
  const full = Object.entries(record.values).filter(([l, v]) => v && !["Record ID", "Status", "Photo / Evidence"].includes(l));
  const photo = record.values["Photo / Evidence"];

  async function changeStatus() {
    setBusy(true);
    setMessage({ type: "info", message: "Updating record status..." });
    try {
      const response = await fetch(`/api/safety-dept/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.recordId, status: next, note }),
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: "success", message: "Record status updated!" });
        setTimeout(onChanged, 400);
      } else {
        setMessage({ type: "error", message: result.message || "Could not update the status." });
      }
    } catch (error) {
      setMessage({ type: "error", message: "Server Error: " + (error instanceof Error ? error.message : String(error)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-[#880b13] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
              {record.recordId}
            </span>
            <h3 className="text-base font-black text-slate-900 mt-1">{record.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <StatusBanner type={message.type} message={message.message} />

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            {full.map(([l, v]) => (
              <div key={l}>
                <dt className="text-[10px] font-black text-slate-400 uppercase">{l}</dt>
                <dd className="font-semibold text-slate-800 break-words">{v}</dd>
              </div>
            ))}
          </dl>

          {photo && (
            <p className="text-xs">
              <a href={photo} target="_blank" rel="noreferrer" className="font-bold text-[#880b13] underline">
                📷 View Evidence Photo
              </a>
            </p>
          )}
        </div>

        {canClose && (
          <div className="border-t border-slate-100 pt-3 space-y-3 text-xs">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="st-modal">Update Status</label>
                <select id="st-modal" className="field-input" value={next} onChange={(e) => setNext(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="note-modal">Resolution Note</label>
                <input id="note-modal" className="field-input" placeholder="Optional resolution note..." maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                Close
              </button>
              <button
                type="button"
                disabled={busy || next === record.status}
                onClick={changeStatus}
                className="rounded-xl bg-[#880b13] text-white px-5 py-2 text-xs font-black hover:bg-rose-900 disabled:opacity-40 cursor-pointer"
              >
                {busy ? "Updating..." : "Save Status"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
