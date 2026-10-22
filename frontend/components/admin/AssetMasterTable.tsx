"use client";

import { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import type { Row } from "./UserMasterTable";

interface AssetMasterTableProps {
    rows: Row[];
    onEdit: (row: Row) => void;
    onDelete: (row: Row) => void;
    onAddNew?: () => void;
}

export default function AssetMasterTable({
    rows,
    onEdit,
    onDelete,
    onAddNew,
}: AssetMasterTableProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [deptFilter, setDeptFilter] = useState("all");
    const [critFilter, setCritFilter] = useState("all");
    const [catFilter, setCatFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // QR Modal State
    const [selectedQrAsset, setSelectedQrAsset] = useState<Row | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string>("");
    const [qrLoading, setQrLoading] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const normalizeDepartment = (val: string): string => {
        const d = (val || "").trim();
        if (!d) return "";
        const lower = d.toLowerCase();
        if (/maint/i.test(lower)) return "Maintenance";
        if (/prod/i.test(lower)) return "Production";
        if (/qual/i.test(lower)) return "Quality";
        if (/util/i.test(lower)) return "Utility";
        if (/tool/i.test(lower)) return "Tooling";
        if (/elect/i.test(lower)) return "Electrical";
        return d.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
    };

    const departments = Array.from(
        new Set(
            rows
                .map((r) => normalizeDepartment(r["Department"] || r["department"] || ""))
                .filter(Boolean)
        )
    ).sort();

    const categories = Array.from(
        new Set(
            rows
                .map((r) => (r["Category"] || r["category"] || r["Type"] || "").trim())
                .filter(Boolean)
        )
    ).sort();

    const filtered = rows.filter((r) => {
        const s = search.toLowerCase().trim();
        const assetId = (r["Asset ID"] || r["assetId"] || r["Machine ID"] || "").toLowerCase();
        const name = (r["Machine Name"] || r["Name"] || r["machineName"] || r["Asset Name"] || "").toLowerCase();
        const cat = (r["Category"] || r["category"] || r["Type"] || "").toLowerCase();
        const dept = (r["Department"] || r["department"] || "").toLowerCase();
        const loc = (r["Location"] || r["location"] || r["Bay"] || "").toLowerCase();
        const make = (r["Make"] || r["make"] || "").toLowerCase();
        const model = (r["Model"] || r["model"] || "").toLowerCase();
        const serial = (r["Serial No."] || r["Serial No"] || r["serialNo"] || "").toLowerCase();
        const resp = (r["Responsible Person"] || r["responsiblePerson"] || "").toLowerCase();
        const amc = (r["AMC Vendor"] || r["amcVendor"] || "").toLowerCase();
        const use = (r["Use"] || r["use"] || r["Description"] || "").toLowerCase();
        const qty = (r["Quantity"] || r["qty"] || "").toLowerCase();

        const matchesSearch =
            !s ||
            assetId.includes(s) ||
            name.includes(s) ||
            cat.includes(s) ||
            dept.includes(s) ||
            loc.includes(s) ||
            make.includes(s) ||
            model.includes(s) ||
            serial.includes(s) ||
            resp.includes(s) ||
            amc.includes(s) ||
            use.includes(s) ||
            qty.includes(s);

        const statusVal = (r["Status"] || r["status"] || "").toLowerCase();
        const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "running" && /running|operational|active/i.test(statusVal)) ||
            (statusFilter === "maintenance" && /maintenance|scheduled|pm/i.test(statusVal)) ||
            (statusFilter === "standby" && /standby|auxiliary/i.test(statusVal)) ||
            (statusFilter === "outofservice" && /out of service|breakdown|stopped/i.test(statusVal));

        const matchesDept = deptFilter === "all" || normalizeDepartment(r["Department"] || r["department"] || "") === deptFilter;
        const matchesCrit = critFilter === "all" || (r["Criticality"] || r["criticality"] || "") === critFilter;
        const matchesCat = catFilter === "all" || (r["Category"] || r["category"] || r["Type"] || "") === catFilter;

        return matchesSearch && matchesStatus && matchesDept && matchesCrit && matchesCat;
    });

    const sorted = [...filtered].sort((a, b) => {
        const timeA = new Date(a["Created At"] || a["Last Updated"] || a["createdAt"] || a["lastUpdated"] || 0).getTime();
        const timeB = new Date(b["Created At"] || b["Last Updated"] || b["createdAt"] || b["lastUpdated"] || 0).getTime();
        if (timeA && timeB && timeA !== timeB) return timeB - timeA;
        return 0;
    });

    const totalPages = Math.ceil(sorted.length / pageSize) || 1;
    const paginatedRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    useEffect(() => {
        setCurrentPage(1);
    }, [rows.length]);

    // Dynamic stats
    const totalCount = rows.length;
    const runningCount = rows.filter((r) => /running|operational|active/i.test(r["Status"] || r["status"] || "")).length;
    const maintenanceCount = rows.filter((r) => /maintenance|scheduled|pm/i.test(r["Status"] || r["status"] || "")).length;
    const criticalCount = rows.filter((r) => (r["Criticality"] || r["criticality"] || "") === "Critical").length;
    const amcCount = rows.filter((r) => (r["AMC Vendor"] || r["amcVendor"] || "").trim().length > 0).length;

    // QR Code Generation
    useEffect(() => {
        if (!selectedQrAsset) {
            setQrDataUrl("");
            return;
        }

        const assetId = selectedQrAsset["Asset ID"] || selectedQrAsset["assetId"] || "";
        const targetUrl =
            selectedQrAsset["QR Link"] ||
            (typeof window !== "undefined"
                ? `${window.location.origin}/machine/${encodeURIComponent(assetId)}`
                : `http://localhost:3000/machine/${encodeURIComponent(assetId)}`);

        setQrLoading(true);
        QRCode.toDataURL(targetUrl, {
            width: 320,
            margin: 2,
            color: {
                dark: "#0f172a",
                light: "#ffffff",
            },
            errorCorrectionLevel: "H",
        })
            .then((url) => {
                setQrDataUrl(url);
                setQrLoading(false);
            })
            .catch((err) => {
                console.error("QR Generation Error:", err);
                setQrLoading(false);
            });
    }, [selectedQrAsset]);

    const handlePrintQr = () => {
        if (!selectedQrAsset || !qrDataUrl) return;

        const assetId = selectedQrAsset["Asset ID"] || selectedQrAsset["assetId"] || "UNKNOWN";
        const machineName = selectedQrAsset["Machine Name"] || selectedQrAsset["Asset Name"] || "Industrial Asset";
        const dept = selectedQrAsset["Department"] || "Plant Operations";
        const loc = selectedQrAsset["Location"] || "Main Plant";
        const cat = selectedQrAsset["Category"] || "General Equipment";
        const make = selectedQrAsset["Make"] || "";
        const model = selectedQrAsset["Model"] || "";
        const targetUrl =
            selectedQrAsset["QR Link"] ||
            (typeof window !== "undefined"
                ? `${window.location.origin}/machine/${encodeURIComponent(assetId)}`
                : `http://localhost:3000/machine/${encodeURIComponent(assetId)}`);

        const printWindow = window.open("", "_blank", "width=600,height=800");
        if (!printWindow) {
            alert("Please allow popups to print the QR label.");
            return;
        }

        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Skyline QR Label - ${assetId}</title>
  <style>
    @page { margin: 10mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 90vh;
      background: #f8fafc;
    }
    .card {
      width: 440px;
      border: 3px solid #880b13;
      border-radius: 24px;
      background: #ffffff;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.08);
      text-align: center;
    }
    .header {
      background: linear-gradient(135deg, #6f0912 0%, #880b13 60%, #a3121b 100%);
      color: #ffffff;
      padding: 24px 20px 20px;
    }
    .title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin: 0;
      text-transform: uppercase;
    }
    .subtitle {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.9;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .body {
      padding: 24px 28px 28px;
    }
    .asset-box {
      background: #fdf2f2;
      border: 1.5px dashed #f87171;
      padding: 8px 18px;
      border-radius: 12px;
      display: inline-block;
      margin-bottom: 14px;
    }
    .asset-label {
      font-size: 10px;
      font-weight: 800;
      color: #991b1b;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .asset-val {
      font-size: 22px;
      font-weight: 900;
      color: #880b13;
      font-family: monospace;
      margin-top: 2px;
    }
    .machine-name {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 8px;
    }
    .tags {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 18px;
    }
    .tag {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
    }
    .qr-container {
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
      display: inline-block;
      margin-bottom: 14px;
    }
    .qr-container img {
      width: 220px;
      height: 220px;
      display: block;
    }
    .instruction {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      margin-top: 6px;
    }
    .url {
      font-size: 10px;
      color: #64748b;
      font-family: monospace;
      word-break: break-all;
      margin-top: 4px;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding: 12px 20px;
      background: #f8fafc;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Skyline Digital System</div>
      <div class="subtitle">Asset Identification Tag</div>
    </div>
    <div class="body">
      <div class="asset-box">
        <div class="asset-label">Asset ID</div>
        <div class="asset-val">${assetId}</div>
      </div>
      <div class="machine-name">${machineName}</div>
      <div class="tags">
        <span class="tag">📁 ${cat}</span>
        <span class="tag">📍 ${dept} / ${loc}</span>
        ${make ? `<span class="tag">🏭 ${make} ${model}</span>` : ""}
      </div>
      <div class="qr-container">
        <img src="${qrDataUrl}" alt="QR Code for ${assetId}" />
      </div>
      <div class="instruction">Scan with Mobile to Start Digital Inspection & Checklists</div>
      <div class="url">${targetUrl}</div>
    </div>
    <div class="footer">
      Skyline Project &amp; Engineers Pvt. Ltd. • Maintenance &amp; Safety Division
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
        `);
        printWindow.document.close();
    };

    const handleCopyLink = () => {
        if (!selectedQrAsset) return;
        const assetId = selectedQrAsset["Asset ID"] || selectedQrAsset["assetId"] || "";
        const targetUrl =
            selectedQrAsset["QR Link"] ||
            (typeof window !== "undefined"
                ? `${window.location.origin}/machine/${encodeURIComponent(assetId)}`
                : `http://localhost:3000/machine/${encodeURIComponent(assetId)}`);

        navigator.clipboard.writeText(targetUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };


    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* 1. TOP ASSET KPI STATS CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="rounded-2xl bg-white p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Assets</span>
                        <span className="text-base">📦</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-900">{totalCount}</span>
                        <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Cataloged
                        </span>
                    </div>
                </div>

                <div className="rounded-2xl bg-white p-4 border border-emerald-200/90 bg-emerald-50/20 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Operational</span>
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-black text-emerald-950">{runningCount}</span>
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            {totalCount > 0 ? Math.round((runningCount / totalCount) * 100) : 0}% Uptime
                        </span>
                    </div>
                </div>

                <div className="rounded-2xl bg-white p-4 border border-amber-200/90 bg-amber-50/20 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">In Maintenance</span>
                        <span className="text-base">🛠️</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-black text-amber-950">{maintenanceCount}</span>
                        <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                            Active PM
                        </span>
                    </div>
                </div>

                <div className="rounded-2xl bg-white p-4 border border-rose-200/90 bg-rose-50/20 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">Critical Tier 1</span>
                        <span className="text-base">🚨</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-black text-rose-950">{criticalCount}</span>
                        <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                            Zero Failure
                        </span>
                    </div>
                </div>

                <div className="col-span-2 sm:col-span-1 rounded-2xl bg-white p-4 border border-indigo-200/90 bg-indigo-50/20 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800">AMC / Vendor</span>
                        <span className="text-base">📑</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-black text-indigo-950">{amcCount}</span>
                        <span className="text-[10px] font-extrabold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full">
                            Covered
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. FILTER & SEARCH CONTROL TOOLBAR */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3.5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1 max-w-md">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            🔍
                        </span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by Asset ID, Machine Name, Make, Serial..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:border-[#880b13] transition-colors"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Action buttons (Add Asset & Export) */}
                    <div className="flex items-center gap-2 self-end lg:self-auto flex-wrap">
                        {onAddNew && (
                            <button
                                type="button"
                                onClick={onAddNew}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#880b13] hover:bg-[#72070e] text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                                title="Add a new industrial asset"
                            >
                                <span>➕</span>
                                <span>Add New Asset</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Dropdown Filters Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-[#880b13]"
                        >
                            <option value="all">All Statuses ({totalCount})</option>
                            <option value="running">Operational / Running</option>
                            <option value="maintenance">Under Maintenance</option>
                            <option value="standby">Standby</option>
                            <option value="outofservice">Out of Service</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Department</label>
                        <select
                            value={deptFilter}
                            onChange={(e) => {
                                setDeptFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-[#880b13]"
                        >
                            <option value="all">All Departments</option>
                            {departments.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Criticality</label>
                        <select
                            value={critFilter}
                            onChange={(e) => {
                                setCritFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-[#880b13]"
                        >
                            <option value="all">All Criticalities</option>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Category</label>
                        <select
                            value={catFilter}
                            onChange={(e) => {
                                setCatFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-[#880b13]"
                        >
                            <option value="all">All Categories ({categories.length})</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 3. ASSET DATA TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                <th className="py-3 px-4">Asset ID &amp; QR</th>
                                <th className="py-3 px-4">Asset / Machine Name</th>
                                <th className="py-3 px-4">Make &amp; Model</th>
                                <th className="py-3 px-4">Dept / Location</th>
                                <th className="py-3 px-4">Criticality</th>
                                <th className="py-3 px-4">Operational Status</th>
                                <th className="py-3 px-4">PM &amp; AMC</th>
                                <th className="py-3 px-4">Responsible Person</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {paginatedRows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                                        <div className="text-3xl mb-2">🔍</div>
                                        <div>No plant assets found matching the selected filters.</div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedRows.map((r, idx) => {
                                    const assetId = r["Asset ID"] || r["assetId"] || r["Machine ID"] || `AST-${idx}`;
                                    const name = r["Machine Name"] || r["Asset Name"] || "Unnamed Asset";
                                    const cat = r["Category"] || r["Type"] || "General";
                                    const dept = r["Department"] || "-";
                                    const loc = r["Location"] || "-";
                                    const make = r["Make"] || "";
                                    const model = r["Model"] || "";
                                    const serial = r["Serial No."] || r["Serial No"] || "";
                                    const crit = r["Criticality"] || "Medium";
                                    const status = r["Status"] || "Operational";
                                    const pmFreq = r["PM Frequency"] || "-";
                                    const amcVendor = r["AMC Vendor"] || "";
                                    const amcExpiry = r["AMC Expiry"] || "";
                                    const resp = r["Responsible Person"] || "-";

                                    return (
                                        <tr key={assetId + idx} className="hover:bg-slate-50/70 transition-colors group">
                                            {/* Asset ID with QR Code Button */}
                                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedQrAsset(r)}
                                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#880b13] text-slate-600 hover:text-white transition-all shadow-2xs cursor-pointer"
                                                        title="View & Print QR Label"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75Z" />
                                                        </svg>
                                                    </button>
                                                    <span className="text-slate-900 font-extrabold text-xs">{assetId}</span>
                                                </div>
                                            </td>

                                            {/* Name & Category */}
                                            <td className="py-3.5 px-4 min-w-[220px]">
                                                <div className="font-black text-slate-900 text-xs">{name}</div>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">
                                                        {cat}
                                                    </span>
                                                    {(r["Quantity"] || r["qty"]) && (
                                                        <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-[10px] font-bold text-blue-700 border border-blue-200/80">
                                                            {r["Quantity"] || r["qty"]}
                                                        </span>
                                                    )}
                                                </div>
                                                {(r["Use"] || r["use"] || r["Description"]) && (
                                                    <div className="text-[11px] text-slate-500 font-normal line-clamp-2 mt-1 max-w-[280px]" title={r["Use"] || r["use"] || r["Description"]}>
                                                        {r["Use"] || r["use"] || r["Description"]}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Make & Model */}
                                            <td className="py-3.5 px-4 min-w-[140px]">
                                                <div className="font-extrabold text-slate-800 text-xs">{make || "-"}</div>
                                                <div className="text-[11px] text-slate-400 font-medium truncate max-w-[150px]" title={model}>
                                                    {model || "-"}
                                                </div>
                                                {serial && (
                                                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">S/N: {serial}</div>
                                                )}
                                            </td>

                                            {/* Department & Location */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <div className="font-bold text-slate-800 text-xs">{dept}</div>
                                                <div className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                                                    <span>📍</span>
                                                    <span>{loc}</span>
                                                </div>
                                            </td>

                                            {/* Criticality */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide border ${
                                                        crit === "Critical"
                                                            ? "bg-rose-50 text-rose-800 border-rose-300"
                                                            : crit === "High"
                                                            ? "bg-amber-50 text-amber-800 border-amber-300"
                                                            : crit === "Medium"
                                                            ? "bg-blue-50 text-blue-800 border-blue-200"
                                                            : "bg-slate-100 text-slate-600 border-slate-200"
                                                    }`}
                                                >
                                                    {crit}
                                                </span>
                                            </td>

                                            {/* Operational Status */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                                        /running|operational|active/i.test(status)
                                                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                                            : /maintenance|scheduled|pm/i.test(status)
                                                            ? "bg-amber-50 text-amber-800 border-amber-300"
                                                            : /standby/i.test(status)
                                                            ? "bg-slate-100 text-slate-700 border-slate-300"
                                                            : "bg-rose-50 text-rose-800 border-rose-300"
                                                    }`}
                                                >
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${
                                                            /running|operational|active/i.test(status)
                                                                ? "bg-emerald-500 animate-pulse"
                                                                : /maintenance/i.test(status)
                                                                ? "bg-amber-500"
                                                                : "bg-rose-500"
                                                        }`}
                                                    />
                                                    {status}
                                                </span>
                                            </td>

                                            {/* PM & AMC */}
                                            <td className="py-3.5 px-4 min-w-[130px]">
                                                <div className="font-bold text-slate-800 text-[11px]">PM: {pmFreq}</div>
                                                {amcVendor ? (
                                                    <div className="text-[10px] text-indigo-700 font-semibold truncate max-w-[130px]" title={amcVendor}>
                                                        AMC: {amcVendor}
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-slate-400 font-medium">In-House Maint</div>
                                                )}
                                                {amcExpiry && (
                                                    <div className="text-[10px] text-slate-400">Exp: {amcExpiry}</div>
                                                )}
                                            </td>

                                            {/* Responsible Person */}
                                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium text-xs">
                                                {resp}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <a
                                                        href={`/machine/${encodeURIComponent(assetId)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                        title="Open Operator Digital Checklist"
                                                    >
                                                        📋
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit(r)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#880b13] hover:bg-rose-50 transition-colors"
                                                        title="Edit Asset Details"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(r)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                        title="Delete Asset"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 4. PAGINATION FOOTER */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="text-slate-500 font-medium">
                        Showing <span className="font-bold text-slate-800">{filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{" "}
                        <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, filtered.length)}</span> of{" "}
                        <span className="font-bold text-slate-800">{filtered.length}</span> plant assets
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700"
                        >
                            <option value={10}>10 per page</option>
                            <option value={25}>25 per page</option>
                            <option value={50}>50 per page</option>
                        </select>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                            >
                                ‹ Prev
                            </button>
                            <span className="px-2 font-bold text-slate-700">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                            >
                                Next ›
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. QR CODE MODAL DIALOG */}
            {selectedQrAsset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-900 via-[#880b13] to-slate-900 text-white p-5 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-200">Digital Asset Tag</span>
                                <h3 className="text-base font-black text-white mt-0.5">
                                    {selectedQrAsset["Machine Name"] || selectedQrAsset["Asset Name"] || "Plant Asset"}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedQrAsset(null)}
                                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 text-center space-y-4">
                            <div className="inline-block px-3 py-1 rounded-xl bg-rose-50 border border-rose-200 font-mono font-black text-sm text-[#880b13]">
                                {selectedQrAsset["Asset ID"] || selectedQrAsset["assetId"]}
                            </div>

                            <div className="flex justify-center">
                                <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-sm inline-block">
                                    {qrLoading ? (
                                        <div className="w-56 h-56 flex items-center justify-center">
                                            <div className="w-8 h-8 border-3 border-[#880b13] border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : qrDataUrl ? (
                                        <img src={qrDataUrl} alt="Asset QR Code" className="w-56 h-56 rounded-lg" />
                                    ) : (
                                        <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                                            Failed to generate QR
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-xs font-black text-slate-800">Direct Operator Mobile Inspection Link</p>
                                <p className="text-[11px] text-slate-500 font-medium">
                                    Scanning this QR code directs plant operators instantly to the daily 5S &amp; maintenance inspection checklist.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                                >
                                    {copiedLink ? "✓ Copied Link" : "📋 Copy URL"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePrintQr}
                                    className="px-3 py-2 rounded-xl bg-[#880b13] hover:bg-[#72070e] text-white text-xs font-black shadow-xs transition-all flex items-center justify-center gap-1.5"
                                >
                                    <span>🖨️</span>
                                    <span>Print Sticker Tag</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
