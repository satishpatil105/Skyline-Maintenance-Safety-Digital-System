"use client";

import { useState } from "react";
import Link from "next/link";
import type { Row } from "./UserMasterTable";

interface MachineMasterTableProps {
    rows: Row[];
    onEdit: (row: Row) => void;
    onDelete: (row: Row) => void;
}

export default function MachineMasterTable({
    rows,
    onEdit,
    onDelete,
}: MachineMasterTableProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [deptFilter, setDeptFilter] = useState("all");
    const [critFilter, setCritFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const normalizeDepartment = (val: string): string => {
        const d = (val || "").trim();
        if (!d) return "";
        const lower = d.toLowerCase();
        if (/maint/i.test(lower)) return "Maintenance";
        if (/prod/i.test(lower)) return "Production";
        if (/qual/i.test(lower)) return "Quality";
        if (/util/i.test(lower)) return "Utility";
        if (/tool/i.test(lower)) return "Tooling";
        if (/elect/i.test(lower)) return "Electrical";
        return d.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
    };

    const departments = Array.from(
        new Set(
            rows
                .map((r) => normalizeDepartment(r["Department"] || r["department"] || ""))
                .filter(Boolean)
        )
    ).sort();

    const filtered = rows.filter((r) => {
        const s = search.toLowerCase().trim();
        const matchesSearch =
            !s ||
            (r["Asset ID"] || r["assetId"] || r["Machine ID"] || "").toLowerCase().includes(s) ||
            (r["Name"] || r["machineName"] || r["Machine Name"] || "").toLowerCase().includes(s) ||
            (r["Department"] || r["department"] || "").toLowerCase().includes(s) ||
            (r["Location"] || r["location"] || "").toLowerCase().includes(s) ||
            (r["AMC Vendor"] || r["amcVendor"] || "").toLowerCase().includes(s);

        const statusVal = (r["Status"] || r["status"] || "").toLowerCase();
        const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "running" && /running|active|operational/i.test(statusVal)) ||
            (statusFilter === "maintenance" && /maintenance|scheduled|pm/i.test(statusVal)) ||
            (statusFilter === "standby" && /standby|auxiliary/i.test(statusVal));

        const matchesDept = deptFilter === "all" || normalizeDepartment(r["Department"] || r["department"] || "") === deptFilter;
        const matchesCrit = critFilter === "all" || (r["Criticality"] || r["criticality"] || "") === critFilter;

        return matchesSearch && matchesStatus && matchesDept && matchesCrit;
    });

    const hasActiveFilters = search || statusFilter !== "all" || deptFilter !== "all" || critFilter !== "all";

    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const pageRows = filtered.slice(startIndex, endIndex);

    return (
        <div className="space-y-3.5 w-full">
            {/* FILTER TOOLBAR */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search machines by ID, name, location, department, AMC..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-skyline-deep focus:bg-white focus:outline-hidden transition-all"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs focus:border-skyline-deep focus:outline-hidden"
                        >
                            <option value="all">⚡ All Statuses</option>
                            <option value="running">● Operational / Running</option>
                            <option value="maintenance">● Under Maintenance</option>
                            <option value="standby">● Standby / Auxiliary</option>
                        </select>

                        {departments.length > 0 && (
                            <select
                                value={deptFilter}
                                onChange={(e) => {
                                    setDeptFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs focus:border-skyline-deep focus:outline-hidden"
                            >
                                <option value="all">🏢 All Departments</option>
                                {departments.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        )}

                        <select
                            value={critFilter}
                            onChange={(e) => {
                                setCritFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs focus:border-skyline-deep focus:outline-hidden"
                        >
                            <option value="all">⚠️ All Criticality</option>
                            <option value="High">High Criticality</option>
                            <option value="Medium">Medium Criticality</option>
                            <option value="Normal">Normal Criticality</option>
                        </select>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setStatusFilter("all");
                                    setDeptFilter("all");
                                    setCritFilter("all");
                                    setCurrentPage(1);
                                }}
                                className="rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                            >
                                ✕ Clear Filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* HORIZONTAL DATA TABLE CONTAINER */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden w-full">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                        <thead className="bg-slate-50/90 font-extrabold uppercase tracking-wider text-[11px] text-slate-700 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3.5 whitespace-nowrap">Machine ID</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Machine Name</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Department</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Location</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Criticality</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">AMC Vendor</th>
                                <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <span className="text-2xl">🚜</span>
                                            <span className="font-bold text-slate-700">No machines found</span>
                                            <span className="text-xs text-slate-400">Try changing your search or filter options.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((r, idx) => {
                                    const assetId = r["Asset ID"] || r["assetId"] || r["Machine ID"] || `SKY-00${idx + 1}`;
                                    const name = r["Name"] || r["machineName"] || r["Machine Name"] || "Machine";
                                    const dept = r["Department"] || r["department"] || "Production";
                                    const loc = r["Location"] || r["location"] || "Plant Floor";
                                    const crit = r["Criticality"] || r["criticality"] || "Normal";
                                    const status = r["Status"] || r["status"] || "Running";
                                    const amc = r["AMC Vendor"] || r["amcVendor"] || "—";

                                    return (
                                        <tr key={assetId || idx} className="hover:bg-slate-50/80 transition-colors h-[60px]">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                                                    {assetId}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap font-extrabold text-slate-900 text-xs">{name}</td>
                                            <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-600 text-xs">{dept}</td>
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-600 text-xs">{loc}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {/high/i.test(crit) ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-800 border border-rose-200">
                                                        High
                                                    </span>
                                                ) : /medium/i.test(crit) ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800 border border-amber-200">
                                                        Medium
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                                                        Normal
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {/^(running|operational|active)$/i.test(status) ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        Operational
                                                    </span>
                                                ) : /maintenance|scheduled|pm/i.test(status) ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                                        Under PM
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                                                        Standby
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">{amc}</td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link
                                                        href={`/machine/${encodeURIComponent(assetId)}`}
                                                        target="_blank"
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                                                        title="View QR Profile"
                                                    >
                                                        <span>📷</span> View QR
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit(r)}
                                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                                                        title="Edit Machine"
                                                    >
                                                        ✎ Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(r)}
                                                        className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors shadow-2xs"
                                                        title="Delete Machine"
                                                    >
                                                        🗑
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION FOOTER */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
                    <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-600">
                            Showing <strong className="text-slate-900 font-bold">{totalRecords === 0 ? 0 : startIndex + 1}–{endIndex}</strong> of{" "}
                            <strong className="text-slate-900 font-bold">{totalRecords}</strong> machines
                        </span>
                        <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                            <span className="text-[11px] text-slate-500 font-medium">Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs focus:border-skyline-deep focus:outline-hidden cursor-pointer"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={safeCurrentPage <= 1}
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed shadow-2xs transition-colors"
                        >
                            ← Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={`h-8 w-8 rounded-lg text-xs font-black transition-all shadow-2xs ${page === safeCurrentPage ? "bg-[#880b13] text-white shadow-xs" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={safeCurrentPage >= totalPages}
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed shadow-2xs transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
