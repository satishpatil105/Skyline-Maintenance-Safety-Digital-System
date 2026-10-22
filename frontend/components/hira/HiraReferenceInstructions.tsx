"use client";

import React, { useState } from "react";

interface HiraReferenceInstructionsProps {
  metadata: any;
  user?: any;
  onValidationSuccess?: () => void;
}

export default function HiraReferenceInstructions({
  metadata,
  user,
  onValidationSuccess,
}: HiraReferenceInstructionsProps) {
  const [validating, setValidating] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [showSignoffModal, setShowSignoffModal] = useState(false);
  const [signoffMsg, setSignoffMsg] = useState<string | null>(null);

  const canValidate =
    user?.role === "Admin" ||
    user?.role === "Supervisor" ||
    user?.permissions?.includes("Can Approve Close");

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/hira/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Validated by EHS",
          reviewNotes: reviewNotes || "On-site review and walkthrough completed. Ratings verified.",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSignoffMsg("Assessment successfully validated and signed off by EHS!");
        setShowSignoffModal(false);
        if (onValidationSuccess) onValidationSuccess();
      } else {
        alert(data.message || "Failed to validate");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Notification / Qualification Alert */}
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-5 shadow-sm">
        <div className="flex items-start gap-3.5">
          <span className="text-2xl shrink-0">⚠️</span>
          <div className="space-y-1 text-sm text-amber-950">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-amber-900 tracking-tight text-base">
                IMPORTANT EHS QUALIFICATION — PROFESSIONAL DRAFT
              </h3>
              <span className="inline-flex items-center rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                {metadata?.validationStatus || "Draft / Pending EHS Validation"}
              </span>
            </div>
            <p className="leading-relaxed text-amber-900/90">
              The Likelihood, Severity, existing controls and additional-control recommendations in this register are a{" "}
              <strong>professional DRAFT</strong> prepared from Skyline's process documents (Quality Manual, Process
              Control Plan, SOPs, Work Instructions) and general sheet-metal/surface-treatment industry knowledge —{" "}
              <strong>they have NOT been validated by an on-site walkthrough</strong>.
            </p>
            <p className="leading-relaxed text-amber-900/90">
              Skyline's safety committee / EHS in-charge should review every row against actual site conditions, adjust
              L/S ratings and controls as needed, and formally approve before this is treated as the official HIRA.
            </p>
            {canValidate && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowSignoffModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white px-3.5 py-1.5 text-xs font-black shadow-xs transition-all cursor-pointer"
                >
                  <span>✍️</span> Record EHS Review / Validation Sign-off
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {signoffMsg && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-900 flex items-center justify-between">
          <span>✓ {signoffMsg}</span>
          <button type="button" onClick={() => setSignoffMsg(null)} className="text-emerald-700 hover:text-emerald-900 text-xs">✕</button>
        </div>
      )}

      {/* Document Control Information Block */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#880b13] px-6 py-4 text-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-rose-200 font-bold">Standard Document Header</div>
            <h2 className="text-lg font-black tracking-tight">{metadata?.companyName || "SKYLINE PROJECT & ENGINEERS"}</h2>
            <div className="text-xs text-slate-300">{metadata?.plantLocation || "Chakan, Pune, Maharashtra"}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg bg-white/10 px-3 py-1 font-mono font-bold border border-white/20">
              Doc No: {metadata?.docNo || "SKY/QA/HIRA/01"}
            </span>
            <span className="rounded-lg bg-white/10 px-3 py-1 font-mono border border-white/20">
              Date: {metadata?.docDate || "17.08.2026"}
            </span>
            <span className="rounded-lg bg-white/10 px-3 py-1 font-mono border border-white/20">
              Rev: {metadata?.revNo || "0"}
            </span>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-700">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Standard Reference</span>
              <span className="font-bold text-slate-900 text-base">
                {metadata?.isoStandard || "ISO 45001:2018 — Occupational Health & Safety Management System"}
              </span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Scope Covered</span>
              <p className="mt-1 leading-relaxed text-slate-700">
                {metadata?.scopeCovered ||
                  "All routine & identified non-routine activities across Skyline's fabrication, surface-treatment, assembly and support processes at Chakan, Pune"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Risk Methodology</span>
              <p className="mt-1 leading-relaxed font-semibold text-slate-900">
                {metadata?.riskMethodology ||
                  "5 x 5 matrix — Risk Score = Likelihood (L) x Severity (S), scored 1-5 each (max score 25)"}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">1–4: Low</span>
                <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">5–9: Medium</span>
                <span className="inline-block px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-bold">10–14: High</span>
                <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">15–25: Very High</span>
              </div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Source Workbook</span>
              <p className="mt-1 font-mono text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                {metadata?.sourceWorkbook || "Skyline_HIRA_Register 1.xlsx"} (All 4 worksheets imported)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions on How to Use the Register */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>📖</span> How to Use the HIRA Register
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#880b13] text-white text-xs flex items-center justify-center font-black">1</span>
              Register Structure & Assessment Logic
            </h4>
            <p className="text-xs text-slate-600">
              The register covers <strong>38 hazards</strong> across <strong>20+ department/process areas</strong>. Every
              hazard is assessed twice:
            </p>
            <ul className="text-xs list-disc pl-4 space-y-1 text-slate-600">
              <li>
                <strong>Risk Rating — With Existing Controls</strong>: Reflects the current state as controls stand today.
              </li>
              <li>
                <strong>Residual Risk — After Additional Controls</strong>: Projected risk level once proposed additional
                controls are implemented.
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#880b13] text-white text-xs flex items-center justify-center font-black">2</span>
              Calculation & Rating Automation
            </h4>
            <p className="text-xs text-slate-600">
              Likelihood (L) and Severity (S) are rated on a 1–5 scale. Risk Score and Risk Level are computed by formulas:
            </p>
            <ul className="text-xs list-disc pl-4 space-y-1 text-slate-600">
              <li>
                <strong>Risk Score</strong> = Likelihood (L) × Severity (S)
              </li>
              <li>
                <strong>Risk Level</strong> automatically updates based on risk bands. Scores cannot be manually overridden.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Flagged Items: To Be Confirmed (TBC) */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-6 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔍</span>
          <h3 className="text-base font-black text-blue-950 tracking-tight">
            Flagged Activities "To Be Confirmed" (TBC) — Resolve First
          </h3>
        </div>
        <p className="text-xs text-blue-900 leading-relaxed">
          The workbook explicitly notes that applicability for these items depends on equipment Skyline may or may not have installed.
          Resolving these is critical as they materially alter the site's overall risk profile:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-[#880b13]">Sr. No. 24</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold">Confined Space Entry</span>
            </div>
            <div className="font-bold text-slate-900 text-xs">Internal inspection/entry into fabricated fuel tank</div>
            <div className="text-[11px] text-slate-600">Department: Diesel Tank Fabrication</div>
            <div className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded mt-1 border border-amber-200">
              ⚠️ Check if internal tank entry is performed at Skyline or if inspection is done externally via borescope/mirrors.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-[#880b13]">Sr. No. 27</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold">Lifting Equipment</span>
            </div>
            <div className="font-bold text-slate-900 text-xs">Overhead crane / chain-hoist use for heavy parts</div>
            <div className="text-[11px] text-slate-600">Department: Fabrication / Assembly</div>
            <div className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded mt-1 border border-amber-200">
              ⚠️ Verify whether an overhead crane or powered hoist is installed in the bay, or if only floor lifting aids are utilized.
            </div>
          </div>
        </div>
      </div>

      {/* Hierarchy of Controls Diagram */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>🛡️</span> Hierarchy of Controls (When Proposing Additional Controls)
        </h3>
        <p className="text-xs text-slate-600">
          When assigning additional controls, prioritize from top to bottom. PPE is the last line of defense, not the first:
        </p>

        <div className="space-y-2">
          {(metadata?.hierarchyOfControls || [
            { level: 1, name: "1. Elimination", description: "Physically remove the hazard from the process", color: "#15803d", effectiveness: "Most Effective" },
            { level: 2, name: "2. Substitution", description: "Replace the hazard with a safer material, tool or process", color: "#16a34a", effectiveness: "High" },
            { level: 3, name: "3. Engineering Controls", description: "Isolate personnel from the hazard (interlocks, physical guards, extraction)", color: "#ca8a04", effectiveness: "Moderate" },
            { level: 4, name: "4. Administrative Controls", description: "Change the way people work (SOPs, permits, training, rotation, signage)", color: "#ea580c", effectiveness: "Low-Moderate" },
            { level: 5, name: "5. PPE", description: "Protect worker with Personal Protective Equipment (last line of defense)", color: "#dc2626", effectiveness: "Last Line of Defense" },
          ]).map((ctrl: any) => (
            <div
              key={ctrl.name}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                  style={{ backgroundColor: ctrl.color }}
                />
                <div>
                  <span className="font-black text-xs text-slate-900">{ctrl.name}</span>
                  <span className="text-xs text-slate-600 block sm:inline sm:ml-2">{ctrl.description}</span>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shrink-0">
                {ctrl.effectiveness}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Review Triggers and Compliance Cross-References */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>🔄</span> Mandatory Review Triggers & Compliance Links
        </h3>
        <p className="text-xs text-slate-600">
          In compliance with <strong>ISO 45001:2018 Clause 6.1.2</strong>, this HIRA register must be reviewed:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {(metadata?.reviewTriggers || [
            "At least annually",
            "Immediately after any incident or near-miss",
            "When a new machine, chemical or process is introduced",
            "When legal or regulatory requirements change",
            "Following findings from internal or certification audit",
            "Cross-referenced with Environmental & OH&S Legal Register",
          ]).map((trigger: string, i: number) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800">
              <span className="text-emerald-700 font-bold shrink-0">✓</span>
              <span>{trigger}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Validation Sign-off Modal */}
      {showSignoffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-black text-slate-900">EHS Review & Validation Sign-off</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Confirm that on-site review or walkthrough has been performed and risk ratings are validated for official use.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Review Notes / Remarks</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Enter review notes, walkthrough date, or conditions..."
                className="w-full h-24 rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#880b13]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSignoffModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleValidate}
                disabled={validating}
                className="px-4 py-2 rounded-xl bg-[#880b13] hover:bg-rose-900 text-white text-xs font-black shadow-xs cursor-pointer"
              >
                {validating ? "Saving..." : "Confirm & Sign Off"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
