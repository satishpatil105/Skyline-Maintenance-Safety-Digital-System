"use client";

import Image from "next/image";
import logoImg from "@/app/logo.png";
import type { SessionUser } from "@/lib/auth";

export interface View {
    key: string;
    label: string;
    known: string | null;
    rowCount?: number;
    isNew?: boolean;
}

interface AdminSidebarProps {
    views: View[];
    activeView: string;
    user: SessionUser;
    sidebarCollapsed: boolean;
    mobileMenuOpen: boolean;
    onSelectView: (key: string) => void;
    onCloseMobileMenu: () => void;
}

export function getSidebarIcon(key: string, label: string, isActive: boolean) {
    const l = (label || key || "").toLowerCase();

    if (l.includes("dashboard")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-rose-100 text-[#880b13]"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
                </svg>
            </span>
        );
    }
    if (l.includes("machine")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.07a4.5 4.5 0 0 0 4.486-6.32l-3.276 3.277a1.5 1.5 0 0 1-2.122-2.122l3.277-3.276a4.5 4.5 0 0 0-6.32 4.486c.118.58.094 1.193-.07 1.743" />
                </svg>
            </span>
        );
    }
    if (l.includes("breakdown")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
            </span>
        );
    }
    if (l.includes("checklist")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            </span>
        );
    }
    if (l.includes("hira")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 -10.05a9 9 0 1 1-9 9 9 9 0 0 1 9-9zm0 13.5h.008v.008H12v-.008z" />
                </svg>
            </span>
        );
    }
    if (l.includes("environmental") || l.includes("environment")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-green-100 text-green-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0 0a8.949 8.949 0 0 0 4.951-1.488A3.987 3.987 0 0 0 13 16h-2a3.987 3.987 0 0 0-3.951 3.512A8.949 8.949 0 0 0 12 21z" />
                </svg>
            </span>
        );
    }
    if (l.includes("fire")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                </svg>
            </span>
        );
    }
    if (l.includes("employee") && !l.includes("safety")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-violet-100 text-violet-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h-6m6 3h-6m3 6a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
                </svg>
            </span>
        );
    }
    if (l.includes("user")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
            </span>
        );
    }
    if (l.includes("training")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147L12 14.6l7.74-4.453a.75.75 0 000-1.294L12 4.4 4.26 8.853a.75.75 0 000 1.294zM12 14.6v6M6 11.5v4.5a6 6 0 0012 0v-4.5" />
                </svg>
            </span>
        );
    }
    if (l.includes("audit")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h3m2.25-9h-10.5A2.25 2.25 0 004.5 5.25v13.5A2.25 2.25 0 006.75 21h10.5a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0017.25 3z" />
                </svg>
            </span>
        );
    }
    if (l.includes("maintenance")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-[#880b13]/10 text-[#880b13]"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.398-3.03 1.164l-6.84 6.84a2.25 2.25 0 0 1-3.182-3.182l6.84-6.84c.766-.766 1.255-1.954 1.164-3.03A4.5 4.5 0 0 1 16.5 2.25a.75.75 0 0 1 .65.375l2.25 3.75a.75.75 0 0 1-.15.825l-.75.75a.75.75 0 0 0 0 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l.75-.75a.75.75 0 0 1 .825-.15l3.75 2.25a.75.75 0 0 1 .375.65Z" />
                </svg>
            </span>
        );
    }
    if (l.includes("safety")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-teal-100 text-teal-800"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
            </span>
        );
    }
    if (l.includes("parts") || l.includes("amc")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
            </span>
        );
    }
    if (l.includes("document") || l.includes("register") || l.includes("sop") || l.includes("manual")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
            </span>
        );
    }
    if (l.includes("notification") || l.includes("alert")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
            </span>
        );
    }
    if (l.includes("month") || l.includes("track") || l.includes("compliance")) {
        return (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
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

export function cleanSidebarLabel(label: string): string {
    const l = (label || "").toLowerCase();
    if (l.includes("analytics") || l.includes("telemetry")) return "Analytics & Telemetry";
    if (/^9\.\s*dashboard$/i.test(label) || l === "dashboard") return "Dashboard";
    if (l.includes("employee") && !l.includes("safety")) return "Employee Master";
    if (/^1\.\s*user master$/i.test(label) || l.includes("user")) return "User & Role Master";
    if (/^2\.\s*checklist master$/i.test(label) || l.includes("checklist")) return "Checklist Master";
    if (l.includes("breakdown")) return "Breakdowns & Repairs";
    if (/^3\.\s*maintenance/i.test(label) || l.includes("maintenance")) return "Maintenance Records";
    if (l.includes("fire_safety") || l === "fire safety") return "Fire Safety";
    if (l.includes("employee_safety") || l === "employee safety") return "Employee Safety";
    if (l.includes("other_safety") || l === "other safety") return "Other Safety";
    if (l.includes("hira")) return "HIRA (Hazard ID)";
    if (l.includes("environmental") || l.includes("environment")) return "Environmental Safety";
    if (l.includes("training")) return "Training Records";
    if (l.includes("audit")) return "System Audit Logs";
    if (/^4\.\s*safety/i.test(label) || l.includes("safety")) return "Safety Records";
    if (/^6\.\s*pm parts amc$/i.test(label) || l.includes("parts") || l.includes("amc")) return "PM Parts & AMC";
    if (/^7\.\s*document register$/i.test(label) || l.includes("document") || l.includes("register")) return "Document Register";
    if (/^8\.\s*notifications$/i.test(label) || l.includes("notification") || l.includes("alert")) return "Notifications & Alerts";
    if (/^10\.\s*monthly tracking$/i.test(label) || l.includes("month") || l.includes("compliance")) return "Monthly Compliance";
    return label;
}

export function getViewCategory(view: View): string {
    const l = (view.label || view.key || "").toLowerCase();
    if (l.includes("dashboard") || l.includes("analytics")) return "OVERVIEW";
    if (l.includes("machine") || l.includes("maintenance") || l.includes("breakdown") || l.includes("part") || l.includes("amc")) return "OPERATIONS & MACHINERY";
    if (l.includes("safety") || l.includes("checklist") || l.includes("hira") || l.includes("environmental") || l.includes("environment") || l.includes("fire") || l.includes("compliance") || l.includes("month")) return "SAFETY & COMPLIANCE";
    if (l.includes("employee") || l.includes("user") || l.includes("training") || l.includes("document") || l.includes("register")) return "PEOPLE & DOCUMENTS";
    return "SYSTEM & LOGS";
}

export default function AdminSidebar({
    views,
    activeView,
    user,
    sidebarCollapsed,
    mobileMenuOpen,
    onSelectView,
    onCloseMobileMenu,
}: AdminSidebarProps) {
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
                                Admin
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

            {/* Scrollable Sidebar Nav Links with Categorized Section Headers */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2.5 py-3 space-y-4">
                {(["OVERVIEW", "OPERATIONS & MACHINERY", "SAFETY & COMPLIANCE", "PEOPLE & DOCUMENTS", "SYSTEM & LOGS"] as const).map((category) => {
                    const categoryViews = views.filter((v) => getViewCategory(v) === category);
                    if (categoryViews.length === 0) return null;

                    return (
                        <div key={category} className="space-y-1">
                            {!sidebarCollapsed && (
                                <div className="px-3 pt-1 pb-1.5 text-[10px] font-black tracking-wider text-slate-400 uppercase select-none flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#880b13]/40 inline-block"></span>
                                    {category}
                                </div>
                            )}
                            {categoryViews.map((v) => {
                                const isActive = activeView === v.key;
                                const icon = getSidebarIcon(v.key, v.label, isActive);
                                const cleanLabel = cleanSidebarLabel(v.label);

                                return (
                                    <button
                                        key={v.key}
                                        type="button"
                                        onClick={() => {
                                            onSelectView(v.key);
                                            onCloseMobileMenu();
                                        }}
                                        title={sidebarCollapsed ? cleanLabel : undefined}
                                        className={`w-full flex items-center rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${sidebarCollapsed ? "justify-center px-0 py-2.5" : "justify-start px-3 py-2.5 gap-3"
                                            } ${isActive
                                                ? "bg-[#880b13] text-white shadow-xs font-black border border-rose-900/40"
                                                : "bg-transparent hover:bg-rose-50/70 text-slate-700 hover:text-[#880b13]"
                                            }`}
                                    >
                                        <div className={`flex items-center justify-center ${sidebarCollapsed ? "w-full" : "gap-2.5 min-w-0"}`}>
                                            {icon}
                                            {!sidebarCollapsed && (
                                                <span className="truncate text-left font-bold text-xs">{cleanLabel}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Sidebar Footer: Logged in Administrator Profile & Logout Button */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/80 shrink-0">
                <div className={`flex items-center gap-2 ${sidebarCollapsed ? "justify-center flex-col" : "justify-between"}`}>
                    <div className={`flex items-center min-w-0 ${sidebarCollapsed ? "justify-center w-full" : "gap-2"}`}>
                        <div className="w-8 h-8 rounded-xl bg-[#880b13] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs" title={user.name}>
                            {(user.name || "A").charAt(0).toUpperCase()}
                        </div>
                        {!sidebarCollapsed && (
                            <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 truncate">{user.name}</div>
                                <div className="text-[10px] font-semibold text-slate-400 truncate max-w-[110px]" title={user.email}>
                                    {user.email}
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
