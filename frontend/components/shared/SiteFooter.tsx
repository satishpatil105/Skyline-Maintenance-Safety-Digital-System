"use client";

import Link from "next/link";
import Image from "next/image";
import logoImg from "@/app/logo.png";

export default function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0e0709] text-slate-300 pt-16 pb-8 border-t border-[#2e1014] relative z-10 font-sans selection:bg-[#a00d17] selection:text-white overflow-hidden">
      {/* Subtle top ambient red glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 max-w-4xl h-32 pointer-events-none opacity-20 blur-3xl bg-gradient-to-b from-[#e62635] to-transparent"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">

        {/* ==================================================
            1. BRAND SECTION (Top Centered Area)
        ================================================== */}
        <div className="pb-10 border-b border-white/10 text-center flex flex-col items-center justify-center space-y-3">
          {/* Logo centered (Medium, transparent background) */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
            <Image
              src={logoImg}
              alt="Skyline Project & Engineers Logo"
              width={96}
              height={96}
              className="w-full h-full object-contain filter drop-shadow-md"
              priority
            />
          </div>

          {/* Company Title */}
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-[1.65rem] font-bold text-white tracking-tight leading-snug">
              Skyline Project &amp; Engineers <span className="text-[#e62635]">Pvt. Ltd.</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-semibold tracking-wider uppercase mt-1">
              MAINTENANCE &amp; SAFETY MANAGEMENT SYSTEM
            </p>
          </div>

          {/* Concise Professional Description */}
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal max-w-xl mx-auto">
            An integrated digital platform for industrial maintenance, safety inspections, compliance and breakdown prevention.
          </p>
        </div>

        {/* ==================================================
            2. FOUR BALANCED FOOTER COLUMNS
        ================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-8 py-10">

          {/* COLUMN 1: USER MODULE */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#e62635] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e62635]"></span>
              User Module
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-400 font-normal">
              <li>
                <Link href="/dashboard" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Operator Dashboard</span>
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>My Machine QR</span>
                </Link>
              </li>
              <li>
                <Link href="/checklist" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Daily Checklists</span>
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Report Breakdown</span>
                </Link>
              </li>
              <li>
                <Link href="/safety" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Safety Observations</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 2: ADMIN MODULE */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#e62635] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e62635]"></span>
              Admin Module
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-400 font-normal">
              <li>
                <Link href="/admin?view=dashboard" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Dashboard</span>
                </Link>
              </li>
              <li>
                <Link href="/admin?tab=users" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>User &amp; Role Management</span>
                </Link>
              </li>
              <li>
                <Link href="/admin?tab=machines" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Asset &amp; Machine Master</span>
                </Link>
              </li>
              <li>
                <Link href="/admin?tab=checklist" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Checklist Master</span>
                </Link>
              </li>
              <li>
                <Link href="/admin?tab=safety" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Safety Department Audits</span>
                </Link>
              </li>
              <li>
                <Link href="/admin?view=dashboard" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Live Analytics</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: QUICK LINKS */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#e62635] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e62635]"></span>
              Quick Links
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-400 font-normal">
              <li>
                <Link href="/" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Home</span>
                </Link>
              </li>
              <li>
                <a href="/#why-skyms" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>About Skyline</span>
                </a>
              </li>
              <li>
                <a href="/#how-it-works" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>How It Works</span>
                </a>
              </li>
              <li>
                <Link href="/login" className="group flex items-center gap-2 hover:text-white transition-colors duration-200">
                  <svg className="w-3 h-3 text-slate-500 group-hover:text-[#e62635] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Login Portal</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 4: CONTACT US */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#e62635] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e62635]"></span>
              Contact Us
            </h3>

            <div className="space-y-3.5 text-xs text-slate-400 font-normal">
              {/* Company row */}
              <div className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-[#e62635] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.75a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5V21" />
                </svg>
                <span className="text-slate-200 font-bold leading-snug">
                  Skyline Project &amp; Engineers Pvt. Ltd.
                </span>
              </div>

              {/* Phone numbers */}
              <div className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-[#e62635] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
                <div className="space-y-1">
                  <a href="tel:+919422311749" className="block hover:text-[#e62635] transition-colors duration-200">
                    +91 9422311749
                  </a>
                  <a href="tel:+918390988406" className="block hover:text-[#e62635] transition-colors duration-200">
                    +91 8390988406
                  </a>
                </div>
              </div>

              {/* Email addresses */}
              <div className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-[#e62635] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                <div className="space-y-1 break-all">
                  <a href="mailto:skylineproject@skylinepune.com" className="block hover:text-[#e62635] transition-colors duration-200">
                    skylineproject@skylinepune.com
                  </a>
                  <a href="mailto:skylineproject197@gmail.com" className="block hover:text-[#e62635] transition-colors duration-200">
                    skylineproject197@gmail.com
                  </a>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* ==================================================
            3. COPYRIGHT BOTTOM BAR
        ================================================== */}
        <div className="pt-6 border-t border-white/10 text-center text-xs text-slate-500 font-normal">
          <p className="leading-relaxed">
            &copy; {currentYear} Skyline Project &amp; Engineers Pvt. Ltd. &bull; SkyMS &mdash; Maintenance &amp; Safety Management System. All Rights Reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}
