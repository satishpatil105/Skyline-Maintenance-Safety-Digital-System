"use client";

import React from "react";
import Image from "next/image";
import logoImg from "@/app/logo.png";
import type { SessionUser } from "@/lib/auth";

export interface SupervisorTabItem {
    key: string;
    label: string;
    slug: string;
}

interface SupervisorSidebarProps {
    tabs?: SupervisorTabItem[];
    activeTab: string;
    user: SessionUser;
    sidebarCollapsed: boolean;
    mobileMenuOpen: boolean;
    onSelectTab: (key: string) => void;
    onCloseMobileMenu: () => void;
}

export const SUPERVISOR_TABS: SupervisorTabItem[] = [
    { key: "overview", label: "Dashboard", slug: "dashboard" },
    { key: "maintenance", label: "Maintenance Records", slug: "maintenance-records" },
    { key: "safety", label: "Safety Records", slug: "safety" },
    { key: "checklist", label: "Checklist Master", slug: "checklist-master" },
    { key: "parts", label: "PM Parts & AMC", slug: "pm-parts-amc" },
    { key: "documents", label: "Document Register", slug: "document-register" },
    { key: "alerts", label: "Notifications & Alerts", slug: "notifications" },
];

export function getSupervisorSidebarIcon(key: string, isActive: boolean) {
    const k = key.toLowerCase();

    if (key === "fire") {
        return <span className="text-base shrink-0">🔥</span>;
    }
    if (key === "employee") {
        return <span className="text-base shrink-0">🦺</span>;
    }
    if (key === "hira") {
        return <span className="text-base shrink-0">🎯</span>;
    }
    if (key === "environmental") {
        return <span className="text-base shrink-0">🌿</span>;
    }
    if (key === "other") {
        return <span className="text-base shrink-0">🛡️</span>;
    }

    if (k === "overview" || k.includes("dash")) {

        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-rose-100 text-[#880b13]"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
                </svg>
            </span>
        );
    }
    if (k.includes("maintenance")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-[#880b13]/10 text-[#880b13]"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.398-3.03 1.164l-6.84 6.84a2.25 2.25 0 0 1-3.182-3.182l6.84-6.84c.766-.766 1.255-1.954 1.164-3.03A4.5 4.5 0 0 1 16.5 2.25a.75.75 0 0 1 .65.375l2.25 3.75a.75.75 0 0 1-.15.825l-.75.75a.75.75 0 0 0 0 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l.75-.75a.75.75 0 0 1 .825-.15l3.75 2.25a.75.75 0 0 1 .375.65Z" />
                </svg>
            </span>
        );
    }
    if (k.includes("safety")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-[#880b13]/10 text-[#880b13]"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
            </span>
        );
    }

    if (k.includes("checklist")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            </span>
        );
    }
    if (k.includes("part") || k.includes("amc")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
            </span>
        );
    }
    if (k.includes("doc") || k.includes("register")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
            </span>
        );
    }
    if (k.includes("notif") || k.includes("alert")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
            </span>
        );
    }
    return (
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-rose-100 text-[#880b13]"}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
        </span>
    );
}

export default function SupervisorSidebar({
    tabs = SUPERVISOR_TABS,
    activeTab,
    user,
    sidebarCollapsed,
    mobileMenuOpen,
    onSelectTab,
    onCloseMobileMenu,
}: SupervisorSidebarProps) {
    return (
        <aside
            className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200/90 shadow-lg lg:shadow-none transition-all duration-300 ease-in-out ${mobileMenuOpen
                ? "translate-x-0 w-64"
                : "-translate-x-full lg:translate-x-0 " + (sidebarCollapsed ? "w-16" : "w-60")
                }`}
        >
            {/* Sidebar Brand Header */}
            <div className="h-16 flex items-center px-3.5 border-b border-slate-100 justify-between shrink-0 bg-white">
                <div className={`flex items-center gap-2.5 overflow-hidden ${sidebarCollapsed ? "justify-center w-full" : ""}`}>
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-50 border border-slate-200/80 p-1 flex items-center justify-center shadow-2xs">
                        <Image src={logoImg} alt="Skyline Logo" width={32} height={32} className="object-contain" priority />
                    </div>
                    {!sidebarCollapsed && (
                        <div className="min-w-0">
                            <span className="text-[11px] font-black text-[#880b13] tracking-tight block truncate leading-tight" title="Skyline Project & Engineers">
                                Skyline Project &amp; Engineers
                            </span>
                            <span className="text-[10px] font-extrabold text-[#880b13]/80 uppercase tracking-wider block truncate mt-0.5 font-bold">
                                Supervisor
                            </span>
                        </div>
                    )}
                </div>

                {/* Mobile drawer close button */}
                <button
                    type="button"
                    onClick={onCloseMobileMenu}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden"
                    title="Close Sidebar Menu"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Scrollable Sidebar Nav Links */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2.5 py-3 space-y-1">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const icon = getSupervisorSidebarIcon(tab.key, isActive);

                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => {
                                onSelectTab(tab.key);
                                onCloseMobileMenu();
                            }}
                            title={sidebarCollapsed ? tab.label : undefined}
                            className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${sidebarCollapsed ? "justify-center px-0 py-2.5" : "justify-start px-3 py-2.5 gap-3"
                                } ${isActive
                                    ? "bg-[#880b13] text-white shadow-xs font-black border border-rose-900/40"
                                    : "bg-transparent hover:bg-rose-50/70 text-slate-700 hover:text-[#880b13]"
                                }`}
                        >
                            <div className={`flex items-center justify-center ${sidebarCollapsed ? "w-full" : "gap-2.5 min-w-0"}`}>
                                {icon}
                                {!sidebarCollapsed && (
                                    <span className="truncate text-left font-bold text-xs">{tab.label}</span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Sidebar Footer: Logged in User Profile & Logout Button */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/80 shrink-0">
                <div className={`flex items-center gap-2 ${sidebarCollapsed ? "justify-center flex-col" : "justify-between"}`}>
                    <div className={`flex items-center min-w-0 ${sidebarCollapsed ? "justify-center w-full" : "gap-2"}`}>
                        <div className="w-8 h-8 rounded-xl bg-[#880b13] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs" title={user?.name || "Satish Patil"}>
                            {(user?.name || "S").charAt(0).toUpperCase()}
                        </div>
                        {!sidebarCollapsed && (
                            <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 truncate">{user?.name || "Satish Patil"}</div>
                                <div className="text-[10px] font-semibold text-slate-400 truncate max-w-[110px]" title={user?.email || "mrsatishpatil0...@gmail.com"}>
                                    {user?.email || "mrsatishpatil0...@gmail.com"}
                                </div>
                            </div>
                        )}
                    </div>

                    <a
                        href="/api/auth/logout"
                        className={`rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-[#880b13] border border-slate-200 transition-all shadow-2xs flex items-center justify-center shrink-0 text-xs font-bold cursor-pointer group ${sidebarCollapsed ? "w-8 h-8 p-0" : "px-2 py-1.5 gap-1.5"
                            }`}
                        title="Logout / Exit Session"
                        aria-label="Logout"
                    >
                        <svg className="w-4 h-4 text-slate-500 group-hover:text-[#880b13] transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                        </svg>
                        {!sidebarCollapsed && <span>Logout</span>}
                    </a>
                </div>
            </div>
        </aside>
    );
}
