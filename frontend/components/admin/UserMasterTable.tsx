"use client";

import { useState } from "react";

export type Row = Record<string, string>;

interface UserMasterTableProps {
    rows: Row[];
    onEdit: (row: Row) => void;
    onDelete: (row: Row) => void;
}

export function UserPasswordBadge({
    password,
    initialRevealed = false,
}: {
    password?: string;
    initialRevealed?: boolean;
}) {
    const [revealed, setRevealed] = useState(initialRevealed);
    const [copied, setCopied] = useState(false);

    const cleanPass = password || "";
    const hasPass = cleanPass.length > 0 && cleanPass !== "Not set";

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasPass) return;
        navigator.clipboard.writeText(cleanPass);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRevealed(!revealed);
    };

    if (!hasPass) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                No Password Set
            </span>
        );
    }

    return (
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/70 px-2 py-0.5 text-xs font-mono">
            <span className="font-bold text-purple-950 select-all tracking-wider">
                {revealed ? cleanPass : "••••••••"}
            </span>
            <button
                type="button"
                onClick={handleToggle}
                title={revealed ? "Hide Password" : "Show Password"}
                className="text-slate-500 hover:text-slate-800 transition-colors p-0.5 text-xs"
            >
                {revealed ? "🙈" : "👁️"}
            </button>
            <button
                type="button"
                onClick={handleCopy}
                title="Copy Password"
                className="text-purple-700 hover:text-purple-900 transition-colors p-0.5 text-[11px]"
            >
                {copied ? "✓" : "📋"}
            </button>
            {copied && (
                <span className="font-sans text-[10px] font-bold text-emerald-700">
                    Copied!
                </span>
            )}
        </div>
    );
}

export default function UserMasterTable({
    rows,
    onEdit,
    onDelete,
}: UserMasterTableProps) {
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [permFilter, setPermFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const filtered = rows.filter((r) => {
        const s = search.toLowerCase().trim();
        const name = (r["Name"] || "").toLowerCase();
        const userId = (r["User ID"] || r["__id"] || "").toLowerCase();
        const email = (r["Login Email"] || "").toLowerCase();
        const matchesSearch = !s || userId.includes(s) || name.includes(s) || email.includes(s);

        const roleVal = r["Role"] || r["App Access"] || "";
        const matchesRole =
            roleFilter === "all" ||
            (roleFilter === "admin" && /admin/i.test(roleVal)) ||
            (roleFilter === "supervisor" && /supervisor/i.test(roleVal)) ||
            (roleFilter === "operator" && /operator|technician/i.test(roleVal));

        const activeVal = r["Active"] || "Yes";
        const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "active" && /^(yes|active|running)$/i.test(activeVal)) ||
            (statusFilter === "inactive" && /^(no|inactive|disabled)$/i.test(activeVal));

        const permissions: string[] = [];
        if (r["Can Submit Maintenance"] === "Yes") permissions.push("maint");
        if (r["Can Submit Safety"] === "Yes") permissions.push("safety");
        if (r["Can Approve Close"] === "Yes") permissions.push("approver");
        const matchesPerm = permFilter === "all" || permissions.includes(permFilter.toLowerCase());

        return matchesSearch && matchesRole && matchesStatus && matchesPerm;
    });

    const hasActiveFilters = search || roleFilter !== "all" || statusFilter !== "all" || permFilter !== "all";

    // Pagination calculations
    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const pageRows = filtered.slice(startIndex, endIndex);

    const handleCopyLogin = (r: Row) => {
        const userId = r["User ID"] || r["__id"] || "User";
        const info = `User ID: ${userId}\nName: ${r["Name"] || "—"}\nLogin Email: ${r["Login Email"] || "—"}`;
        navigator.clipboard.writeText(info);
        setCopiedId(userId);
        setTimeout(() => setCopiedId(null), 2500);
    };

    return (
        <div className="space-y-3 w-full">
            {/* FILTER TOOLBAR */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search users by ID, name, email..."
                            className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-skyline-deep focus:bg-white focus:outline-hidden transition-all"
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
                            value={roleFilter}
                            onChange={(e) => {
                                setRoleFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:border-skyline-deep focus:outline-hidden"
                        >
                            <option value="all">Role (All)</option>
                            <option value="admin">👑 Admin</option>
                            <option value="supervisor">🛡 Supervisor</option>
                            <option value="operator">👤 Operator</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:border-skyline-deep focus:outline-hidden"
                        >
                            <option value="all">Status (All)</option>
                            <option value="active">● Active</option>
                            <option value="inactive">○ Inactive</option>
                        </select>

                        <select
                            value={permFilter}
                            onChange={(e) => {
                                setPermFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:border-skyline-deep focus:outline-hidden"
                        >
                            <option value="all">Permission (All)</option>
                            <option value="maint">✓ Maint</option>
                            <option value="safety">✓ Safety</option>
                            <option value="approver">✓ Approver</option>
                        </select>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setRoleFilter("all");
                                    setStatusFilter("all");
                                    setPermFilter("all");
                                    setCurrentPage(1);
                                }}
                                className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                            >
                                ✕ Clear Filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ENTERPRISE USER DATA TABLE CONTAINER */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden w-full">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs divide-y divide-slate-200 border-collapse">
                        <thead className="bg-[#F8FAFC] font-extrabold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200 h-10">
                            <tr>
                                <th className="px-3.5 py-2.5 whitespace-nowrap w-[100px]">USER ID</th>
                                <th className="px-3.5 py-2.5 whitespace-nowrap w-[180px]">USER</th>
                                <th className="px-3.5 py-2.5 whitespace-nowrap w-[220px]">LOGIN EMAIL</th>
                                <th className="px-3.5 py-2.5 whitespace-nowrap w-[130px]">ROLE</th>
                                <th className="px-3.5 py-2.5 whitespace-nowrap w-[105px]">STATUS</th>
                                <th className="px-3.5 py-2.5 whitespace-nowrap min-w-[200px]">PERMISSIONS</th>
                                <th className="px-3.5 py-2.5 text-right whitespace-nowrap w-[190px]">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <span className="text-xl">👥</span>
                                            <span className="font-bold text-slate-700">No users found</span>
                                            <span className="text-xs text-slate-400">There are no user records matching the selected criteria.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((r, idx) => {
                                    const name = r["Name"] || "Unnamed User";
                                    const userId = r["User ID"] || "NO-ID";
                                    const role = r["Role"] || r["App Access"] || "User";
                                    const email = r["Login Email"] || "—";
                                    const active = r["Active"] || "Yes";

                                    const permissions = [];
                                    if (r["Can Submit Maintenance"] === "Yes") permissions.push("Maint");
                                    if (r["Can Submit Safety"] === "Yes") permissions.push("Safety");
                                    if (r["Can Approve Close"] === "Yes") permissions.push("Approver");
                                    if (r["Can Add Machine"] === "Yes") permissions.push("Add Machine");
                                    if (r["Can Edit Machine"] === "Yes") permissions.push("Edit Machine");

                                    return (
                                        <tr key={userId || idx} className="hover:bg-[#FAFAFA] transition-colors h-[50px]">
                                            {/* USER ID */}
                                            <td className="px-3.5 py-2 whitespace-nowrap">
                                                <span className="inline-block font-mono text-[11px] font-semibold text-[#880b13] bg-[#FFF5F5] border border-[#F3D7D7] px-2 py-0.5 rounded">
                                                    {userId}
                                                </span>
                                            </td>

                                            {/* USER (Avatar 32px + Name) */}
                                            <td className="px-3.5 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-xs">
                                                        {name.charAt(0).toUpperCase()}
                                                    </span>
                                                    <span className="font-semibold text-slate-900 text-[13px] truncate max-w-[140px]">
                                                        {name}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* LOGIN EMAIL */}
                                            <td className="px-3.5 py-2 whitespace-nowrap">
                                                <span className="font-mono text-[11px] text-slate-600 truncate max-w-[210px] block" title={email}>
                                                    {email}
                                                </span>
                                            </td>

                                            {/* ROLE BADGE */}
                                            <td className="px-3.5 py-2 whitespace-nowrap">
                                                {/admin/i.test(role) ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">
                                                        👑 Admin
                                                    </span>
                                                ) : /supervisor/i.test(role) ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                                                        🛡 Supervisor
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                                                        👤 Operator
                                                    </span>
                                                )}
                                            </td>

                                            {/* STATUS */}
                                            <td className="px-3.5 py-2 whitespace-nowrap">
                                                {/^(yes|active|running)$/i.test(active) ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#047857] border border-[#A7F3D0] h-[24px]">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200 h-[24px]">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>

                                            {/* PERMISSIONS */}
                                            <td className="px-3.5 py-2 whitespace-nowrap">
                                                <div className="flex flex-wrap gap-1 items-center">
                                                    {permissions.slice(0, 2).map((p) => (
                                                        <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200">
                                                            ✓ {p}
                                                        </span>
                                                    ))}
                                                    {permissions.length > 2 && (
                                                        <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                                                            +{permissions.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* ACTIONS */}
                                            <td className="px-3.5 py-2 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyLogin(r)}
                                                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs h-[30px]"
                                                        title="Copy Login Credentials"
                                                    >
                                                        {copiedId === userId ? (
                                                            <span className="text-emerald-700 font-bold">✓ Copied</span>
                                                        ) : (
                                                            <>
                                                                <span>📋</span> Copy Login
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit(r)}
                                                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs h-[30px]"
                                                        title="Edit User"
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(r)}
                                                        className="rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors shadow-2xs h-[30px]"
                                                        title="Delete User"
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

                {/* SINGLE CLEAN ENTERPRISE PAGINATION FOOTER */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-xs text-slate-600 h-[50px]">
                    <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-600">
                            Showing <strong className="text-slate-900 font-bold">{totalRecords === 0 ? 0 : startIndex + 1}–{endIndex}</strong> of{" "}
                            <strong className="text-slate-900 font-bold">{totalRecords}</strong> users
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
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
                        >
                            ← Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={`h-7 w-7 rounded-md text-xs font-bold transition-all shadow-2xs ${page === safeCurrentPage ? "bg-[#880b13] text-white shadow-xs" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={safeCurrentPage >= totalPages}
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
