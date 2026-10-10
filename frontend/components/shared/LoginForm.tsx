"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import logoImg from "@/app/logo.png";
import StatusBanner, { StatusType } from "./StatusBanner";

interface CurrentUserSummary {
  name: string;
  email: string;
  userId?: string;
  role: string;
}

type RoleOption = "Admin" | "Supervisor" | "Operator";

export default function LoginForm({
  next,
  targetAssetId,
  currentUser,
}: {
  next: string;
  targetAssetId?: string;
  currentUser?: CurrentUserSummary | null;
}) {
  const router = useRouter();

  // Selected Role Dropdown State (Defaults smartly based on next query if available)
  const [selectedRole, setSelectedRole] = useState<RoleOption>(() => {
    if (next?.toLowerCase().includes("/admin")) return "Admin";
    if (next?.toLowerCase().includes("/supervisor")) return "Supervisor";
    return "Operator";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assignedInfo, setAssignedInfo] = useState<{ name: string; assetId: string } | null>(null);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({
    type: null,
    message: "",
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus({ type: null, message: "" });
    setAssignedInfo(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role: selectedRole,
          targetAssetId: targetAssetId?.trim(),
          next: next?.trim(),
        }),
      });
      const result = await response.json();

      if (result.success) {
        let destination = result.redirectUrl || "/";
        if (!next || next === "/" || next === "/login") {
          if (selectedRole === "Admin") {
            destination = "/admin";
          } else if (selectedRole === "Supervisor") {
            destination = "/supervisor";
          } else if (selectedRole === "Operator") {
            destination = "/operator/dashboard";
          }
        }
        window.location.href = destination;
        return;
      }

      if (result.unauthorizedMachine) {
        if (result.assignedMachine && result.assignedAssetId) {
          setAssignedInfo({ name: result.assignedMachine, assetId: result.assignedAssetId });
        }
        setStatus({
          type: "error",
          message:
            result.message ||
            "Access Restricted: You are assigned to another machine. Another machine cannot be opened.",
        });
      } else {
        setStatus({
          type: "error",
          message: result.message || "Invalid User ID or password.",
        });
      }
    } catch {
      setStatus({
        type: "error",
        message: "Unable to reach authentication service. Please verify your connection.",
      });
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-[#fdfbfc] text-[#221013] font-sans flex flex-col justify-between selection:bg-[#a00d17] selection:text-white relative overflow-x-hidden">

      {/* Background Engineering Geometry & Corporate Radial Ambient Warmth */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage: `radial-gradient(#221013 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
        aria-hidden="true"
      />
      <div
        className="fixed top-0 right-1/4 w-[540px] h-[540px] pointer-events-none rounded-full blur-3xl opacity-20 bg-gradient-to-br from-[#fbeced] via-[#fdf2f3] to-transparent z-0"
        aria-hidden="true"
      />

      {/* ==================================================
          1. ENTERPRISE HEADER
      ================================================== */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#f0d5d8] px-4 sm:px-6 lg:px-8 py-3.5 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

          {/* Left: Brand Identity */}
          <Link href="/" className="flex items-center gap-3.5 group min-w-0" title="Skyline Home">
            <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-xl bg-white border border-[#edd2d5] p-1 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Image
                src={logoImg}
                alt="Skyline Project & Engineers Logo"
                width={48}
                height={48}
                className="w-full h-full object-contain filter drop-shadow-sm"
                priority
              />
            </div>
            <div className="min-w-0">
              <span className="text-sm sm:text-base md:text-[17px] font-black text-[#880b13] tracking-tight truncate block leading-tight">
                Skyline Project &amp; Engineers Pvt. Ltd.
              </span>
              <p className="text-[10px] sm:text-xs font-extrabold text-[#6f4b4f] tracking-wider uppercase truncate block mt-0.5">
                Maintenance &amp; Safety Management System
              </p>
            </div>
          </Link>

          {/* Right: Clean minimal link back to home */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#880b13] hover:text-[#5e050b] bg-white hover:bg-[#fff5f6] px-3.5 sm:px-4 py-2 rounded-xl border border-[#ebd0d4] hover:border-[#a00d17] transition-all duration-200 shadow-sm hover:shadow shrink-0"
          >
            <svg className="w-4 h-4 text-[#a00d17]" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden xs:inline">Back to Home</span>
            <span className="xs:hidden">Home</span>
          </Link>

        </div>
      </header>

      {/* ==================================================
          2. MASTER TWO-COLUMN LOGIN EXPERIENCE
      ================================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 flex-1 flex items-center justify-center relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-stretch w-full max-w-6xl mx-auto">

          {/* ==================================================
              LEFT SIDE: INDUSTRIAL ENTERPRISE BRANDING PANEL
              (Visible on Desktop/Laptop >= 1024px, Hidden on Mobile/Tablet)
          ================================================== */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-between rounded-3xl bg-gradient-to-br from-[#110507] via-[#18090c] to-[#0a0204] border border-[#3d1217] p-8 lg:p-10 xl:p-12 text-white shadow-2xl relative overflow-hidden min-h-[560px] xl:min-h-[600px]">

            {/* Subtle Behind-Content Background Watermark */}
            <div
              className="absolute -right-12 -bottom-12 w-80 h-80 pointer-events-none opacity-[0.045] bg-no-repeat bg-contain select-none"
              style={{ backgroundImage: `url('/skyline-logo.png')` }}
              aria-hidden="true"
            />
            <div
              className="absolute top-0 right-0 w-80 h-80 pointer-events-none opacity-20 blur-3xl bg-gradient-to-b from-[#a00d17] to-transparent"
              aria-hidden="true"
            />

            <div className="relative z-10 space-y-6">

              {/* Badge */}
              <div>
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/15 text-[11px] font-extrabold text-[#ffb3ba] uppercase tracking-wider backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-[#ff3344] animate-pulse" />
                  <span>INDUSTRIAL SAFETY &amp; MAINTENANCE</span>
                </span>
              </div>

              {/* Title & Slogan */}
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.12]">
                  One Platform.<br />
                  <span className="bg-gradient-to-r from-[#e62635] via-[#ff4d5a] to-[#ff858f] bg-clip-text text-transparent">
                    Every Process.
                  </span>
                </h1>
                <p className="text-sm sm:text-[15px] text-[#e2d5d7] font-medium leading-relaxed max-w-xl pt-1">
                  Digitize maintenance, safety inspections, compliance, and breakdown prevention with one connected industrial platform.
                </p>
              </div>

              {/* 4 Feature Badges (Professional SVG Icons) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">

                {/* 1. Preventive Maintenance */}
                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-[#a00d17]/60 hover:bg-white/[0.07] transition-all duration-200 group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#a00d17]/40 to-[#60060e]/30 border border-[#a00d17]/60 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <svg className="w-5 h-5 text-[#ff99a2]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.07a4.5 4.5 0 0 0 4.486-6.32l-3.276 3.277a1.5 1.5 0 0 1-2.122-2.122l3.277-3.276a4.5 4.5 0 0 0-6.32 4.486c.118.58.094 1.193-.07 1.743" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block truncate">
                      Preventive Maintenance
                    </span>
                    <span className="text-xs text-[#d1bec2] font-medium block truncate mt-0.5">
                      Scheduled PM &amp; Health
                    </span>
                  </div>
                </div>

                {/* 2. Digital Machine Inspections */}
                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-[#a00d17]/60 hover:bg-white/[0.07] transition-all duration-200 group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#a00d17]/40 to-[#60060e]/30 border border-[#a00d17]/60 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <svg className="w-5 h-5 text-[#ff99a2]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75ZM6.75 16.5h.008v.008H6.75V16.5ZM16.5 6.75h.008v.008H16.5V6.75ZM13.5 13.5h3v3h-3v-3ZM16.5 19.5h3v-3h-3v3ZM19.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75Z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block truncate">
                      Digital Machine Inspections
                    </span>
                    <span className="text-xs text-[#d1bec2] font-medium block truncate mt-0.5">
                      Instant QR Scan Sign-off
                    </span>
                  </div>
                </div>

                {/* 3. Safety & HIRA Audits */}
                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-[#a00d17]/60 hover:bg-white/[0.07] transition-all duration-200 group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#a00d17]/40 to-[#60060e]/30 border border-[#a00d17]/60 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <svg className="w-5 h-5 text-[#ff99a2]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block truncate">
                      Safety &amp; HIRA Audits
                    </span>
                    <span className="text-xs text-[#d1bec2] font-medium block truncate mt-0.5">
                      Zero-Incident Governance
                    </span>
                  </div>
                </div>

                {/* 4. Audit Traceability */}
                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-[#a00d17]/60 hover:bg-white/[0.07] transition-all duration-200 group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#a00d17]/40 to-[#60060e]/30 border border-[#a00d17]/60 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <svg className="w-5 h-5 text-[#ff99a2]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block truncate">
                      Audit Traceability
                    </span>
                    <span className="text-xs text-[#d1bec2] font-medium block truncate mt-0.5">
                      Immutable Activity Records
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom Slogan Panel */}
            <div className="relative z-10 pt-6 mt-6 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-xs font-bold text-white/90 tracking-wide">
                Skyline Project &amp; Engineers Pvt. Ltd.
              </span>
              <span className="text-xs text-[#b39da1] font-medium hidden sm:inline">
                Industrial Plant Maintenance Portal
              </span>
            </div>

          </div>

          {/* ==================================================
              RIGHT SIDE: ENTERPRISE AUTHENTICATION CARD
              (Centered and fully responsive on all devices)
          ================================================== */}
          <div className="w-full lg:col-span-5 flex items-center justify-center">
            <div className="w-full max-w-[480px] bg-white border border-[#ebd2d6] rounded-3xl shadow-2xl shadow-[#a00d17]/[0.08] relative overflow-hidden mx-auto transition-all">

              {/* Top Skyline Brand Stripe */}
              <div className="h-1.5 w-full bg-gradient-to-r from-[#880b13] via-[#e62635] to-[#880b13]" />

              <div className="p-7 sm:p-9 lg:p-10 space-y-6">

                {/* Card Header & Security Badge */}
                <div className="space-y-3 text-left">
                  <div className="flex items-center justify-between pb-0.5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fff0f2] border border-[#f5cbd0] text-[11px] font-black text-[#880b13] uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
                      AUTHORIZED ACCESS
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8a686e]">
                      <svg className="w-3.5 h-3.5 text-[#16a34a]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                      </svg>
                      256-Bit Encrypted
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-2xl sm:text-[28px] font-black text-[#1a0609] tracking-tight leading-tight">
                      Welcome Back
                    </h2>
                    <p className="text-xs sm:text-[13px] text-[#6d4d52] font-medium leading-relaxed">
                      Sign in to access your designated workspace and equipment.
                    </p>
                  </div>
                </div>

                {/* Already Signed In Notice */}
                {currentUser && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/90 p-3.5 text-xs text-blue-950 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="font-bold block">Currently signed in:</span>
                      <span className="text-blue-900 font-medium">{currentUser.name} ({currentUser.userId || currentUser.email})</span>
                    </div>
                    <a
                      href="/api/auth/logout"
                      className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
                    >
                      Log Out
                    </a>
                  </div>
                )}

                {/* Target Workstation notice if QR scan login */}
                {targetAssetId && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-950 flex items-start gap-2.5 shadow-xs">
                    <svg className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.75a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5V21" />
                    </svg>
                    <div>
                      <span className="font-bold block">Workstation: {targetAssetId}</span>
                      <span className="text-amber-900/90 text-[11px] leading-relaxed">
                        Log in with your operator credentials to unlock this workstation.
                      </span>
                    </div>
                  </div>
                )}

                {/* Login Form */}
                <form className="space-y-4" onSubmit={submit}>

                  {/* 1. PROFESSIONAL ROLE SELECTOR (Admin, Supervisor, Operator) */}
                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Designated Role <span className="text-[#880b13]">*</span>
                      </label>
                      <span className="text-[11px] font-bold text-[#880b13] bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">
                        {selectedRole} Portal
                      </span>
                    </div>

                    {/* Interactive 3-Way Role Selector Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      {(["Admin", "Supervisor", "Operator"] as RoleOption[]).map((role) => {
                        const active = selectedRole === role;
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setSelectedRole(role)}
                            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${active
                              ? "bg-[#880b13] text-white border-[#880b13] shadow-md shadow-[#880b13]/25 scale-[1.02]"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300"
                              }`}
                          >
                            {role === "Admin" && (
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.004 0H9.496m5.004 0a3 3 0 0 0 2.25-1.002l1.636-1.964a.75.75 0 0 0-.576-1.234H6.19a.75.75 0 0 0-.576 1.234l1.636 1.964a3 3 0 0 0 2.25 1.002" />
                              </svg>
                            )}
                            {role === "Supervisor" && (
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                              </svg>
                            )}
                            {role === "Operator" && (
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.07a4.5 4.5 0 0 0 4.486-6.32l-3.276 3.277a1.5 1.5 0 0 1-2.122-2.122l3.277-3.276a4.5 4.5 0 0 0-6.32 4.486c.118.58.094 1.193-.07 1.743" />
                              </svg>
                            )}
                            <span>{role}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. USER ID / WORK EMAIL INPUT */}
                  <div className="space-y-2 text-left">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="loginEmail">
                      User ID or Work Email <span className="text-[#880b13]">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                      </div>
                      <input
                        id="loginEmail"
                        type="text"
                        style={{ paddingLeft: "44px" }}
                        className="w-full h-12 pr-4 text-sm font-semibold bg-slate-50/60 hover:bg-white focus:bg-white border border-slate-300 focus:border-[#880b13] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#880b13]/20 transition-all text-slate-900 placeholder:text-slate-400 shadow-sm"
                        placeholder={
                          selectedRole === "Admin"
                            ? "e.g. ADM-001 or admin email"
                            : selectedRole === "Supervisor"
                              ? "e.g. SP-001 or supervisor email"
                              : "e.g. OP-001 or operator ID"
                        }
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 3. PASSWORD INPUT */}
                  <div className="space-y-2 text-left">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="loginPassword">
                      Password <span className="text-[#880b13]">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                      </div>
                      <input
                        id="loginPassword"
                        type={showPassword ? "text" : "password"}
                        style={{ paddingLeft: "44px", paddingRight: "44px" }}
                        className="w-full h-12 text-sm font-semibold bg-slate-50/60 hover:bg-white focus:bg-white border border-slate-300 focus:border-[#880b13] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#880b13]/20 transition-all text-slate-900 placeholder:text-slate-400 shadow-sm"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                        title={showPassword ? "Hide password" : "Show password"}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <div className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* 4. SIGN IN BUTTON */}
                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-[#880b13] via-[#a20e19] to-[#bf131e] hover:from-[#72070e] hover:to-[#960d17] text-white font-extrabold text-sm tracking-wide shadow-lg shadow-[#880b13]/25 hover:shadow-xl hover:shadow-[#880b13]/35 active:scale-[0.99] transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2.5 border border-[#c41e2a]/30 group cursor-pointer"
                    disabled={busy}
                  >
                    {busy ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-white/90" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                        </svg>
                        <span>{targetAssetId ? `Unlock ${targetAssetId}` : "Sign In to SkyMS"}</span>
                        <svg className="w-4 h-4 text-white/70 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </>
                    )}
                  </button>

                  {/* Status Message */}
                  <StatusBanner type={status.type} message={status.message} />

                  {/* Machine Assignment Notice */}
                  {assignedInfo && (
                    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5 text-center space-y-2">
                      <p className="text-xs text-emerald-900 font-semibold">
                        Your designated workstation: <strong>{assignedInfo.name}</strong>
                      </p>
                      <a
                        href={`/machine/${encodeURIComponent(assignedInfo.assetId)}`}
                        className="inline-block rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow transition-colors"
                      >
                        Open My Assigned Machine ({assignedInfo.name})
                      </a>
                    </div>
                  )}

                  {/* Enterprise Card Footer */}
                  <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5 font-bold text-slate-600">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Enterprise Access
                    </span>
                    <span className="font-semibold text-slate-400">
                      Skyline Safety &amp; Maintenance
                    </span>
                  </div>

                </form>
              </div>
            </div>
          </div>

        </div>
      </main>

    </div>
  );
}
