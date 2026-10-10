"use client";

import { useState } from "react";
import type { Row } from "./UserMasterTable";

interface MaintenanceRecordsTableProps {
    rows: Row[];
    onEdit: (row: Row) => void;
    onDelete: (row: Row) => void;
    renderStatusCell?: (colKey: string, val: string) => React.ReactNode;
}

export default function MaintenanceRecordsTable({
    rows,
    onEdit,
    onDelete,
    renderStatusCell,
}: MaintenanceRecordsTableProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const filtered = rows.filter((r) => {
        const s = search.toLowerCase().trim();
        const matchesSearch =
            !s ||
            (r["recordId"] || "").toLowerCase().includes(s) ||
            (r["machineName"] || r["assetId"] || "").toLowerCase().includes(s) ||
            (r["problem"] || "").toLowerCase().includes(s) ||
            (r["technicianName"] || r["assignedTo"] || "").toLowerCase().includes(s);

        const statusVal = (r["status"] || "").toLowerCase();
        const matchesStatus = statusFilter === "all" || statusVal === statusFilter.toLowerCase();
        const priorityVal = (r["priority"] || "").toLowerCase();
        const matchesPriority = priorityFilter === "all" || priorityVal === priorityFilter.toLowerCase();

        return matchesSearch && matchesStatus && matchesPriority;
    });

    const hasActiveFilters = search || statusFilter !== "all" || priorityFilter !== "all";
    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const pageRows = filtered.slice(startIndex, endIndex);

    return (
        <div className="space-y-3.5 w-full">
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
                            placeholder="Search maintenance work orders by ID, machine, problem, technician..."
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
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                        </select>

                        <select
                            value={priorityFilter}
                            onChange={(e) => {
                                setPriorityFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs focus:border-skyline-deep focus:outline-hidden"
                        >
                            <option value="all">🔥 All Priority</option>
                            <option value="Urgent">Urgent</option>
                            <option value="High">High</option>
                            <option value="Normal">Normal</option>
                            <option value="Low">Low</option>
                        </select>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setStatusFilter("all");
                                    setPriorityFilter("all");
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

            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden w-full">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                        <thead className="bg-slate-50/90 font-extrabold uppercase tracking-wider text-[11px] text-slate-700 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3.5 whitespace-nowrap">Work Order ID</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Machine</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Problem / Task</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Priority</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Technician</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                                <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                                <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <span className="text-2xl">🛠️</span>
                                            <span className="font-bold text-slate-700">No maintenance records found</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((r, idx) => {
                                    const recId = r["recordId"] || `WO-${idx + 1}`;
                                    const machine = r["machineName"] || r["assetId"] || "Machine";
                                    const problem = r["problem"] || "Routine maintenance";
                                    const priority = r["priority"] || "Normal";
                                    const tech = r["technicianName"] || r["assignedTo"] || "Unassigned";
                                    const date = r["date"] || "—";
                                    const status = r["status"] || "Open";

                                    return (
                                        <tr key={recId || idx} className="hover:bg-slate-50/80 transition-colors h-[60px]">
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] font-bold text-amber-900 bg-amber-50/80 px-2 py-1 rounded-md border border-amber-200/80">
                                                {recId}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap font-extrabold text-slate-900 text-xs">{machine}</td>
                                            <td className="px-4 py-3 max-w-xs truncate font-medium text-slate-700 text-xs" title={problem}>
                                                {problem}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {/urgent|high/i.test(priority) ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-800 border border-rose-200">
                                                        {priority}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                                                        {priority}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-700 text-xs">{tech}</td>
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-500">{date}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {renderStatusCell ? (
                                                    renderStatusCell("status", status)
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                                                        {status}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit(r)}
                                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                                                    >
                                                        ✎ Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(r)}
                                                        className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors shadow-2xs"
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

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
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
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:border-skyline-deep focus:outline-hidden cursor-pointer"
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
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-45 shadow-2xs"
                        >
                            ← Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={`h-8 w-8 rounded-lg text-xs font-black shadow-2xs ${page === safeCurrentPage ? "bg-[#880b13] text-white shadow-xs" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={safeCurrentPage >= totalPages}
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-45 shadow-2xs"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
