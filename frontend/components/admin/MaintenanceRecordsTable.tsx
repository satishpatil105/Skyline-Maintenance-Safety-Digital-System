"use client";

import { useState, useMemo } from "react";
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

    // KPI metrics
    const totalAll = rows.length;
    const openCount = rows.filter((r) => {
        const s = String(r["status"] || "").toLowerCase();
        return s === "open" || s === "in progress" || s === "pending";
    }).length;
    const closedCount = rows.filter((r) => {
        const s = String(r["status"] || "").toLowerCase();
        return s === "closed" || s === "resolved" || s === "completed";
    }).length;
    const urgentCount = rows.filter((r) => {
        const p = String(r["priority"] || "").toLowerCase();
        return p === "urgent" || p === "high" || p === "critical";
    }).length;

    const filtered = rows.filter((r) => {
        const s = search.toLowerCase().trim();
        const matchesSearch =
            !s ||
            (r["recordId"] || r["Record ID"] || "").toLowerCase().includes(s) ||
            (r["assetId"] || r["Asset ID"] || "").toLowerCase().includes(s) ||
            (r["machineName"] || r["Machine Name"] || "").toLowerCase().includes(s) ||
            (r["userId"] || r["User ID"] || "").toLowerCase().includes(s) ||
            (r["userName"] || r["User Name"] || r["Submitted By"] || "").toLowerCase().includes(s) ||
            (r["checklistId"] || r["Checklist ID"] || "").toLowerCase().includes(s) ||
            (r["problem"] || r["Problem / Request"] || r["Issue"] || "").toLowerCase().includes(s) ||
            (r["assignedTo"] || r["Assigned To"] || r["technicianName"] || "").toLowerCase().includes(s) ||
            (r["actionTaken"] || r["correctiveAction"] || r["Action Taken"] || "").toLowerCase().includes(s);

        const statusVal = (r["status"] || r["Status"] || "").toLowerCase();
        const matchesStatus = statusFilter === "all" || statusVal === statusFilter.toLowerCase();
        const priorityVal = (r["priority"] || r["Priority"] || "").toLowerCase();
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
        <div className="space-y-4 w-full">
            {/* Top KPI Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Work Orders</div>
                        <div className="text-2xl font-black text-slate-900 mt-1">{totalAll}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-lg border border-amber-200/60 font-black">
                        🛠️
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active / Open</div>
                        <div className="text-2xl font-black text-rose-700 mt-1 flex items-center gap-1.5">
                            {openCount}
                            {openCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center text-lg border border-rose-200/60 font-black">
                        ⚡
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resolved / Closed</div>
                        <div className="text-2xl font-black text-emerald-700 mt-1">{closedCount}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg border border-emerald-200/60 font-black">
                        ✓
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">High / Urgent Priority</div>
                        <div className="text-2xl font-black text-orange-700 mt-1">{urgentCount}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center text-lg border border-orange-200/60 font-black">
                        🔥
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by Work Order ID, Asset ID, Machine, User, Checklist ID, Assigned Technician, Action Taken..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-9 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-[#880b13] focus:bg-white focus:outline-hidden transition-all"
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

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:border-[#880b13] focus:outline-hidden cursor-pointer"
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
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:border-[#880b13] focus:outline-hidden cursor-pointer"
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
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                            >
                                ✕ Clear Filters
                            </button>
                        )}

                    </div>
                </div>
            </div>

            {/* Complete Sequence Maintenance Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden w-full">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                        <thead className="bg-slate-50/90 font-extrabold uppercase tracking-wider text-[10px] text-slate-700 border-b border-slate-200 select-none">
                            <tr>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">1. Work Order ID</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">2. Date</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">3. Asset ID</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">4. Machine Name</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">5. User ID</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">6. User Name</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">7. Checklist ID</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">8. Problem / Breakdown</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">9. Priority</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">10. Assigned To</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">11. Action Taken</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">12. Status</th>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">13. Completion Date</th>
                                <th className="px-3.5 py-3.5 text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="px-4 py-14 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-1.5">
                                            <span className="text-3xl">🛠️</span>
                                            <span className="font-extrabold text-sm text-slate-700">No maintenance records found</span>
                                            <span className="text-xs text-slate-400">Try adjusting your search criteria or add a new record.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((r, idx) => {
                                    const recId = r["recordId"] || r["Record ID"] || r["Maintenance ID"] || `WO-${idx + 1}`;
                                    const date = r["date"] || r["Date"] || "—";
                                    const assetId = r["assetId"] || r["Asset ID"] || "—";
                                    const machine = r["machineName"] || r["Machine Name"] || r["Machine / Equipment"] || r["Machine"] || "—";
                                    const userId = r["userId"] || r["User ID"] || "—";
                                    const userName = r["userName"] || r["User Name"] || r["Submitted By"] || r["Operator"] || "—";
                                    const checklistId = r["checklistId"] || r["Checklist ID"] || r["Template ID"] || "—";
                                    const problem = r["problem"] || r["Problem / Request"] || r["Problem"] || r["Issue"] || "Routine maintenance";
                                    const priority = r["priority"] || r["Priority"] || "Normal";
                                    const assignedTo = r["assignedTo"] || r["Assigned To"] || r["technicianName"] || r["Technician"] || "Unassigned";
                                    const actionTaken = r["actionTaken"] || r["Action Taken"] || r["correctiveAction"] || r["Corrective Action"] || "";
                                    const status = r["status"] || r["Status"] || "Open";
                                    const completionDate = r["completionDate"] || r["Completion Date"] || "";

                                    const isUrgent = /urgent|high|critical/i.test(priority);

                                    return (
                                        <tr key={recId || idx} className="hover:bg-rose-50/30 transition-colors h-[58px]">
                                            {/* 1. Work Order ID */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                <span className="inline-flex items-center font-mono text-[11px] font-black text-amber-950 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                                                    {recId}
                                                </span>
                                            </td>

                                            {/* 2. Date */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-xs font-semibold text-slate-600">
                                                {date}
                                            </td>

                                            {/* 3. Asset ID */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                <span className="inline-flex items-center font-mono text-xs font-bold text-sky-950 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                                                    {assetId}
                                                </span>
                                            </td>

                                            {/* 4. Machine Name */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap font-bold text-slate-900 text-xs">
                                                {machine}
                                            </td>

                                            {/* 5. User ID */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                <span className="inline-flex items-center font-mono text-[11px] font-bold text-purple-950 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                                    {userId}
                                                </span>
                                            </td>

                                            {/* 6. User Name */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap font-semibold text-slate-800 text-xs">
                                                {userName}
                                            </td>

                                            {/* 7. Checklist ID */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                {checklistId && checklistId !== "—" ? (
                                                    <span className="inline-flex items-center font-mono text-[11px] font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                        {checklistId}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-mono text-xs">—</span>
                                                )}
                                            </td>

                                            {/* 8. Problem / Breakdown */}
                                            <td className="px-3.5 py-2.5 max-w-xs truncate font-medium text-slate-800 text-xs" title={problem}>
                                                {problem}
                                            </td>

                                            {/* 9. Priority */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                {isUrgent ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-800 border border-rose-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                        {priority}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                                                        {priority}
                                                    </span>
                                                )}
                                            </td>

                                            {/* 10. Assigned To */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap font-bold text-slate-800 text-xs">
                                                {assignedTo}
                                            </td>

                                            {/* 11. Action Taken */}
                                            <td className="px-3.5 py-2.5 max-w-xs truncate font-medium text-slate-700 text-xs" title={actionTaken || "Pending"}>
                                                {actionTaken ? (
                                                    <span className="text-slate-800">{actionTaken}</span>
                                                ) : (
                                                    <span className="text-amber-600 italic">Pending Action</span>
                                                )}
                                            </td>

                                            {/* 12. Status */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                {renderStatusCell ? (
                                                    renderStatusCell("status", status)
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                                                        {status}
                                                    </span>
                                                )}
                                            </td>

                                            {/* 13. Completion Date */}
                                            <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-xs text-slate-600">
                                                {completionDate ? (
                                                    <span className="font-semibold text-emerald-800">{completionDate}</span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Incomplete</span>
                                                )}
                                            </td>

                                            {/* 14. Actions */}
                                            <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit(r)}
                                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                                                        title="Edit Work Order"
                                                    >
                                                        ✎ Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(r)}
                                                        className="rounded-lg border border-red-200 bg-red-50/60 hover:bg-red-100 text-red-600 px-2 py-1 text-[11px] font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                                        title="Delete Work Order"
                                                        aria-label="Delete Work Order"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                        </svg>
                                                        Delete
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

                {/* Pagination Controls */}
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

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={safeCurrentPage <= 1}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            ← Prev
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-700">
                            Page {safeCurrentPage} of {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safeCurrentPage >= totalPages}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
