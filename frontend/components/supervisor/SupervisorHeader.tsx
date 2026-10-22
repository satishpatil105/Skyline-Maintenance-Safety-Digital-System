"use client";

import React from "react";
import { SUPERVISOR_TABS } from "./SupervisorSidebar";

interface SupervisorHeaderProps {
    activeTab: string;
    sidebarCollapsed: boolean;
    mobileMenuOpen: boolean;
    dueAlertsCount?: number;
    pendingAlertsCount?: number;
    onToggleSidebar: () => void;
    onToggleMobileMenu: () => void;
    onOpenQrModal: () => void;
    onOpenCreateModal: () => void;
    onNavigateToAlerts?: () => void;
}

export default function SupervisorHeader({
    activeTab,
    sidebarCollapsed,
    mobileMenuOpen,
    dueAlertsCount = 0,
    pendingAlertsCount = 0,
    onToggleSidebar,
    onToggleMobileMenu,
    onOpenQrModal,
    onOpenCreateModal,
    onNavigateToAlerts,
}: SupervisorHeaderProps) {
    const currentTabObj = SUPERVISOR_TABS.find((t) => t.key === activeTab) || SUPERVISOR_TABS[0];

    const getAddButtonText = (tabKey: string) => {
        switch (tabKey) {
            case "assets":
                return "Add Asset";
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
                {/* Notification Bell Button */}
                <button
                    type="button"
                    onClick={onNavigateToAlerts}
                    className={`relative p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                        dueAlertsCount > 0
                            ? "bg-rose-50 text-rose-700 border-rose-300 shadow-2xs hover:bg-rose-100"
                            : pendingAlertsCount > 0
                            ? "bg-amber-50 text-amber-700 border-amber-300 shadow-2xs hover:bg-amber-100"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                    title={
                        dueAlertsCount > 0
                            ? `${dueAlertsCount} Due/Overdue alert(s) requiring attention`
                            : pendingAlertsCount > 0
                            ? `${pendingAlertsCount} Pending alert(s)`
                            : "Notifications & Alerts"
                    }
                    aria-label="Notifications"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                    </svg>
                    {(dueAlertsCount > 0 || pendingAlertsCount > 0) && (
                        <span
                            className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-xs ${
                                dueAlertsCount > 0 ? "bg-rose-600 animate-pulse" : "bg-amber-500"
                            }`}
                        >
                            {dueAlertsCount > 0 ? dueAlertsCount : pendingAlertsCount}
                        </span>
                    )}
                </button>

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
