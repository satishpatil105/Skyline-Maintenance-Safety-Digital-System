"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import logoImg from "@/app/logo.png";
import type { SessionUser } from "@/lib/auth";

export interface SafetySidebarProps {
    activeCategory?: string; // "overview" | "fire" | "employee" | "hira" | "environmental" | "other"
    user: SessionUser;
    sidebarCollapsed: boolean;
    mobileMenuOpen: boolean;
    onSelectCategory: (key: string) => void;
    onCloseMobileMenu: () => void;
}

export const SAFETY_SIDEBAR_ITEMS = [
    { key: "overview", label: "Dashboard", icon: "📊", href: "/supervisor/safety/dashboard" },
    { key: "fire", label: "Fire Safety", icon: "🔥", href: "/supervisor/safety/fire" },
    { key: "employee", label: "Employee Safety", icon: "🦺", href: "/supervisor/safety/employee" },
    { key: "hira", label: "HIRA Assessment", icon: "🎯", href: "/supervisor/safety/hira" },
    { key: "environmental", label: "Environmental Safety", icon: "🌿", href: "/supervisor/safety/environmental" },
    { key: "other", label: "Other Safety Register", icon: "🛡️", href: "/supervisor/safety/other" },
];

export function getSafetyItemIcon(key: string, isActive: boolean) {
    if (key === "overview") {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-rose-100 text-[#880b13]"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
                </svg>
            </span>
        );
    }
    if (key === "fire") {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"}`}>
                <span className="text-sm font-extrabold">🔥</span>
            </span>
        );
    }
    if (key === "employee") {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                <span className="text-sm font-extrabold">🦺</span>
            </span>
        );
    }
    if (key === "hira") {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700"}`}>
                <span className="text-sm font-extrabold">🎯</span>
            </span>
        );
    }
    if (key === "environmental") {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                <span className="text-sm font-extrabold">🌿</span>
            </span>
        );
    }
    if (key === "other") {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-teal-100 text-teal-800"}`}>
                <span className="text-sm font-extrabold">🛡️</span>
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

export default function SafetySidebar({
    activeCategory = "overview",
    user,
    sidebarCollapsed,
    mobileMenuOpen,
    onSelectCategory,
    onCloseMobileMenu,
}: SafetySidebarProps) {
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
                                Safety Hub
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

            {/* Scrollable Nav Links */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2.5 py-3 space-y-1">
                {SAFETY_SIDEBAR_ITEMS.map((item) => {
                    const isActive = activeCategory.toLowerCase() === item.key.toLowerCase();
                    const icon = getSafetyItemIcon(item.key, isActive);

                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            prefetch={true}
                            onClick={onCloseMobileMenu}
                            title={sidebarCollapsed ? item.label : undefined}
                            className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${sidebarCollapsed ? "justify-center px-0 py-2.5" : "justify-start px-3 py-2.5 gap-3"
                                } ${isActive
                                    ? "bg-[#880b13] text-white shadow-xs font-black border border-rose-900/40"
                                    : "bg-transparent hover:bg-rose-50/70 text-slate-700 hover:text-[#880b13]"
                                }`}
                        >
                            <div className={`flex items-center justify-center ${sidebarCollapsed ? "w-full" : "gap-2.5 min-w-0"}`}>
                                {icon}
                                {!sidebarCollapsed && (
                                    <span className="truncate text-left font-bold text-xs">{item.label}</span>
                                )}
                            </div>
                        </Link>
                    );
                })}

                {/* Back to Supervisor Dashboard button */}
                <div className="pt-3">
                    <Link
                        href="/supervisor/dashboard"
                        className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 ${sidebarCollapsed ? "justify-center px-0 py-2.5" : "justify-start px-3 py-2.5 gap-3"
                            }`}
                        title={sidebarCollapsed ? "Back to Supervisor Dashboard" : undefined}
                    >
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-slate-200 text-slate-700">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                            </svg>
                        </span>
                        {!sidebarCollapsed && <span className="truncate text-left font-bold text-xs">Supervisor Dashboard</span>}
                    </Link>
                </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/80 shrink-0">
                <div className={`flex items-center gap-2 ${sidebarCollapsed ? "justify-center flex-col" : "justify-between"}`}>
                    <div className={`flex items-center min-w-0 ${sidebarCollapsed ? "justify-center w-full" : "gap-2"}`}>
                        <div className="w-8 h-8 rounded-xl bg-[#880b13] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs" title={user?.name || "Ganesh Bhagat"}>
                            {(user?.name || "G").charAt(0).toUpperCase()}
                        </div>
                        {!sidebarCollapsed && (
                            <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 truncate">{user?.name || "Ganesh Bhagat"}</div>
                                <div className="text-[10px] font-semibold text-slate-400 truncate max-w-[110px]" title={user?.role || "Supervisor"}>
                                    {user?.role || "Supervisor"}
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
