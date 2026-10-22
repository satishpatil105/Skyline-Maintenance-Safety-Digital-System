"use client";

import { cleanSidebarLabel } from "./AdminSidebar";

interface AdminHeaderProps {
    currentTitle: string;
    sidebarCollapsed: boolean;
    mobileMenuOpen: boolean;
    hasCurrentView: boolean;
    singular: string;
    onToggleSidebar: () => void;
    onToggleMobileMenu: () => void;
    onOpenQrModal: () => void;
    onOpenCreateModal: () => void;
}

export default function AdminHeader({
    currentTitle,
    sidebarCollapsed,
    mobileMenuOpen,
    hasCurrentView,
    singular,
    onToggleSidebar,
    onToggleMobileMenu,
    onOpenQrModal,
    onOpenCreateModal,
}: AdminHeaderProps) {
    return (
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4 shadow-2xs">
            {/* Left: Hamburger Toggle Button + Breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
                <button
                    type="button"
                    onClick={() => {
                        if (typeof window !== "undefined" && window.innerWidth < 1024) {
                            onToggleMobileMenu();
                        } else {
                            onToggleSidebar();
                        }
                    }}
                    className="p-2 rounded-xl text-slate-600 hover:text-[#880b13] hover:bg-rose-50 transition-colors border border-slate-200 shadow-2xs shrink-0 cursor-pointer flex items-center gap-1.5 font-bold text-xs"
                    title={sidebarCollapsed ? "Expand Sidebar Menu" : "Collapse Sidebar Menu"}
                    aria-label="Toggle Navigation Sidebar"
                >
                    <svg className="w-5 h-5 text-slate-700 hover:text-[#880b13]" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                    <span className="hidden md:inline text-[11px] font-black tracking-wide text-slate-600">MENU</span>
                </button>

                {/* Breadcrumb & Module Heading */}
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#880b13]/80 hidden sm:inline">Skyline Admin</span>
                        <span className="text-xs font-semibold text-slate-300 hidden sm:inline">/</span>
                        <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate leading-tight">
                            {cleanSidebarLabel(currentTitle || "Admin Control Center")}
                        </h1>
                    </div>
                </div>
            </div>

            {/* Right: Action Controls */}
            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={onOpenQrModal}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 px-3 py-1.5 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                    title="Scan Machine QR Code"
                >
                    <span>📷</span>
                    <span className="hidden sm:inline">QR Scan</span>
                </button>
                {hasCurrentView && (
                    <button
                        type="button"
                        onClick={onOpenCreateModal}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#880b13] hover:bg-[#72070e] text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-all cursor-pointer"
                        title={`Add New ${singular}`}
                    >
                        <span>➕</span>
                        <span>
                            {(() => {
                                const t = singular.toLowerCase();
                                if (t.includes("machine")) return "Add Machine";
                                if (t.includes("checklist")) return "Add Checklist";
                                if (t.includes("user")) return "Add User";
                                if (t.includes("maintenance")) return "Add Maintenance";
                                if (t.includes("safety")) return "Add Safety Record";
                                if (t.includes("part") || t.includes("amc")) return "Add Part";
                                if (t.includes("document") || t.includes("doc")) return "Add Document";
                                if (t.includes("notif") || t.includes("alert")) return "Add Alert";
                                if (t.includes("month") || t.includes("compliance")) return "Add Compliance";
                                return `Add ${singular || "Record"}`;
                            })()}
                        </span>
                    </button>
                )}
            </div>
        </header>
    );
}
