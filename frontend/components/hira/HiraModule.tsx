"use client";

import React, { useState, useEffect, useCallback } from "react";
import HiraDashboard from "./HiraDashboard";
import HiraRegisterTable from "./HiraRegisterTable";
import HiraRiskMatrix from "./HiraRiskMatrix";
import HiraActionTracking from "./HiraActionTracking";
import HiraReferenceInstructions from "./HiraReferenceInstructions";
import type { HiraRecord, HiraSummary } from "@/lib/hira";

interface HiraModuleProps {
  user?: any;
  initialTab?: "dashboard" | "register" | "matrix" | "actions" | "instructions";
}

export default function HiraModule({ user, initialTab = "dashboard" }: HiraModuleProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "register" | "matrix" | "actions" | "instructions">(initialTab);
  const [records, setRecords] = useState<HiraRecord[]>([]);
  const [summary, setSummary] = useState<HiraSummary | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHiraData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hira");
      if (!res.ok) throw new Error("Failed to load HIRA data");
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
        setSummary(data.summary || null);
        setMetadata(data.metadata || null);
      } else {
        throw new Error(data.message || "Failed to load records");
      }
    } catch (e: any) {
      console.error("[HiraModule] Error fetching data:", e);
      setError(e.message || "Unable to connect to database");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHiraData();
  }, [fetchHiraData]);

  const handleRecordUpdated = (updatedRecord: HiraRecord) => {
    setRecords((prev) =>
      prev.map((r) => (r.srNo === updatedRecord.srNo ? updatedRecord : r))
    );
    // Refresh summary in background
    fetchHiraData();
  };

  const tabs = [
    { key: "dashboard", label: "HIRA Dashboard", icon: "📊", sheet: "Sheet 4" },
    { key: "register", label: "HIRA Register (38 Hazards)", icon: "📋", sheet: "Sheet 3" },
    { key: "matrix", label: "Risk Matrix Reference", icon: "🎯", sheet: "Sheet 2" },
    { key: "actions", label: "Action Tracking", icon: "⚡", sheet: "Sheet 3 Actions" },
    { key: "instructions", label: "Legend & Instructions", icon: "📖", sheet: "Sheet 1" },
  ];

  if (loading && records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-10 h-10 border-4 border-[#880b13] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 tracking-wide uppercase">
          Loading Skyline HIRA Register (38 Hazards)...
        </p>
      </div>
    );
  }

  if (error && records.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
        <span className="text-3xl">⚠️</span>
        <h3 className="text-sm font-black text-rose-950">Failed to Load HIRA Register</h3>
        <p className="text-xs text-rose-800">{error}</p>
        <button
          type="button"
          onClick={fetchHiraData}
          className="px-4 py-2 rounded-xl bg-[#880b13] text-white text-xs font-bold hover:bg-rose-900 cursor-pointer shadow-xs"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Module Title & Tab Navigation Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-[#880b13] font-black text-xs uppercase tracking-wide">
              Safety & EHS Division
            </span>
            <span className="text-xs text-slate-400 font-bold">•</span>
            <span className="text-xs font-bold text-slate-500 font-mono">ISO 45001:2018</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Hazard Identification & Risk Assessment (HIRA)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Doc No: <strong className="text-slate-700">SKY/QA/HIRA/01</strong> | Rev: <strong className="text-slate-700">0</strong> | Plant: <strong className="text-slate-700">Chakan, Pune</strong>
          </p>
        </div>

        {/* Refresh & Live Data Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchHiraData}
            title="Refresh from MongoDB Atlas"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>🔄</span>
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>MongoDB Atlas Active</span>
          </div>
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 rounded-t-xl font-black text-xs flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === tab.key
                ? "border-[#880b13] text-[#880b13] bg-rose-50/50 shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
              {tab.sheet}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "dashboard" && summary && (
          <HiraDashboard
            summary={summary}
            records={records}
            metadata={metadata}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === "register" && (
          <HiraRegisterTable
            records={records}
            onUpdateRecord={handleRecordUpdated}
            canEdit={user?.role === "Admin" || user?.role === "Supervisor" || user?.permissions?.includes("Can Submit Safety")}
          />
        )}

        {activeTab === "matrix" && (
          <HiraRiskMatrix
            metadata={metadata}
            records={records}
            onSelectCell={() => setActiveTab("register")}
          />
        )}

        {activeTab === "actions" && (
          <HiraActionTracking
            records={records}
            onUpdateRecord={handleRecordUpdated}
            canEdit={user?.role === "Admin" || user?.role === "Supervisor" || user?.permissions?.includes("Can Submit Safety")}
          />
        )}

        {activeTab === "instructions" && (
          <HiraReferenceInstructions
            metadata={metadata}
            user={user}
            onValidationSuccess={fetchHiraData}
          />
        )}
      </div>
    </div>
  );
}
