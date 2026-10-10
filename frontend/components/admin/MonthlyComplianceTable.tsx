"use client";

import { useState } from "react";
import type { Row } from "./UserMasterTable";

interface MonthlyComplianceTableProps {
    rows: Row[];
    onEdit: (row: Row) => void;
    onDelete: (row: Row) => void;
}

export default function MonthlyComplianceTable({
    rows,
    onEdit,
    onDelete,
}: MonthlyComplianceTableProps) {
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const filtered = rows.filter((r) => {
        const s = search.toLowerCase().trim();
        if (!s) return true;
        return Object.values(r).some((v) => (v || "").toLowerCase().includes(s));
    });

    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const pageRows = filtered.slice(startIndex, endIndex);

    // Pagination number buttons logic (1, 2, 3 ... totalPages)
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
            {/* Search Toolbar */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">🔍</span>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Search monthly compliance records, month, plant area, audit score..."
                        className="w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#880b13] focus:bg-white focus:outline-hidden transition-all shadow-2xs"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Main Table Grid */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden w-full">
                <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50">
                    <table className="w-full text-left text-xs divide-y divide-slate-200 border-collapse">
                        <thead className="bg-[#faf1f2] font-extrabold uppercase tracking-wider text-[11px] text-slate-800 border-b border-[#f3d5d8]">
                            <tr>
                                <th className="px-4 py-3.5 whitespace-nowrap">Month / Period</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Department / Machine</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Checklists Executed</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Compliance Score</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Audit Status</th>
                                <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500 font-medium">
                                        No Monthly Compliance records found.
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((r, idx) => {
                                    const month = r["month"] || r["Month"] || `2026-0${(idx % 9) + 1}`;
                                    const machine = r["machineName"] || r["department"] || "Plant Production";
                                    const executed = r["executed"] || r["Checklists Executed"] || "30 / 30";
                                    const score = r["score"] || r["Compliance Score"] || "98%";
                                    const audit = r["auditStatus"] || r["Status"] || "Compliant";

                                    return (
                                        <tr key={idx} className="hover:bg-[#fff7f8] transition-colors h-[48px]">
                                            <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[11px] font-bold text-[#880b13] bg-rose-50/70 border border-rose-100 px-2 py-0.5 rounded shadow-2xs">
                                                {month}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap font-extrabold text-slate-900 text-xs">{machine}</td>
                                            <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-slate-700 text-xs">{executed}</td>
                                            <td className="px-4 py-2.5 whitespace-nowrap font-bold text-emerald-700 text-xs">{score}</td>
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                                    ✓ {audit}
                                                </span>
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
                            <strong className="text-slate-900 font-bold">{totalRecords}</strong> records
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
