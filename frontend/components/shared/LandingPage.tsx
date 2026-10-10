"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import logoImg from "@/app/logo.png";
import SiteFooter from "@/components/shared/SiteFooter";

/**
 * CountUpStat:
 * Animates number from 0 to target value smoothly when scrolled into viewport.
 */
function CountUpStat({ end, suffix = "+" }: { end: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const startAnimation = () => {
      if (started.current) return;
      started.current = true;
      const duration = 1600;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Smooth ease-out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        setVal(Math.floor(ease * end));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setVal(end);
        }
      };
      requestAnimationFrame(animate);
    };

    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            startAnimation();
            observer.disconnect();
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      startAnimation();
    }
  }, [end]);

  return (
    <span ref={ref} className="tabular-nums font-black text-2xl sm:text-3xl text-[#1c191a]">
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

/**
 * useInView:
 * Detects when a section enters the viewport to trigger animations.
 */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isInView] as const;
}

export default function LandingPage({ isLoggedIn = false, role = "" }: { isLoggedIn?: boolean; role?: string }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [heroMounted, setHeroMounted] = useState(false);
  const [uptimeCount] = useState(99.4);

  const dashboardUrl =
    role === "Admin"
      ? "/admin?view=dashboard"
      : role === "Supervisor"
        ? "/supervisor"
        : "/operator/dashboard";

  // Viewport intersection observers
  const [statsRef, statsInView] = useInView(0.15);
  const [rolesRef, rolesInView] = useInView(0.1);
  const [whyRef, whyInView] = useInView(0.08);
  const [howRef, howInView] = useInView(0.1);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    setHeroMounted(true);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>

      {/* SCOPED ANIMATION STYLES */}
      <style>{`
        .skyms-reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }
        .skyms-reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .skyms-reveal {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* MAIN CONTAINER */}
      <div className="min-h-screen bg-[#fcfbfc] text-[#2e2022] font-sans selection:bg-[#a00d17] selection:text-white scroll-smooth relative overflow-x-hidden">

        {/* Subtle Background Industrial Watermark */}
        <div
          className="fixed inset-0 pointer-events-none z-0 opacity-[0.035] mix-blend-multiply"
          style={{
            backgroundImage: `url('/skyline-logo.png')`,
            backgroundPosition: 'center 40%',
            backgroundSize: 'min(75vmin, 620px)',
            backgroundRepeat: 'no-repeat'
          }}
          aria-hidden="true"
        />

        {/* 1. STICKY CORPORATE HEADER */}
        <header
          className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled
            ? "bg-white/95 backdrop-blur-md shadow-md border-b border-[#f4dde0]"
            : "bg-white/90 backdrop-blur-sm border-b border-[#f4dde0]/80"
            }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[96px] py-2 flex items-center justify-between">

            {/* Left: Brand Logo & Title */}
            <Link href="/" className="flex items-center gap-3.5 sm:gap-4 group text-left">
              <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                <Image
                  src={logoImg}
                  alt="Skyline Project & Engineers Logo"
                  width={80}
                  height={80}
                  priority
                  className="w-full h-full object-contain drop-shadow-xs"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-[#880b13]">
                    Skyline Project &amp; Engineers Pvt. Ltd.
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#4a3437] tracking-tight block mt-0.5 truncate">
                  Maintenance &amp; Safety Management System
                </p>
              </div>
            </Link>

            {/* Center: Navigation Links */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-[#4a3437]">
              <Link
                href="/"
                className="text-[#a00d17] border-b-2 border-[#a00d17] pb-1 transition-colors"
              >
                Home
              </Link>
              <a
                href="#why-skyms"
                className="hover:text-[#a00d17] transition-colors py-1 hover:-translate-y-0.5 transform duration-150"
              >
                About
              </a>
              <a
                href="#how-it-works"
                className="hover:text-[#a00d17] transition-colors py-1 hover:-translate-y-0.5 transform duration-150"
              >
                How It Works
              </a>
            </nav>

            {/* Right: Actions & Login Button */}
            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <Link
                  href={dashboardUrl}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#880b13] to-[#a00d17] hover:from-[#6f0912] hover:to-[#880b13] text-white font-bold px-5 py-2.5 rounded-xl shadow-md shadow-[#a00d17]/20 transition-all hover:scale-105 active:scale-95 text-sm"
                >
                  <span>Dashboard</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#880b13] via-[#a00d17] to-[#c2141f] hover:from-[#6f0912] hover:to-[#880b13] text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-[#a00d17]/20 transition-all hover:scale-105 active:scale-95 text-sm border border-[#a00d17]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>Login</span>
                </Link>
              )}

              {/* Mobile Hamburger Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-[#4a3437] hover:bg-[#fbeced] hover:text-[#a00d17] transition-colors border border-[#f4dde0]"
                aria-label="Toggle Navigation Menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-white border-b border-[#f4dde0] px-4 pt-2 pb-5 space-y-3 shadow-xl">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-bold text-[#a00d17] bg-[#fbeced]"
              >
                Home
              </Link>
              <a
                href="#why-skyms"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-bold text-[#4a3437] hover:bg-slate-50"
              >
                About
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-bold text-[#4a3437] hover:bg-slate-50"
              >
                How It Works
              </a>
              <div className="pt-2 border-t border-slate-100">
                <Link
                  href={isLoggedIn ? dashboardUrl : "/login"}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#a00d17] text-white font-bold py-3 rounded-xl shadow-md text-sm"
                >
                  <span>{isLoggedIn ? "Open Dashboard" : "Staff Login"}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>
          )}
        </header>

        {/* 2. HERO SECTION */}
        <section className="relative overflow-hidden pt-10 pb-16 lg:pt-16 lg:pb-24 z-10">

          {/* Subtle Red Corporate Glow Background */}
          <div className="absolute top-0 right-1/4 w-[600px] h-[450px] bg-gradient-to-br from-[#fbeced]/80 via-[#fcf1f2]/40 to-transparent blur-3xl rounded-full pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">

              {/* Left Column: Hero Copy with subtle entrance animation */}
              <div
                className={`lg:col-span-7 space-y-6 text-left transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${heroMounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                  }`}
              >

                {/* Premium Corporate Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#fbeced] border border-[#e8c4c8] text-[#a00d17] text-xs font-black tracking-wider uppercase shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#a00d17] animate-ping" />
                  <span>PLAN SMARTER. MAINTAIN BETTER. ZERO BREAKDOWNS.</span>
                </div>

                {/* Main Heading */}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#1c191a] leading-[1.18]">
                  Master Your <br />
                  <span className="bg-gradient-to-r from-[#880b13] via-[#a00d17] to-[#c2141f] bg-clip-text text-transparent">
                    Industrial Maintenance
                  </span> <br />
                  &amp; Safety Journey
                </h1>

                {/* Supporting Text */}
                <p className="text-base sm:text-lg text-[#4a3437] max-w-xl font-medium leading-relaxed">
                  A powerful digital workspace to track machinery maintenance, execute QR inspections, manage safety audits, and build zero-accident operations with clarity and control.
                </p>

                {/* Checklist of Core Capabilities */}
                <div className="space-y-3 pt-1">
                  {[
                    "Track machinery uptime & PM schedules efficiently",
                    "Execute digital checklists & QR inspections seamlessly",
                    "Analyze plant safety audits with real-time insights",
                    "Build consistency with daily zero-breakdown workflows",
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm font-bold text-[#332225]">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#fbeced] text-[#a00d17] border border-[#e8c4c8] flex items-center justify-center text-xs font-black shadow-xs">
                        ✓
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Action Buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <Link
                    href={isLoggedIn ? dashboardUrl : "/login"}
                    className="inline-flex items-center gap-2.5 bg-gradient-to-r from-[#880b13] via-[#a00d17] to-[#c2141f] hover:from-[#6f0912] hover:to-[#880b13] text-white font-extrabold px-8 py-3.5 rounded-xl shadow-lg shadow-[#a00d17]/25 transition-all hover:scale-105 active:scale-95 text-base border border-[#a00d17]"
                  >
                    <span>{isLoggedIn ? "Open Dashboard" : "Get Started"}</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>

                  <a
                    href="#why-skyms"
                    className="inline-flex items-center gap-2 bg-white hover:bg-[#fbeced]/60 border-2 border-[#e8c4c8] text-[#a00d17] font-extrabold px-7 py-3 rounded-xl shadow-xs transition-all hover:border-[#a00d17] text-base"
                  >
                    <span>About Skyline</span>
                  </a>
                </div>

              </div>

              {/* Right Column: Industrial Maintenance Dashboard Preview Card with entrance animation */}
              <div
                className={`lg:col-span-5 transition-all duration-700 delay-150 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${heroMounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                  }`}
              >
                <div className="relative mx-auto max-w-md lg:max-w-none rounded-3xl bg-white p-6 sm:p-7 border border-[#f4dde0] shadow-xl shadow-[#a00d17]/5 transition-all hover:shadow-2xl hover:border-[#e8c4c8]">

                  {/* Preview Header: Total Plant Uptime */}
                  <div className="flex items-start justify-between pb-5 border-b border-[#f4dde0]">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#6f4b4f]">
                        Total Plant Uptime
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-4xl font-black text-[#1c191a] tracking-tight">{uptimeCount}%</span>
                        <span className="text-xs font-bold text-[#a00d17] px-2 py-0.5 rounded-md bg-[#fbeced]">
                          Fleet Active
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700 block mt-1">
                        98.5% of Monthly Target Completed
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black shadow-xs">
                      <span>✓</span>
                      <span>Safety Goal Met 🎯</span>
                    </span>
                  </div>

                  {/* Safety Score & Next Milestone Row */}
                  <div className="grid grid-cols-2 gap-3 py-4">
                    {/* Safety Score */}
                    <div className="bg-[#fcf1f2] border border-[#f4dde0] rounded-2xl p-3.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#a00d17]">
                        Safety Score
                      </span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="w-6 h-6 rounded-full bg-[#a00d17] text-white text-xs font-black flex items-center justify-center shadow-xs">
                          98
                        </span>
                        <span className="text-xs font-extrabold text-[#2e2022] leading-tight">
                          Zero Incident Index
                        </span>
                      </div>
                    </div>

                    {/* Next Milestone */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Next Scheduled PM
                      </span>
                      <p className="text-xs font-extrabold text-[#1c191a] mt-1.5 leading-tight">
                        2 Days — Crusher Inspection
                      </p>
                    </div>
                  </div>

                  {/* Active Maintenance Sessions */}
                  <div className="space-y-2.5 pt-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#6f4b4f] block">
                      Active Maintenance Sessions
                    </span>

                    {/* Task 1 */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#fcfbfc] border border-[#f4dde0] hover:bg-[#fbeced]/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#fbeced] text-[#a00d17] flex items-center justify-center font-bold text-sm shadow-xs border border-[#f4dde0]">
                          ⚙️
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#1c191a]">
                            CNC Milling Machine Service
                          </h4>
                          <span className="text-[11px] text-[#6f4b4f] font-medium">
                            1h 12m · Deep Service Mode
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-[#fbeced] border border-[#e8c4c8] text-[#a00d17] text-[10px] font-black uppercase">
                        In Progress
                      </span>
                    </div>

                    {/* Task 2 */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#fcfbfc] border border-[#f4dde0] hover:bg-[#fbeced]/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm shadow-xs border border-amber-200">
                          🔧
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#1c191a]">
                            Air Compressor Overhaul
                          </h4>
                          <span className="text-[11px] text-[#6f4b4f] font-medium">
                            2h 30m · Preventive Task
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase">
                        Scheduled
                      </span>
                    </div>
                  </div>

                  {/* Weekly Performance Gradient Bars */}
                  <div className="pt-4 mt-3 border-t border-[#f4dde0]">
                    <div className="flex items-center justify-between text-xs font-extrabold text-[#2e2022] mb-2">
                      <span className="tracking-wide">WEEKLY PM PERFORMANCE</span>
                      <span className="text-[#a00d17] font-black">+14.8% 📈</span>
                    </div>
                    <div className="flex items-end justify-between gap-2 h-11 pt-1">
                      {[40, 55, 70, 85, 90, 95, 100].map((h, i) => (
                        <div key={i} className="flex-1 bg-[#fbeced] rounded-t-md h-full flex items-end overflow-hidden">
                          <div
                            className="w-full bg-gradient-to-t from-[#880b13] to-[#e62635] rounded-t-md transition-all duration-700"
                            style={{ height: `${h}%` }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 3. KEY METRICS STATS COUNTER BAR WITH COUNT-UP ANIMATION */}
        <section ref={statsRef} className="py-12 bg-white border-y border-[#f4dde0] relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

              {/* Stat 1: Maintenance Hours */}
              <div
                className={`skyms-reveal flex items-center gap-4 p-5 rounded-2xl bg-[#fcfbfc] border border-[#f4dde0] shadow-xs hover:shadow-md hover:border-[#e8c4c8] hover:-translate-y-1 transition-all duration-300 ${statsInView ? "is-visible" : ""
                  }`}
                style={{ transitionDelay: statsInView ? "0ms" : "0ms" }}
              >
                <div className="w-12 h-12 rounded-xl bg-[#fbeced] text-[#a00d17] flex items-center justify-center text-xl font-bold shadow-xs border border-[#f4dde0] shrink-0">
                  ⏱️
                </div>
                <div>
                  <CountUpStat end={10000} suffix="+" />
                  <p className="text-xs font-bold text-[#6f4b4f]">Maintenance Hours</p>
                </div>
              </div>

              {/* Stat 2: Active Preventive Tasks */}
              <div
                className={`skyms-reveal flex items-center gap-4 p-5 rounded-2xl bg-[#fcfbfc] border border-[#f4dde0] shadow-xs hover:shadow-md hover:border-[#e8c4c8] hover:-translate-y-1 transition-all duration-300 ${statsInView ? "is-visible" : ""
                  }`}
                style={{ transitionDelay: statsInView ? "100ms" : "0ms" }}
              >
                <div className="w-12 h-12 rounded-xl bg-[#fbeced] text-[#a00d17] flex items-center justify-center text-xl font-bold shadow-xs border border-[#f4dde0] shrink-0">
                  🛡️
                </div>
                <div>
                  <CountUpStat end={5000} suffix="+" />
                  <p className="text-xs font-bold text-[#6f4b4f]">Active Preventive Tasks</p>
                </div>
              </div>

              {/* Stat 3: Checklists Logged */}
              <div
                className={`skyms-reveal flex items-center gap-4 p-5 rounded-2xl bg-[#fcfbfc] border border-[#f4dde0] shadow-xs hover:shadow-md hover:border-[#e8c4c8] hover:-translate-y-1 transition-all duration-300 ${statsInView ? "is-visible" : ""
                  }`}
                style={{ transitionDelay: statsInView ? "200ms" : "0ms" }}
              >
                <div className="w-12 h-12 rounded-xl bg-[#fbeced] text-[#a00d17] flex items-center justify-center text-xl font-bold shadow-xs border border-[#f4dde0] shrink-0">
                  📋
                </div>
                <div>
                  <CountUpStat end={25000} suffix="+" />
                  <p className="text-xs font-bold text-[#6f4b4f]">Checklists Logged</p>
                </div>
              </div>

              {/* Stat 4: Safety SOPs Uploaded */}
              <div
                className={`skyms-reveal flex items-center gap-4 p-5 rounded-2xl bg-[#fcfbfc] border border-[#f4dde0] shadow-xs hover:shadow-md hover:border-[#e8c4c8] hover:-translate-y-1 transition-all duration-300 ${statsInView ? "is-visible" : ""
                  }`}
                style={{ transitionDelay: statsInView ? "300ms" : "0ms" }}
              >
                <div className="w-12 h-12 rounded-xl bg-[#fbeced] text-[#a00d17] flex items-center justify-center text-xl font-bold shadow-xs border border-[#f4dde0] shrink-0">
                  📁
                </div>
                <div>
                  <CountUpStat end={1000} suffix="+" />
                  <p className="text-xs font-bold text-[#6f4b4f]">Safety SOPs Uploaded</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 4. ROLE-BASED ACCESS PORTALS (ADMIN, SUPERVISOR, OPERATOR) */}
        <section ref={rolesRef} className="py-16 lg:py-20 bg-gradient-to-b from-[#fcfbfc] via-white to-[#fcfbfc] relative z-10 border-b border-[#f4dde0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="inline-block">
                <span className="text-[#a00d17] font-black text-xs tracking-widest uppercase px-3.5 py-1 rounded-full bg-[#fbeced] border border-[#e8c4c8]">
                  ROLE-BASED WORKSTATIONS
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-[#1c191a]">
                Select Your Workstation Portal
              </h2>
              <p className="text-sm sm:text-base text-[#4a3437] max-w-2xl mx-auto font-medium">
                Tailored digital interfaces with live MongoDB sync designed specifically for Administrators, Supervisors, and Plant Operators.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">

              {/* Card 1: Administrator Portal */}
              <div
                className={`skyms-reveal rounded-3xl bg-white border-2 border-slate-200 hover:border-indigo-600 p-7 shadow-md hover:shadow-2xl transition-all duration-500 ease-out flex flex-col justify-between group hover:-translate-y-1.5 ${rolesInView ? "is-visible" : ""
                  }`}
                style={{ transitionDelay: rolesInView ? "0ms" : "0ms" }}
              >
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-200">
                    👑
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                      Management &amp; Master
                    </span>
                    <h3 className="text-xl font-black text-slate-900 mt-2">Administrator Portal</h3>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      Complete control over User records, Machine master directory, Checklist criteria configuration, Ticket approvals, and Excel sync.
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700 font-semibold pt-2 border-t border-slate-100">
                    <li className="flex items-center gap-2">✓ User Provisioning &amp; Password Reset</li>
                    <li className="flex items-center gap-2">✓ Add &amp; Edit Plant Machines</li>
                    <li className="flex items-center gap-2">✓ Master Audit Trails &amp; Export</li>
                  </ul>
                </div>
                <div className="pt-6">
                  <Link
                    href={isLoggedIn ? "/admin" : "/login"}
                    className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-all text-sm hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Open Admin Station →</span>
                  </Link>
                </div>
              </div>

              {/* Card 2: Supervisor Control Center */}
              <div
                className={`skyms-reveal rounded-3xl bg-white border-2 border-slate-200 hover:border-[#a00d17] p-7 shadow-md hover:shadow-2xl transition-all duration-500 ease-out flex flex-col justify-between group hover:-translate-y-1.5 ${rolesInView ? "is-visible" : ""
                  }`}
                style={{ transitionDelay: rolesInView ? "150ms" : "0ms" }}
              >
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-200">
                    🦺
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#a00d17] bg-[#fbeced] px-2.5 py-1 rounded-full">
                      Safety &amp; Oversight
                    </span>
                    <h3 className="text-xl font-black text-slate-900 mt-2">Supervisor Control Center</h3>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      Verify daily shift inspections, assign breakdown work orders, approve safety corrective actions, and track PPE compliance.
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700 font-semibold pt-2 border-t border-slate-100">
                    <li className="flex items-center gap-2">✓ Safety Department Master (5 Sections)</li>
                    <li className="flex items-center gap-2">✓ Maintenance Work Order Assignment</li>
                    <li className="flex items-center gap-2">✓ Incident Approval &amp; CAPA Closeout</li>
                  </ul>
                </div>
                <div className="pt-6">
                  <Link
                    href={isLoggedIn ? "/supervisor" : "/login"}
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#a00d17] hover:bg-[#880b13] text-white font-bold py-3 rounded-xl shadow-md transition-all text-sm hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Open Supervisor Hub →</span>
                  </Link>
                </div>
              </div>

              {/* Card 3: Operator Workstation */}
              <div
                className={`skyms-reveal rounded-3xl bg-white border-2 border-slate-200 hover:border-slate-800 p-7 shadow-md hover:shadow-2xl transition-all duration-500 ease-out flex flex-col justify-between group hover:-translate-y-1.5 ${rolesInView ? "is-visible" : ""
                  }`}
                style={{ transitionDelay: rolesInView ? "300ms" : "0ms" }}
              >
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-200">
                    🏭
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
                      Floor Station
                    </span>
                    <h3 className="text-xl font-black text-slate-900 mt-2">Operator Workstation</h3>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      Instant Machine QR scanning, shift checklist execution, immediate breakdown ticket raising, and safety hazard reporting with photo uploads.
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700 font-semibold pt-2 border-t border-slate-100">
                    <li className="flex items-center gap-2">✓ Machine QR Code Scanner</li>
                    <li className="flex items-center gap-2">✓ Daily Shift Checklist Submission</li>
                    <li className="flex items-center gap-2">✓ Breakdown &amp; Safety Ticket Logging</li>
                  </ul>
                </div>
                <div className="pt-6">
                  <Link
                    href={isLoggedIn ? "/operator/dashboard" : "/login"}
                    className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-xl shadow-md transition-all text-sm hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Open Operator Station →</span>
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 5. ABOUT / WHY CHOOSE SKYMS SECTION (#why-skyms) */}
        <section id="why-skyms" ref={whyRef} className="py-20 lg:py-24 bg-[#fcfbfc] relative z-10 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">

            <div className="inline-block">
              <span className="text-[#a00d17] font-black text-xs tracking-widest uppercase px-3 py-1 rounded-full bg-[#fbeced] border border-[#e8c4c8]">
                PLAN SMARTER. EXECUTE BETTER. GROW FASTER.
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-[#1c191a]">
              Why Choose Skyline Project &amp; Engineers Pvt. Ltd.?
            </h2>

            <p className="text-[#4a3437] max-w-2xl mx-auto text-sm sm:text-base font-medium">
              Take full control of your plant maintenance workflow — from daily digital machine checklists to safety audits and breakdown prevention.
            </p>

            {/* 8 Feature Cards Grid with sequential entrance animation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-10 text-left">

              {[
                {
                  icon: "📋",
                  title: "Smart Task Management",
                  desc: "Create and organize daily PM checklists and technician assignments structured by frequency.",
                },
                {
                  icon: "⏱️",
                  title: "Focus Sessions & Timers",
                  desc: "Integrated timers to track overhaul duration and calculate exact MTTR and MTBF metrics.",
                },
                {
                  icon: "📊",
                  title: "Advanced MongoDB Analytics",
                  desc: "Real-time telemetry, breakdown metrics, spare part usage, and safety compliance indices.",
                },
                {
                  icon: "📄",
                  title: "Standard SOP Documents",
                  desc: "Upload and manage machine manuals, safety procedures, and digital compliance certifications.",
                },
                {
                  icon: "🎯",
                  title: "Goals & Progress Tracking",
                  desc: "Set monthly uptime goals and monitor machinery health with automated threshold alerts.",
                },
                {
                  icon: "🔥",
                  title: "Fire & HIRA Audits",
                  desc: "Comprehensive safety modules for Hazard Identification, Fire Safety, and Environmental checks.",
                },
                {
                  icon: "📜",
                  title: "Complete History & Audit",
                  desc: "Immutable activity logs and maintenance logs for ISO and factory compliance audits.",
                },
                {
                  icon: "🔒",
                  title: "Private & Role-Based Access",
                  desc: "Granular roles for Operators, Technicians, Safety Officers, and Plant Administrators.",
                },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className={`skyms-reveal bg-white p-6 rounded-2xl border border-[#f4dde0] shadow-sm hover:shadow-xl hover:border-[#a00d17] hover:-translate-y-1.5 transition-all duration-300 ease-out group flex flex-col justify-between h-full ${whyInView ? "is-visible" : ""
                    }`}
                  style={{ transitionDelay: whyInView ? `${idx * 60}ms` : "0ms" }}
                >
                  <div>
                    <div className="w-11 h-11 rounded-xl bg-[#fbeced] text-[#a00d17] border border-[#f4dde0] flex items-center justify-center text-xl mb-4 shadow-xs group-hover:bg-[#a00d17] group-hover:text-white transition-colors duration-200">
                      {feature.icon}
                    </div>
                    <h3 className="text-base font-bold text-[#1c191a] mb-2 group-hover:text-[#a00d17] transition-colors duration-200">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-[#5a4245] leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}

            </div>
          </div>
        </section>

        {/* 6. HOW IT WORKS (3-STEP SYSTEM) (#how-it-works) */}
        {/* CRITICAL: Large background 01, 02, 03 numbers REMOVED completely. Small 01, 02, 03 badges KEPT. */}
        <section id="how-it-works" ref={howRef} className="py-20 lg:py-24 bg-white border-t border-[#f4dde0] relative z-10 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">

            <div className="inline-block">
              <span className="text-[#a00d17] font-black text-xs tracking-widest uppercase px-3 py-1 rounded-full bg-[#fbeced] border border-[#e8c4c8]">
                SIMPLE &amp; POWERFUL WORKFLOW
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-[#1c191a]">
              How It Works
            </h2>

            <p className="text-[#4a3437] max-w-2xl mx-auto text-sm sm:text-base font-medium">
              A simple yet powerful 3-step system designed to optimize your plant maintenance and safety operations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10 text-left">

              {/* Step 1 */}
              <div
                className={`skyms-reveal relative p-8 rounded-3xl bg-[#fcfbfc] border border-[#f4dde0] overflow-hidden group hover:bg-[#fbeced]/30 hover:border-[#a00d17] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 ease-out h-full ${howInView ? "is-visible" : ""
                  }`}
                style={{ transitionDelay: howInView ? "0ms" : "0ms" }}
              >
                <div className="relative z-10 space-y-3">
                  {/* Small badge preserved at top-left */}
                  <div className="w-10 h-10 rounded-xl bg-[#a00d17] text-white flex items-center justify-center font-black text-sm shadow-md">
                    01
                  </div>
                  <h3 className="text-lg font-bold text-[#1c191a]">
                    Plan Your Workflow
                  </h3>
                  <p className="text-xs text-[#5a4245] leading-relaxed">
                    Register plant machines, tag assets with QR codes, and configure master checklists with mandatory standards and frequencies.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div
                className={`skyms-reveal relative p-8 rounded-3xl bg-[#fcfbfc] border border-[#f4dde0] overflow-hidden group hover:bg-[#fbeced]/30 hover:border-[#a00d17] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 ease-out h-full ${howInView ? "is-visible" : ""
                  }`}
                style={{ transitionDelay: howInView ? "150ms" : "0ms" }}
              >
                <div className="relative z-10 space-y-3">
                  {/* Small badge preserved at top-left */}
                  <div className="w-10 h-10 rounded-xl bg-[#a00d17] text-white flex items-center justify-center font-black text-sm shadow-md">
                    02
                  </div>
                  <h3 className="text-lg font-bold text-[#1c191a]">
                    Execute Digital Inspections
                  </h3>
                  <p className="text-xs text-[#5a4245] leading-relaxed">
                    Technicians scan machine QR codes on tablets or mobile, submit daily check points, log abnormalities, and sign off digitally.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div
                className={`skyms-reveal relative p-8 rounded-3xl bg-[#fcfbfc] border border-[#f4dde0] overflow-hidden group hover:bg-[#fbeced]/30 hover:border-[#a00d17] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 ease-out h-full ${howInView ? "is-visible" : ""
                  }`}
                style={{ transitionDelay: howInView ? "300ms" : "0ms" }}
              >
                <div className="relative z-10 space-y-3">
                  {/* Small badge preserved at top-left */}
                  <div className="w-10 h-10 rounded-xl bg-[#a00d17] text-white flex items-center justify-center font-black text-sm shadow-md">
                    03
                  </div>
                  <h3 className="text-lg font-bold text-[#1c191a]">
                    Track &amp; Prevent Breakdowns
                  </h3>
                  <p className="text-xs text-[#5a4245] leading-relaxed">
                    Live MongoDB dashboards track equipment uptime, trigger automated PM reminders, and maintain zero-incident factory safety.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 7. CORPORATE DARK FOOTER */}
        <SiteFooter />

      </div>
    </>
  );
}
