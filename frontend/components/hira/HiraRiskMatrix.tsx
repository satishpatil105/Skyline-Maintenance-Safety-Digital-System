"use client";

import React, { useState } from "react";
import type { HiraRecord } from "@/lib/hira";

interface HiraRiskMatrixProps {
  metadata?: any;
  records?: HiraRecord[];
  onSelectCell?: (l: number, s: number) => void;
}

export default function HiraRiskMatrix({ metadata, records = [], onSelectCell }: HiraRiskMatrixProps) {
  const [viewMode, setViewMode] = useState<"existing" | "residual">("existing");
  const [selectedCell, setSelectedCell] = useState<{ l: number; s: number } | null>(null);

  const likelihoodScale = metadata?.likelihoodScale || [
    { score: 1, rating: "Rare", description: "May occur only in exceptional circumstances; not expected to occur" },
    { score: 2, rating: "Unlikely", description: "Could occur at some time; has happened elsewhere in the industry" },
    { score: 3, rating: "Possible", description: "Might occur at some time; occurs occasionally in similar operations" },
    { score: 4, rating: "Likely", description: "Will probably occur in most circumstances; has occurred before at this site" },
    { score: 5, rating: "Almost Certain", description: "Expected to occur in most circumstances; occurs frequently" },
  ];

  const severityScale = metadata?.severityScale || [
    { score: 1, rating: "Negligible", description: "No injury, or first-aid only; no lost time" },
    { score: 2, rating: "Minor", description: "Minor injury / medical treatment case; no or minimal lost time (<1 day)" },
    { score: 3, rating: "Moderate", description: "Injury requiring medical treatment; lost-time injury; fully reversible" },
    { score: 4, rating: "Major", description: "Serious injury/illness, permanent partial disability; major property/environmental damage" },
    { score: 5, rating: "Catastrophic", description: "Fatality or multiple fatalities; irreversible disability; major fire/explosion/release" },
  ];

  const riskBands = metadata?.riskBands || [
    { band: "1 - 4", level: "Low", interpretation: "Acceptable — monitor; no immediate additional action required", color: "#16a34a" },
    { band: "5 - 9", level: "Medium", interpretation: "Tolerable — additional controls to be considered and planned", color: "#ca8a04" },
    { band: "10 - 14", level: "High", interpretation: "Action required — implement additional controls promptly", color: "#ea580c" },
    { band: "15 - 25", level: "Very High", interpretation: "Immediate action required — consider stopping the activity until controls are implemented", color: "#dc2626" },
  ];

  // Map hazard count per matrix cell (L, S)
  const cellCounts: Record<string, { count: number; items: HiraRecord[] }> = {};
  for (let s = 1; s <= 5; s++) {
    for (let l = 1; l <= 5; l++) {
      cellCounts[`${l}-${s}`] = { count: 0, items: [] };
    }
  }

  records.forEach((r) => {
    const l = viewMode === "existing" ? r.existingLikelihood : r.residualLikelihood;
    const s = viewMode === "existing" ? r.existingSeverity : r.residualSeverity;
    const key = `${l}-${s}`;
    if (cellCounts[key]) {
      cellCounts[key].count++;
      cellCounts[key].items.push(r);
    }
  });

  const getCellBg = (score: number) => {
    if (score <= 4) return "bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300";
    if (score <= 9) return "bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300";
    if (score <= 14) return "bg-orange-50 hover:bg-orange-100 text-orange-950 border-orange-300";
    return "bg-rose-50 hover:bg-rose-100 text-rose-950 border-rose-300 font-bold";
  };

  const getScoreBadge = (score: number) => {
    if (score <= 4) return "bg-emerald-600 text-white";
    if (score <= 9) return "bg-amber-500 text-white";
    if (score <= 14) return "bg-orange-600 text-white";
    return "bg-rose-600 text-white font-black";
  };

  return (
    <div className="space-y-6">
      {/* 5x5 Matrix Grid Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>🎯</span> 5 × 5 Risk Assessment Matrix Grid
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Risk Score = Likelihood (L) × Severity (S). Interactive live hazard pins shown on grid.
            </p>
          </div>

          {/* Toggle between Existing vs Residual Controls */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs shrink-0">
            <button
              type="button"
              onClick={() => { setViewMode("existing"); setSelectedCell(null); }}
              className={`rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer ${
                viewMode === "existing"
                  ? "bg-white text-[#880b13] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              With Existing Controls
            </button>
            <button
              type="button"
              onClick={() => { setViewMode("residual"); setSelectedCell(null); }}
              className={`rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer ${
                viewMode === "residual"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              After Additional Controls (Residual)
            </button>
          </div>
        </div>

        {/* The 5x5 Matrix Table */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[620px]">
            {/* Y-axis label */}
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Severity (S) ↓ \ Likelihood (L) →</span>
              <span className="text-[10px] font-normal text-slate-500">
                Displaying: {viewMode === "existing" ? "Initial Risk Profile (38 hazards)" : "Projected Residual Risk Profile (38 hazards)"}
              </span>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-28 p-2 text-left text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-tl-xl">
                    Severity \ L
                  </th>
                  {[1, 2, 3, 4, 5].map((l) => (
                    <th key={l} className="p-2 text-center text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200">
                      <div>L = {l}</div>
                      <div className="text-[10px] font-normal text-slate-500">
                        {likelihoodScale[l - 1]?.rating}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[5, 4, 3, 2, 1].map((s) => (
                  <tr key={s}>
                    <td className="p-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span>S = {s}</span>
                        <span className="text-[10px] font-normal text-slate-500 ml-1">
                          {severityScale[s - 1]?.rating}
                        </span>
                      </div>
                    </td>
                    {[1, 2, 3, 4, 5].map((l) => {
                      const score = l * s;
                      const cell = cellCounts[`${l}-${s}`];
                      const isSelected = selectedCell?.l === l && selectedCell?.s === s;
                      return (
                        <td
                          key={l}
                          onClick={() => {
                            setSelectedCell({ l, s });
                            if (onSelectCell) onSelectCell(l, s);
                          }}
                          className={`p-3 text-center border transition-all cursor-pointer select-none ${getCellBg(score)} ${
                            isSelected ? "ring-2 ring-[#880b13] scale-95 shadow-md z-10" : ""
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${getScoreBadge(score)}`}>
                              {score}
                            </span>
                            {cell?.count > 0 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black shadow-xs">
                                <span>📌</span> {cell.count} {cell.count === 1 ? "hazard" : "hazards"}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">—</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Cell Inspect Breakdown */}
        {selectedCell && (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-900">
              <span>
                Selected Cell: Likelihood {selectedCell.l} ({likelihoodScale[selectedCell.l - 1]?.rating}) × Severity {selectedCell.s} ({severityScale[selectedCell.s - 1]?.rating}) = Score {selectedCell.l * selectedCell.s}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕ Close
              </button>
            </div>
            {cellCounts[`${selectedCell.l}-${selectedCell.s}`]?.count > 0 ? (
              <div className="space-y-1.5 pt-1">
                <div className="font-semibold text-slate-700">Hazards mapped to this risk coordinate:</div>
                <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-slate-200/80">
                  {cellCounts[`${selectedCell.l}-${selectedCell.s}`].items.map((item) => (
                    <div key={item.srNo} className="pt-1 text-slate-800 flex items-start gap-2">
                      <span className="font-bold text-[#880b13] shrink-0">Sr {item.srNo}:</span>
                      <span className="font-medium text-slate-900">{item.department} — {item.activity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-slate-500 italic">No hazards currently fall into this specific risk cell in the {viewMode} assessment.</div>
            )}
          </div>
        )}

        {/* Legend color bands */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          {riskBands.map((band: any) => (
            <div key={band.band} className="p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black" style={{ color: band.color }}>
                  {band.level}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                  Score {band.band}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">{band.interpretation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reference Scales Detail Cards (Likelihood & Severity) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Likelihood Scale Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-rose-700 font-black">L</span> Likelihood (L) Scale
            </h4>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Scale: 1 to 5</span>
          </div>

          <div className="space-y-2">
            {likelihoodScale.map((item: any) => (
              <div key={item.score} className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 text-xs flex items-start gap-3">
                <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {item.score}
                </span>
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-slate-900">{item.rating}</div>
                  <div className="text-[11px] text-slate-600 leading-snug">{item.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Severity Scale Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-rose-700 font-black">S</span> Severity (S) Scale
            </h4>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Scale: 1 to 5</span>
          </div>

          <div className="space-y-2">
            {severityScale.map((item: any) => (
              <div key={item.score} className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 text-xs flex items-start gap-3">
                <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {item.score}
                </span>
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-slate-900">{item.rating}</div>
                  <div className="text-[11px] text-slate-600 leading-snug">{item.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
