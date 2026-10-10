"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SafetySidebar from "./SafetySidebar";
import SafetyDeptClient from "@/components/supervisor/SafetyDeptClient";
import MachineQrScannerModal from "@/components/operator/MachineQrScannerModal";
import type { SessionUser } from "@/lib/auth";
import type { DeptCategory } from "@/lib/safetyDeptConfig";

interface SafetyCategoryViewProps {
    user: SessionUser;
    category: DeptCategory;
    canSubmit: boolean;
    canClose: boolean;
}

export default function SafetyCategoryView({ user, category, canSubmit, canClose }: SafetyCategoryViewProps) {
    const router = useRouter();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [qrScannerOpen, setQrScannerOpen] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const handleSelectCategory = (key: string) => {
        if (key === "overview") {
            router.push("/supervisor/safety/dashboard");
        } else {
            router.push(`/supervisor/safety/${key}`);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans antialiased">
            {/* DEDICATED SAFETY SIDEBAR */}
            <SafetySidebar
                activeCategory={category.id}
                user={user}
                sidebarCollapsed={sidebarCollapsed}
                mobileMenuOpen={mobileMenuOpen}
                onSelectCategory={handleSelectCategory}
                onCloseMobileMenu={() => setMobileMenuOpen(false)}
            />

            {/* RIGHT CONTENT AREA */}
            <div
                className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"
                    }`}
            >
                {/* SUPERVISOR TOP HEADER WITH TOGGLE BUTTON & BREADCRUMB */}
                <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                                    setMobileMenuOpen(!mobileMenuOpen);
                                } else {
                                    setSidebarCollapsed(!sidebarCollapsed);
                                }
                            }}
                            className="p-1.5 rounded-xl text-slate-500 hover:text-[#880b13] hover:bg-slate-100 transition-colors border border-slate-200 shadow-2xs shrink-0 cursor-pointer"
                            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>

                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Supervisor Portal</span>
                                <span className="text-xs font-semibold text-slate-300 hidden sm:inline">/</span>
                                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate leading-tight">
                                    {category.label}
                                </h1>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        {/* TOP-RIGHT SCAN MACHINE QR BUTTON */}
                        <button
                            type="button"
                            onClick={() => setQrScannerOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-[#880b13] px-3 py-1.5 text-xs font-black shadow-2xs transition-all cursor-pointer"
                        >
                            <span>📷</span>
                            <span className="hidden sm:inline">Scan Machine QR</span>
                        </button>

                        {/* TOP-RIGHT + NEW RECORD BUTTON */}
                        {canSubmit && (
                            <button
                                type="button"
                                onClick={() => setShowForm((s) => !s)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#880b13] hover:bg-rose-900 text-white px-3.5 py-1.5 text-xs font-black shadow-2xs transition-all cursor-pointer"
                            >
                                <span>{showForm ? "✕ Close Form" : `+ New ${category.label} Record`}</span>
                            </button>
                        )}
                    </div>
                </header>

                {/* MAIN BODY CONTENT */}
                <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
                    <SafetyDeptClient
                        category={category.id}
                        canSubmit={canSubmit}
                        canClose={canClose}
                        externalShowForm={showForm}
                        onToggleForm={() => setShowForm((s) => !s)}
                    />
                </main>
            </div>

            {/* MACHINE QR SCANNER MODAL */}
            <MachineQrScannerModal isOpen={qrScannerOpen} onClose={() => setQrScannerOpen(false)} user={user} />
        </div>
    );
}
