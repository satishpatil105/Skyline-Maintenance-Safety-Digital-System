"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SiteFooter from "@/components/shared/SiteFooter";

interface RecordDetail {
  recordId: string;
  category: string;
  categoryLabel: string;
  recordType: string;
  employeeName: string;
  employeeId: string;
  date: string;
  status: string;
  employeeSignStatus: "Accepted (Digitally Signed)" | "Rejected (Not Received)" | "Pending Signature";
  employeeSignDate: string;
  digitalSignId: string;
  highlights: { label: string; value: string }[];
}

export default function MobileAcknowledgmentPage() {
  const params = useParams();
  const rawId = params?.recordId as string | undefined;
  const recordId = rawId ? decodeURIComponent(rawId) : "";

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [signerName, setSignerName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [signedDsigId, setSignedDsigId] = useState<string | null>(null);

  const loadRecord = async () => {
    if (!recordId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/safety-dept/ack?recordId=${encodeURIComponent(recordId)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load safety record.");
      }
      setRecord(data.record);
      setSignerName(data.record.employeeName || "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecord();
  }, [recordId]);

  const handleDecision = async (decision: "yes" | "no") => {
    if (!recordId) return;
    const confirmText =
      decision === "yes"
        ? "Do you confirm that you have RECEIVED and ACCEPT this safety record?"
        : "Are you sure you want to mark this record as NOT RECEIVED?";
    if (!window.confirm(confirmText)) return;

    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch("/api/safety-dept/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId,
          decision,
          signerName: signerName.trim() || record?.employeeName || "Employee",
          remarks: remarks.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to submit digital signature.");
      }
      setSubmitSuccess(
        decision === "yes"
          ? "Thank you! Your acceptance has been recorded with a digital signature."
          : "Your response 'Not Received' has been recorded. Safety team will follow up."
      );
      if (data.digitalSignId) {
        setSignedDsigId(data.digitalSignId);
      }
      // Reload updated record from database
      await loadRecord();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record response.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Container */}
      <div className="max-w-lg w-full mx-auto my-auto py-4">
        {/* Header */}
        <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-700/60 p-5 shadow-2xl mb-4 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-3 text-2xl shadow-inner">
            🛡️
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
            Skyline Safety Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
            Employee Mobile Acknowledgment & Digital Sign
          </p>
          <div className="mt-3 inline-block px-3 py-1 rounded-full bg-slate-700/70 text-slate-300 text-xs font-mono font-semibold tracking-wider">
            ID: {recordId || "..."}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-slate-800/70 rounded-2xl border border-slate-700/50 p-8 text-center text-slate-300">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-medium">Loading record details...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-950/70 border border-red-500/50 rounded-2xl p-5 mb-4 text-red-200 text-sm shadow-lg">
            <div className="font-bold flex items-center gap-2 mb-1">
              <span>⚠️ Notice</span>
            </div>
            <p>{error}</p>
            <button
              onClick={loadRecord}
              className="mt-3 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Success Alert */}
        {submitSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-2xl p-5 mb-4 text-emerald-200 text-sm shadow-xl">
            <div className="font-bold text-base flex items-center gap-2 mb-1 text-emerald-300">
              <span>✅ Success</span>
            </div>
            <p>{submitSuccess}</p>
            {signedDsigId && (
              <div className="mt-2 text-xs font-mono bg-emerald-900/50 p-2 rounded border border-emerald-500/40 text-emerald-200">
                Digital Sign Ref: {signedDsigId}
              </div>
            )}
          </div>
        )}

        {/* Record Content */}
        {!loading && record && (
          <div className="space-y-4">
            {/* Status Banner */}
            {record.employeeSignStatus === "Accepted (Digitally Signed)" ? (
              <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-2xl p-4 text-emerald-300 flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div className="text-xs">
                  <div className="font-bold text-sm text-emerald-200">Record Digitally Signed</div>
                  <div>Verified & Accepted on {record.employeeSignDate || "record"}</div>
                  {record.digitalSignId && (
                    <div className="font-mono text-emerald-400 font-semibold mt-0.5">
                      {record.digitalSignId}
                    </div>
                  )}
                </div>
              </div>
            ) : record.employeeSignStatus === "Rejected (Not Received)" ? (
              <div className="bg-rose-900/30 border border-rose-500/50 rounded-2xl p-4 text-rose-300 flex items-center gap-3">
                <span className="text-2xl">❌</span>
                <div className="text-xs">
                  <div className="font-bold text-sm text-rose-200">Marked Not Received</div>
                  <div>Reported on {record.employeeSignDate || "record"}</div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-900/30 border border-amber-500/50 rounded-2xl p-4 text-amber-300 flex items-center gap-3">
                <span className="text-2xl">⏳</span>
                <div className="text-xs">
                  <div className="font-bold text-sm text-amber-200">Signature Pending</div>
                  <div>Please verify the items/information below and tap Yes or No</div>
                </div>
              </div>
            )}

            {/* Employee & Record Details Card */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700/60 p-5 shadow-xl">
              <div className="border-b border-slate-700/60 pb-3 mb-3">
                <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Employee Recipient
                </div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {record.employeeName || "Employee"}
                  {record.employeeId && (
                    <span className="text-sm font-normal text-slate-400 ml-2">
                      ({record.employeeId})
                    </span>
                  )}
                </div>
                <div className="text-xs text-blue-400 font-medium mt-1">
                  {record.recordType} • Date: {record.date || "N/A"}
                </div>
              </div>

              {/* Highlights List */}
              <div className="space-y-2.5">
                {record.highlights.map((h, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:justify-between py-1.5 border-b border-slate-700/30 text-xs sm:text-sm gap-0.5"
                  >
                    <span className="text-slate-400 font-medium">{h.label}</span>
                    <span className="text-slate-100 font-semibold text-right break-words max-w-full sm:max-w-[65%]">
                      {h.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Form (if pending or re-confirming) */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700/60 p-5 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>✍️</span> Employee Verification & Response
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Employee / Signer Name:
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Enter your full name"
                  disabled={submitting}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Remarks / Comments (Optional):
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Size verified, received 1 pair, etc."
                  disabled={submitting}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <div className="pt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision("yes")}
                  className="flex flex-col items-center justify-center py-3.5 px-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl font-bold shadow-lg shadow-green-900/30 active:scale-95 transition-all text-sm disabled:opacity-50"
                >
                  <span className="text-xl mb-0.5">✅</span>
                  <span>YES - Received</span>
                  <span className="text-[10px] font-normal text-emerald-100 opacity-90">
                    Sign & Accept
                  </span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision("no")}
                  className="flex flex-col items-center justify-center py-3.5 px-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/30 active:scale-95 transition-all text-sm disabled:opacity-50"
                >
                  <span className="text-xl mb-0.5">❌</span>
                  <span>NO - Not Received</span>
                  <span className="text-[10px] font-normal text-rose-100 opacity-90">
                    Report Issue
                  </span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                By clicking &quot;YES&quot;, you confirm receipt of the items or attendance in the session.
                This acts as your official digital signature in the company safety management system.
              </p>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href="/safety"
            className="text-xs text-slate-400 hover:text-white underline transition"
          >
            ← Back to Skyline Safety
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12">
        <SiteFooter />
      </div>
    </div>
  );
}

