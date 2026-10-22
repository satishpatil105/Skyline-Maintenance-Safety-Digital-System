"use client";

import React, { useState, useMemo } from "react";
import { downloadOriginalDocument } from "@/lib/exportUtils";

interface MaintenanceDoc {
  docId: string;
  title: string;
  category: "OEM Manual" | "SOP Procedure" | "Electrical Schematic" | "Warranty Card" | "LOTO Safety";
  machineType: string;
  version: string;
  uploadedDate: string;
  fileSize: string;
}

export default function MaintenanceDocumentsTab() {
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingDoc, setViewingDoc] = useState<MaintenanceDoc | null>(null);

  const initialDocs: MaintenanceDoc[] = [
    {
      docId: "DOC-LSR-001",
      title: "Fiber Laser 4kW - OEM Operating & Service Manual",
      category: "OEM Manual",
      machineType: "Fiber Laser Cutting Machine",
      version: "v4.2",
      uploadedDate: "2026-01-15",
      fileSize: "14.2 MB",
    },
    {
      docId: "DOC-SOP-LOTO",
      title: "SOP-MNT-012: Lock-Out / Tag-Out (LOTO) Energy Isolation Procedure",
      category: "LOTO Safety",
      machineType: "All Plant Machinery",
      version: "v2.0",
      uploadedDate: "2026-02-10",
      fileSize: "1.8 MB",
    },
    {
      docId: "DOC-BND-SCHEM",
      title: "CNC Press Brake - Hydraulic Control Wiring & Proportional Valve Schematic",
      category: "Electrical Schematic",
      machineType: "CNC Press Brake Bending Machine",
      version: "v1.5",
      uploadedDate: "2026-03-22",
      fileSize: "5.4 MB",
    },
    {
      docId: "DOC-CMP-SOP",
      title: "Screw Compressor 50 HP - Quarterly Oil & Filter Change SOP",
      category: "SOP Procedure",
      machineType: "Air Compressor Kaeser ASK-34",
      version: "v3.1",
      uploadedDate: "2026-04-05",
      fileSize: "2.1 MB",
    },
    {
      docId: "DOC-TRUMPF-WARR",
      title: "Laser Resonator Module - OEM 3-Year Extended Warranty Certificate",
      category: "Warranty Card",
      machineType: "Fiber Laser Cutting Machine",
      version: "Official",
      uploadedDate: "2026-01-01",
      fileSize: "850 KB",
    },
    {
      docId: "DOC-TPP-TOOL",
      title: "Turret Punch Press 20T - Tooling & Station Alignment Guide",
      category: "OEM Manual",
      machineType: "Turret Punching Machine",
      version: "v2.4",
      uploadedDate: "2026-05-18",
      fileSize: "8.7 MB",
    },
  ];

  const filteredDocs = initialDocs.filter((d) => {
    if (categoryFilter !== "All" && d.category !== categoryFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.machineType.toLowerCase().includes(q) ||
        d.docId.toLowerCase().includes(q)
      );
    }
    return true;
  });


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Section 13: Digital Engineering Document Repository
            </h3>
            <p className="text-xs text-slate-500">
              OEM service manuals, LOTO isolation procedures, electrical schematics, and warranty certificates
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
          <div>
            <input
              type="text"
              placeholder="Search document title, machine, SOP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <option value="All">All Categories</option>
              <option value="OEM Manual">OEM Manuals</option>
              <option value="SOP Procedure">SOP Procedures</option>
              <option value="Electrical Schematic">Electrical Schematics</option>
              <option value="LOTO Safety">LOTO Safety Protocols</option>
              <option value="Warranty Card">Warranty Certificates</option>
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setCategoryFilter("All");
              }}
              className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => (
          <div
            key={doc.docId}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-mono text-[10px] font-bold text-slate-500">
                  {doc.docId}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {doc.category}
                </span>
              </div>

              <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                {doc.title}
              </h4>

              <div className="text-[11px] text-slate-500 mt-2 space-y-1">
                <div>Machine: <strong className="text-slate-800">{doc.machineType}</strong></div>
                <div className="flex justify-between">
                  <span>Version: {doc.version}</span>
                  <span>Size: {doc.fileSize}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[10px] text-slate-400">Date: {doc.uploadedDate}</span>
              <button
                type="button"
                onClick={() => setViewingDoc(doc)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                View Document
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Document Preview Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {viewingDoc.category} Preview
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  {viewingDoc.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center space-y-2 text-center text-xs">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold text-base">
                PDF
              </div>
              <div className="font-bold text-slate-900">{viewingDoc.title}</div>
              <div className="text-slate-500 text-[11px]">
                {viewingDoc.fileSize} • Uploaded {viewingDoc.uploadedDate} • Version {viewingDoc.version}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-2">
                Certified OEM Document Verified for Plant Use
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => downloadOriginalDocument(`/api/uploads/${viewingDoc.docId}.pdf`, `${viewingDoc.title.replace(/[/\\?%*:|"<>]/g, "_")}.pdf`)}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[#880b13] text-white hover:bg-[#6e090f] cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
