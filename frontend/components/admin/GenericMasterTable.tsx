"use client";

import { useState, useMemo } from "react";
import type { Row } from "./UserMasterTable";

interface GenericMasterTableProps {
    cols: string[];
    rows: Row[];
    title?: string;
    onEdit: (row: Row) => void;
    onDelete: (row: Row) => void;
    renderStatusCell?: (colKey: string, val: string) => React.ReactNode;
}

export default function GenericMasterTable({
    cols,
    rows,
    title = "System Records",
    onEdit,
    onDelete,
    renderStatusCell,
}: GenericMasterTableProps) {
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState<Record<string, string>>({});

    const getColLabel = (c: any): string => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object") return c.label || c.key || String(c);
        return String(c || "");
    };

    const filterCols = cols.map(getColLabel).filter((c) => c !== "__id");

    // Detect candidate categorical columns for filters (Category, Frequency, Active, Status, Type, Severity, etc.)
    const filterableCols = useMemo(() => {
        return filterCols.filter((col) => {
            const lower = col.toLowerCase();
            if (/category|frequency|active|status|type|severity|department|priority|source/i.test(lower)) return true;
            const uniqueVals = new Set(rows.map((r) => String(r[col] || "").trim()).filter(Boolean));
            return uniqueVals.size > 1 && uniqueVals.size <= 25;
        });
    }, [filterCols, rows]);

    // Extract unique values for each filterable column
    const filterOptions = useMemo(() => {
        const map: Record<string, string[]> = {};
        filterableCols.forEach((col) => {
            const uniqueVals = Array.from(
                new Set(rows.map((r) => String(r[col] || "").trim()).filter(Boolean))
            ).sort();
            map[col] = uniqueVals;
        });
        return map;
    }, [filterableCols, rows]);

    const handleFilterChange = (col: string, value: string) => {
        setFilters((prev) => {
            const next = { ...prev };
            if (!value) delete next[col];
            else next[col] = value;
            return next;
        });
        setCurrentPage(1);
    };

    const clearAllFilters = () => {
        setSearch("");
        setFilters({});
        setCurrentPage(1);
    };

    const filtered = rows.filter((r) => {
        // 1. Text Search across all columns
        const s = search.toLowerCase().trim();
        if (s && !filterCols.some((col) => String(r[col] || "").toLowerCase().includes(s))) {
            return false;
        }
        // 2. Specific Column Dropdown Filters
        for (const [col, val] of Object.entries(filters)) {
            if (val && String(r[col] || "").trim().toLowerCase() !== val.toLowerCase()) {
                return false;
            }
        }
        return true;
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

    const hasActiveFilters = search.trim() !== "" || Object.keys(filters).length > 0;

    // Custom Cell Value Formatting & Badges
    const renderCellContent = (colName: string, val: string, row: Row) => {
        if (!val || val === "—") return <span className="text-slate-300 font-normal">—</span>;

        const colLower = colName.toLowerCase();
        const valLower = val.toLowerCase();

        // 1. Severity Badge (Critical, High, Warning, Medium, Info)
        if (colLower.includes("severity")) {
            if (valLower.includes("critical") || valLower.includes("high")) {
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-700 border border-rose-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                        {val}
                    </span>
                );
            }
            if (valLower.includes("warning") || valLower.includes("amber") || valLower.includes("medium")) {
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800 border border-amber-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                        {val}
                    </span>
                );
            }
            if (valLower.includes("info") || valLower.includes("low")) {
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-0.5 text-[11px] font-extrabold text-sky-700 border border-sky-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                        {val}
                    </span>
                );
            }
        }

        // 2. Frequency Badge
        if (colLower.includes("frequency")) {
            if (valLower.includes("daily")) {
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                        {val}
                    </span>
                );
            }
            if (valLower.includes("weekly")) {
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                        {val}
                    </span>
                );
            }
            if (valLower.includes("monthly")) {
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                        {val}
                    </span>
                );
            }
        }

        // 3. Response Badge
        if (colLower.includes("response")) {
            if (valLower.includes("ok") && !valLower.includes("not ok")) {
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        {val}
                    </span>
                );
            }
            if (valLower.includes("not ok")) {
                return (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                        {val}
                    </span>
                );
            }
        }

        // 4. Active / Status Badge
        if (colLower.includes("active") || colLower === "status") {
            if (/^(yes|active|running|completed|ok|resolved|open|active)$/i.test(valLower)) {
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        {val}
                    </span>
                );
            }
            if (/^(no|inactive|stopped|failed|not ok|critical|closed)$/i.test(valLower)) {
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                        {val}
                    </span>
                );
            }
        }

        // 5. Template ID / Alert ID / Code Monospace Column
        if (colLower.includes("id") || colLower.includes("code") || colLower.includes("template")) {
            return (
                <span className="font-mono text-[11px] font-bold text-[#880b13] bg-rose-50/70 border border-rose-100 px-1.5 py-0.5 rounded shadow-2xs">
                    {val}
                </span>
            );
        }

        // 6. Category Badge
        if (colLower.includes("category")) {
            return (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-700 border border-slate-200/80">
                    {val}
                </span>
            );
        }

        // Default text with truncation and tooltip
        const isLongText = val.length > 35;
        return (
            <span
                className={`block truncate ${isLongText ? "max-w-[280px] text-slate-600" : "max-w-[200px] text-slate-800 font-medium"}`}
                title={val}
            >
                {val}
            </span>
        );
    };

    return (
        <div className="space-y-3.5 w-full font-sans antialiased">
            {/* Search & Dynamic Filter Controls Bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by ID, title, source, category, check point..."
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

                    {/* Filter Dropdowns */}
                    {filterableCols.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            {filterableCols.slice(0, 3).map((col) => (
                                <div key={col} className="relative">
                                    <select
                                        value={filters[col] || ""}
                                        onChange={(e) => handleFilterChange(col, e.target.value)}
                                        className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[#880b13] focus:bg-white focus:outline-hidden cursor-pointer max-w-[170px] truncate shadow-2xs"
                                    >
                                        <option value="">All {col}s</option>
                                        {(filterOptions[col] || []).map((val) => (
                                            <option key={val} value={val}>
                                                {val}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}

                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={clearAllFilters}
                                    className="rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-2 text-xs font-bold text-[#880b13] transition-colors shadow-2xs"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* Main Records Data Grid */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden w-full">
                <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50">
                    <table className="w-full text-left text-xs divide-y divide-slate-200 border-collapse">
                        <thead className="bg-[#faf1f2] font-extrabold uppercase tracking-wider text-[11px] text-slate-800 border-b border-[#f3d5d8]">
                            <tr>
                                {filterCols.map((c) => (
                                    <th key={c} className="px-4 py-3.5 whitespace-nowrap">
                                        {c}
                                    </th>
                                ))}
                                <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={filterCols.length + 1} className="px-4 py-12 text-center text-slate-500 font-medium">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <span className="text-3xl">🔔</span>
                                            <p className="font-bold text-slate-700">No records found</p>
                                            <p className="text-xs text-slate-400">Try changing your search query or filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((r, idx) => (
                                    <tr key={idx} className="hover:bg-[#fff7f8] transition-colors h-[48px]">
                                        {filterCols.map((c) => {
                                            const val = r[c] || "—";
                                            const isStatusCol = /status|active/i.test(c);
                                            return (
                                                <td key={c} className="px-4 py-2.5 whitespace-nowrap text-xs">
                                                    {isStatusCol && renderStatusCell ? (
                                                        renderStatusCell(c, val)
                                                    ) : (
                                                        renderCellContent(c, val, r)
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(r)}
                                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                                                    title="Edit Record"
                                                >
                                                    ✎ Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDelete(r)}
                                                    className="rounded-lg border border-rose-200 bg-rose-50/60 px-2 py-1 text-[11px] font-bold text-[#880b13] hover:bg-rose-100 shadow-2xs transition-colors"
                                                    title="Delete Record"
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Pagination & Page Number Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-4 py-3 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="font-medium text-slate-600">
                            Showing <strong className="text-slate-900 font-bold">{totalRecords === 0 ? 0 : startIndex + 1}–{endIndex}</strong> of{" "}
                            <strong className="text-slate-900 font-bold">{totalRecords}</strong> items
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
