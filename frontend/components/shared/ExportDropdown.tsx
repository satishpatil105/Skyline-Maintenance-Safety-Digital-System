"use client";

import React, { useState, useRef, useEffect } from "react";
import { exportRecords, ExportColumn } from "@/lib/exportUtils";
export type { ExportColumn } from "@/lib/exportUtils";

export interface ExportDropdownProps {
  title: string;
  subtitle?: string;
  filenamePrefix?: string;
  filename?: string;
  sheetName?: string;
  columns: ExportColumn[];
  data?: Record<string, any>[];
  records?: Record<string, any>[];
  allData?: Record<string, any>[];
  allRecords?: Record<string, any>[];
  selectedRows?: Record<string, any>[];
  formats?: ("xlsx" | "csv" | "pdf")[];
  dateRange?: { start?: string; end?: string };
  summary?: Record<string, any>;
  onExportSuccess?: (msg: string) => void;
  onExportError?: (err: string) => void;
  size?: "sm" | "md";
  className?: string;
  label?: string;
  buttonLabel?: string;
}

export default function ExportDropdown({
  title,
  subtitle,
  filenamePrefix,
  filename,
  sheetName,
  columns,
  data,
  records,
  allData,
  allRecords,
  selectedRows = [],
  formats = ["xlsx", "csv", "pdf"],
  dateRange,
  summary,
  onExportSuccess,
  onExportError,
  size = "md",
  className = "",
  label,
  buttonLabel,
}: ExportDropdownProps) {
  const activeData = (data || records || []) as Record<string, any>[];
  const activeAllData = (allData || allRecords) as Record<string, any>[] | undefined;
  const activePrefix = filename || filenamePrefix || `SkyMS_${title.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const activeLabel = buttonLabel || label || "Export";
  const [isOpen, setIsOpen] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);
  const [targetScope, setTargetScope] = useState<"filtered" | "all" | "selected">("filtered");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalFilteredCount = activeData.length;
  const totalAllCount = activeAllData ? activeAllData.length : totalFilteredCount;
  const totalSelectedCount = selectedRows.length;

  const handleExport = async (format: "xlsx" | "csv" | "pdf") => {
    if (loadingFormat) return; // Prevent duplicate rapid clicks

    let exportSet = activeData;
    let scopeLabel = "filtered";
    if (targetScope === "selected" && totalSelectedCount > 0) {
      exportSet = selectedRows;
      scopeLabel = "selected";
    } else if (targetScope === "all" && activeAllData && activeAllData.length > 0) {
      exportSet = activeAllData;
      scopeLabel = "all";
    }

    if (!exportSet || exportSet.length === 0) {
      const msg = "No records to export in the selected dataset.";
      if (onExportError) onExportError(msg);
      else alert(msg);
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const dateRangeSuffix =
      dateRange?.start && dateRange?.end ? `_${dateRange.start}_to_${dateRange.end}` : `_${todayStr}`;
    const filename = `${activePrefix}${dateRangeSuffix}`;

    try {
      setLoadingFormat(format);
      await exportRecords({
        filename,
        title,
        subtitle: subtitle || `SkyMS Operational Export (${exportSet.length} ${scopeLabel} records)`,
        columns,
        data: exportSet,
        format,
        summary,
        dateRange,
      });

      setIsOpen(false);
      const successMsg = `Successfully exported ${exportSet.length} records to ${format.toUpperCase()}`;
      if (onExportSuccess) {
        onExportSuccess(successMsg);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      const errMsg = err.message || `Failed to export ${format.toUpperCase()}`;
      if (onExportError) {
        onExportError(errMsg);
      } else {
        alert(errMsg);
      }
    } finally {
      setLoadingFormat(null);
    }
  };

  const btnPadding =
    size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs";

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loadingFormat !== null}
        className={`inline-flex items-center gap-1.5 rounded-xl font-bold border border-slate-300 bg-white text-slate-800 shadow-2xs hover:bg-slate-50 hover:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#880b13]/20 transition-all ${btnPadding} ${
          isOpen ? "ring-2 ring-[#880b13]/30 border-[#880b13]" : ""
        }`}
      >
        {loadingFormat ? (
          <span className="w-3.5 h-3.5 border-2 border-[#880b13] border-t-transparent rounded-full animate-spin shrink-0"></span>
        ) : (
          <svg
            className="w-3.5 h-3.5 text-[#880b13] shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>
        )}
        <span>{loadingFormat ? `Generating ${loadingFormat.toUpperCase()}...` : activeLabel}</span>
        <svg
          className={`w-3 h-3 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1.5 w-64 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Export Options
            </span>
            <span className="text-xs font-bold text-slate-800 truncate block">
              {title}
            </span>
          </div>

          {/* Scope Selector (Filtered vs All vs Selected) */}
          {(allData || totalSelectedCount > 0) && (
            <div className="p-1 mb-1.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 px-2 block">
                Record Scope:
              </span>
              <div className="grid grid-cols-1 gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTargetScope("filtered")}
                  className={`flex items-center justify-between px-2 py-1 rounded-lg font-semibold transition-colors ${
                    targetScope === "filtered"
                      ? "bg-white text-[#880b13] font-bold shadow-2xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>Filtered View</span>
                  <span className="text-[10px] bg-slate-200/80 px-1.5 py-0.2 rounded-full font-bold">
                    {totalFilteredCount}
                  </span>
                </button>

                {allData && allData.length !== totalFilteredCount && (
                  <button
                    type="button"
                    onClick={() => setTargetScope("all")}
                    className={`flex items-center justify-between px-2 py-1 rounded-lg font-semibold transition-colors ${
                      targetScope === "all"
                        ? "bg-white text-[#880b13] font-bold shadow-2xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>All Database Records</span>
                    <span className="text-[10px] bg-slate-200/80 px-1.5 py-0.2 rounded-full font-bold">
                      {totalAllCount}
                    </span>
                  </button>
                )}

                {totalSelectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setTargetScope("selected")}
                    className={`flex items-center justify-between px-2 py-1 rounded-lg font-semibold transition-colors ${
                      targetScope === "selected"
                        ? "bg-white text-[#880b13] font-bold shadow-2xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Selected Rows</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                      {totalSelectedCount}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Formats List */}
          <div className="space-y-0.5">
            {formats.includes("xlsx") && (
              <button
                type="button"
                disabled={loadingFormat !== null}
                onClick={() => handleExport("xlsx")}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-xl hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 transition-colors group disabled:opacity-50"
              >
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  📊
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold leading-tight">Excel Workbook (.xlsx)</div>
                  <div className="text-[10px] text-slate-400 group-hover:text-emerald-700/80">
                    Styled spreadsheet, auto-fit & filters
                  </div>
                </div>
              </button>
            )}

            {formats.includes("csv") && (
              <button
                type="button"
                disabled={loadingFormat !== null}
                onClick={() => handleExport("csv")}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-xl hover:bg-blue-50 text-slate-700 hover:text-blue-900 transition-colors group disabled:opacity-50"
              >
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  📄
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold leading-tight">CSV File (.csv)</div>
                  <div className="text-[10px] text-slate-400 group-hover:text-blue-700/80">
                    UTF-8 tabular data for Excel & analytics
                  </div>
                </div>
              </button>
            )}

            {formats.includes("pdf") && (
              <button
                type="button"
                disabled={loadingFormat !== null}
                onClick={() => handleExport("pdf")}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-xl hover:bg-rose-50 text-slate-700 hover:text-rose-900 transition-colors group disabled:opacity-50"
              >
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-[#880b13] flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-[#880b13] group-hover:text-white transition-colors">
                  📑
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold leading-tight">PDF Document (.pdf)</div>
                  <div className="text-[10px] text-slate-400 group-hover:text-rose-700/80">
                    Printable report with headers & footer
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
