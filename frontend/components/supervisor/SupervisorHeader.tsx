"use client";

import React from "react";
import { SUPERVISOR_TABS } from "./SupervisorSidebar";

interface SupervisorHeaderProps {
    activeTab: string;
    sidebarCollapsed: boolean;
    mobileMenuOpen: boolean;
    onToggleSidebar: () => void;
    onToggleMobileMenu: () => void;
    onOpenQrModal: () => void;
    onOpenCreateModal: () => void;
}

export default function SupervisorHeader({
    activeTab,
    sidebarCollapsed,
    mobileMenuOpen,
    onToggleSidebar,
    onToggleMobileMenu,
    onOpenQrModal,
    onOpenCreateModal,
}: SupervisorHeaderProps) {
    const currentTabObj = SUPERVISOR_TABS.find((t) => t.key === activeTab) || SUPERVISOR_TABS[0];

    const getAddButtonText = (tabKey: string) => {
        switch (tabKey) {
            case "maintenance":
                return "Add Maintenance Record";
            case "safety":
                return "Add Safety Record";
            case "checklist":
                return "Add Checklist Item";
            case "parts":
                return "Add PM Part / Stock";
            case "documents":
                return "Add Document";
            case "alerts":
                return "Add Alert / Notification";
            default:
                return "Add Record";
        }
    };

    const addButtonLabel = getAddButtonText(activeTab);

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
                    className="p-1.5 rounded-xl text-slate-500 hover:text-[#880b13] hover:bg-slate-100 transition-colors border border-slate-200 shadow-2xs shrink-0 cursor-pointer"
                    title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    aria-label="Toggle Navigation Sidebar"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                </button>

                {/* Breadcrumb & Module Heading */}
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Skyline Supervisor</span>
                        <span className="text-xs font-semibold text-slate-300 hidden sm:inline">/</span>
                        <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate leading-tight">
                            {currentTabObj.label}
                        </h1>
                    </div>
                </div>
            </div>

            {/* Right: Action Controls */}
            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={onOpenQrModal}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                    title="Scan Machine QR Code"
                >
                    <span>📷</span>
                    <span>QR Scan</span>
                </button>
                {activeTab !== "overview" && activeTab !== "dashboard" && (
                    <button
                        type="button"
                        onClick={onOpenCreateModal}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#880b13] hover:bg-[#72070e] text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition-all cursor-pointer"
                        title={addButtonLabel}
                    >
                        <span>➕</span>
                        <span>{addButtonLabel}</span>
                    </button>
                )}
            </div>
        </header>
    );
}
