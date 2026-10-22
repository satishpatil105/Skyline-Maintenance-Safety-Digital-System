"use client";

import { useState, useMemo } from "react";
import type { Row } from "./UserMasterTable";

interface BreakdownsRepairsTableProps {
    rows: Row[];
    onEdit: (row: Row) => void;
    onDelete: (row: Row) => void;
    renderStatusCell?: (colKey: string, val: string) => React.ReactNode;
}

export default function BreakdownsRepairsTable({
    rows,
    onEdit,
    onDelete,
    renderStatusCell,
}: BreakdownsRepairsTableProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const filtered = rows.filter((r) => {
        const s = search.toLowerCase().trim();
        const matchesSearch =
            !s ||
            Object.values(r).some((v) => (v || "").toLowerCase().includes(s));

        const statusVal = (r["Status"] || r["status"] || "").toLowerCase();
        const matchesStatus = statusFilter === "all" || statusVal.includes(statusFilter.toLowerCase());

        return matchesSearch && matchesStatus;
    });

    const hasActiveFilters = search || statusFilter !== "all";
    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const pageRows = filtered.slice(startIndex, endIndex);

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (safeCurrentPage > 3) pages.push("...");
            const start = Math.max(2, safeCurrentPage - 1);
            const end = Math.min(totalPages - 1, safeCurrentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (safeCurrentPage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    };


    return (
        <div className="space-y-3.5 w-full font-sans antialiased">
            {/* Search Toolbar & Filter */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
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
                            placeholder="Search by ID, machine, breakdown issue, root cause, status..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#880b13] focus:bg-white focus:outline-hidden transition-all shadow-2xs"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:border-[#880b13] focus:outline-hidden cursor-pointer"
                        >
                            <option value="all">⚡ All Statuses</option>
                            <option value="Resolved">Resolved & Verified</option>
                            <option value="Progress">In Progress</option>
                            <option value="Open">Open / Pending</option>
                        </select>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setStatusFilter("all");
                                    setCurrentPage(1);
                                }}
                                className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-bold text-[#880b13] hover:bg-rose-100 transition-colors shadow-2xs"
                            >
                                ✕ Clear
                            </button>
                        )}

                    </div>
                </div>
            </div>

            {/* Main Table Grid */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden w-full">
                <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50">
                    <table className="w-full text-left text-xs divide-y divide-slate-200 border-collapse">
                        <thead className="bg-[#faf1f2] font-extrabold uppercase tracking-wider text-[11px] text-slate-800 border-b border-[#f3d5d8]">
                            <tr>
                                <th className="px-4 py-3.5 whitespace-nowrap">Breakdown Ticket</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Machine Asset</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Breakdown Issue</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Reported Date</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Resolved Date</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Downtime (Hours)</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Root Cause</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                                <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500 font-medium">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <span className="text-3xl">🛠️</span>
                                            <p className="font-bold text-slate-700">No Breakdown & Repair tickets found</p>
                                            <p className="text-xs text-slate-400">Try changing your search query or filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((r, idx) => {
                                    const ticket = r["Breakdown Ticket"] || r["Ticket ID"] || r["recordId"] || `BD-2026${String(idx + 1).padStart(3, "0")}`;
                                    const machine = r["Machine Asset"] || r["Machine"] || r["machineName"] || r["Asset ID"] || "General Machine";
                                    const issue = r["Breakdown Issue"] || r["Problem / Task"] || r["problem"] || "Unspecified Breakdown";
                                    const reported = r["Reported Date"] || r["Date"] || r["date"] || "—";
                                    const resolved = r["Resolved Date"] || r["Date"] || "—";
                                    const downtime = r["Downtime (Hours)"] || r["Downtime"] || "1.5";
                                    const rootCause = r["Root Cause"] || r["Remarks"] || "Normal wear & tear";
                                    const status = r["Status"] || r["status"] || "Resolved & Verified";

                                    return (
                                        <tr key={ticket || idx} className="hover:bg-[#fff7f8] transition-colors h-[48px]">
                                            <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[11px] font-bold text-[#880b13] bg-rose-50/70 border border-rose-100 px-2 py-0.5 rounded shadow-2xs">
                                                {ticket}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap font-extrabold text-slate-900 text-xs">{machine}</td>
                                            <td className="px-4 py-2.5 max-w-[200px] truncate font-bold text-slate-800 text-xs" title={issue}>
                                                {issue}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-600">{reported}</td>
                                            <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-600">{resolved}</td>
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-bold text-slate-800 border border-slate-200">
                                                    ⏱️ {downtime} hrs
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 max-w-[220px] truncate text-slate-600 text-xs" title={rootCause}>
                                                {rootCause}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                {renderStatusCell ? (
                                                    renderStatusCell("Status", status)
                                                ) : /resolved|completed|verified/i.test(status) ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        {status}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                                        {status}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit(r)}
                                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                                                    >
                                                        ✎ Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(r)}
                                                        className="rounded-lg border border-rose-200 bg-rose-50/60 px-2 py-1 text-[11px] font-bold text-[#880b13] hover:bg-rose-100 shadow-2xs transition-colors"
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

                {/* Footer Pagination & Page Number Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-4 py-3 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="font-medium text-slate-600">
                            Showing <strong className="text-slate-900 font-bold">{totalRecords === 0 ? 0 : startIndex + 1}–{endIndex}</strong> of{" "}
                            <strong className="text-slate-900 font-bold">{totalRecords}</strong> tickets
                        </span>
                        <div className="flex items-center gap-1.5 border-l border-slate-300 pl-3">
                            <span className="font-bold text-slate-600">Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:border-[#880b13] focus:outline-hidden cursor-pointer"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    {/* Numeric Page Buttons */}
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={safeCurrentPage <= 1}
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed shadow-2xs transition-colors"
                        >
                            ← Previous
                        </button>

                        {getPageNumbers().map((p, i) =>
                            typeof p === "number" ? (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setCurrentPage(p)}
                                    className={`h-8 w-8 rounded-lg text-xs font-black transition-all shadow-2xs ${p === safeCurrentPage
                                        ? "bg-[#880b13] text-white shadow-xs"
                                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                        }`}
                                >
                                    {p}
                                </button>
                            ) : (
                                <span key={i} className="px-1.5 text-slate-400 font-bold">
                                    {p}
                                </span>
                            )
                        )}

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
