"use client";

import { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import type { Row } from "./UserMasterTable";

interface MachineMasterTableProps {
    rows: Row[];
    onEdit: (row: Row) => void;
    onDelete: (row: Row) => void;
    onAddNew?: () => void;
}

export default function MachineMasterTable({
    rows,
    onEdit,
    onDelete,
    onAddNew,
}: MachineMasterTableProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [deptFilter, setDeptFilter] = useState("all");
    const [critFilter, setCritFilter] = useState("all");
    const [catFilter, setCatFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // QR Modal State (Defect 7)
    const [selectedQrMachine, setSelectedQrMachine] = useState<Row | null>(null);
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
        const name = (r["Machine Name"] || r["Name"] || r["machineName"] || "").toLowerCase();
        const cat = (r["Category"] || r["category"] || r["Type"] || "").toLowerCase();
        const dept = (r["Department"] || r["department"] || "").toLowerCase();
        const loc = (r["Location"] || r["location"] || r["Bay"] || "").toLowerCase();
        const make = (r["Make"] || r["make"] || "").toLowerCase();
        const model = (r["Model"] || r["model"] || "").toLowerCase();
        const serial = (r["Serial No."] || r["Serial No"] || r["serialNo"] || "").toLowerCase();
        const resp = (r["Responsible Person"] || r["responsiblePerson"] || "").toLowerCase();
        const amc = (r["AMC Vendor"] || r["amcVendor"] || "").toLowerCase();
        const assignedUsers = Array.isArray((r as any).assignedUsers)
            ? (r as any).assignedUsers.join(" ").toLowerCase()
            : String(r["Assigned Users"] || "").toLowerCase();

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
            assignedUsers.includes(s);

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

    const hasActiveFilters = search || statusFilter !== "all" || deptFilter !== "all" || critFilter !== "all" || catFilter !== "all";

    const totalRecords = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const pageRows = sorted.slice(startIndex, endIndex);

    useEffect(() => {
        setCurrentPage(1);
    }, [rows.length]);

    const getMachineQrUrl = (machineRow: Row | null): string => {
        if (!machineRow) return "";
        const assetId = String(machineRow["Asset ID"] || machineRow["assetId"] || machineRow["Machine ID"] || "").trim();
        const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
        return `${origin}/machine/${encodeURIComponent(assetId)}`;
    };

    // Generate QR when modal opens
    const handleOpenQrModal = async (machineRow: Row) => {
        setSelectedQrMachine(machineRow);
        setCopiedLink(false);
        setQrLoading(true);
        const link = getMachineQrUrl(machineRow);

        try {
            const url = await QRCode.toDataURL(link, {
                width: 500,
                margin: 2,
                errorCorrectionLevel: "M",
                color: {
                    dark: "#1e293b",
                    light: "#ffffff",
                },
            });
            setQrDataUrl(url);
        } catch (err) {
            console.error("Failed to generate QR Code:", err);
        } finally {
            setQrLoading(false);
        }
    };

    const handleCopyLink = () => {
        if (!selectedQrMachine) return;
        const link = getMachineQrUrl(selectedQrMachine);
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleDownloadPng = () => {
        if (!qrDataUrl || !selectedQrMachine) return;
        const assetId = selectedQrMachine["Asset ID"] || selectedQrMachine["assetId"] || "machine";
        const a = document.createElement("a");
        a.href = qrDataUrl;
        a.download = `QR_${assetId}.png`;
        a.click();
    };

    const handlePrintLabel = () => {
        if (!selectedQrMachine || !qrDataUrl) return;
        const assetId = selectedQrMachine["Asset ID"] || selectedQrMachine["assetId"] || "";
        const name = selectedQrMachine["Machine Name"] || selectedQrMachine["Name"] || "Machine";
        const dept = selectedQrMachine["Department"] || selectedQrMachine["department"] || "";
        const loc = selectedQrMachine["Location"] || selectedQrMachine["location"] || "";
        const win = window.open("", "_blank", "width=700,height=900");
        if (!win) {
            alert("Pop-up blocked. Please allow pop-ups to print the QR label.");
            return;
        }

        win.document.write(`<!doctype html>
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
      font-size: 11px;
      font-weight: 700;
      padding: 3px 12px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .qr-container {
      width: 250px;
      height: 250px;
      margin: 0 auto;
      border: 1.5px solid #e2e8f0;
      border-radius: 16px;
      padding: 10px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    .qr-container img {
      width: 100%;
      height: 100%;
      display: block;
    }
    .note {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Skyline Project & Engineers</div>
      <div class="subtitle">Maintenance & Safety Digital System</div>
    </div>
    <div class="body">
      <div class="asset-box">
        <div class="asset-label">Asset Identifier</div>
        <div class="asset-val">${assetId}</div>
      </div>
      <div class="machine-name">${name}</div>
      <div class="tags">
        ${dept ? `<span class="tag">🏢 ${dept}</span>` : ""}
        ${loc ? `<span class="tag">📍 ${loc}</span>` : ""}
      </div>
      <div class="qr-container">
        <img src="${qrDataUrl}" alt="Machine QR Code" />
      </div>
      <div class="note">Scan with industrial barcode reader or mobile device to open workstation</div>
    </div>
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`);
        win.document.close();
    };

    // Close modal on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && selectedQrMachine) {
                setSelectedQrMachine(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedQrMachine]);

    const formatAssignedUsers = (r: Row) => {
        const raw = (r as any).assignedUsers || r["Assigned Users"] || "";
        if (Array.isArray(raw)) return raw.join(", ") || "None";
        return String(raw || "").trim() || "None";
    };


    return (
        <div className="space-y-3.5 w-full">
            {/* FILTER TOOLBAR */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by Asset ID, Machine Name, Make, Model, Serial, AMC, Dept..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-9 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#880b13] focus:bg-white focus:outline-hidden transition-all shadow-inner"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:border-[#880b13] focus:outline-hidden cursor-pointer"
                        >
                            <option value="all">⚡ All Statuses</option>
                            <option value="running">● Operational / Running</option>
                            <option value="maintenance">⚠️ Under PM / Maintenance</option>
                            <option value="standby">⏸️ Standby / Auxiliary</option>
                            <option value="outofservice">🛑 Out of Service</option>
                        </select>

                        {/* Category Filter */}
                        {categories.length > 0 && (
                            <select
                                value={catFilter}
                                onChange={(e) => {
                                    setCatFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:border-[#880b13] focus:outline-hidden cursor-pointer"
                            >
                                <option value="all">🏷️ All Categories</option>
                                {categories.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Department Filter */}
                        {departments.length > 0 && (
                            <select
                                value={deptFilter}
                                onChange={(e) => {
                                    setDeptFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:border-[#880b13] focus:outline-hidden cursor-pointer"
                            >
                                <option value="all">🏢 All Departments</option>
                                {departments.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Criticality Filter */}
                        <select
                            value={critFilter}
                            onChange={(e) => {
                                setCritFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:border-[#880b13] focus:outline-hidden cursor-pointer"
                        >
                            <option value="all">⚠️ All Criticality</option>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Normal">Normal</option>
                            <option value="Low">Low</option>
                        </select>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setStatusFilter("all");
                                    setDeptFilter("all");
                                    setCritFilter("all");
                                    setCatFilter("all");
                                    setCurrentPage(1);
                                }}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                                ✕ Reset
                            </button>
                        )}


                        {onAddNew && (
                            <button
                                type="button"
                                onClick={onAddNew}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#880b13] hover:bg-[#72070e] text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                                title="Add a new machine"
                            >
                                <span>➕</span>
                                <span>Add New Machine</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* HORIZONTAL DATA TABLE CONTAINER (ALL 17 USER-SPECIFIED COLUMNS) */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden w-full">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs divide-y divide-slate-200 min-w-[2100px]">
                        <thead className="bg-slate-50/95 font-black uppercase tracking-wider text-[11px] text-slate-700 border-b border-slate-200 sticky top-0 z-10 backdrop-blur-xs">
                            <tr>
                                <th className="px-3.5 py-3.5 whitespace-nowrap">#</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">1. Asset ID</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[180px]">2. Machine Name</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[140px]">3. Category</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">4. Department</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[140px]">5. Location</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[120px]">6. Make</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[120px]">7. Model</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">8. Serial No.</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[120px]">9. Criticality</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[160px]">10. Responsible Person</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[170px]">11. Assigned Users</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[140px]">12. Status</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">13. PM Frequency</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[160px]">14. AMC Vendor</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">15. AMC Contact</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">16. AMC Expiry</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">17. Installation Date</th>
                                <th className="px-4 py-3.5 whitespace-nowrap min-w-[140px]">18. QR Link</th>
                                <th className="px-4 py-3.5 text-right whitespace-nowrap min-w-[150px] sticky right-0 bg-slate-50/95 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)]">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={20} className="px-4 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-1.5">
                                            <span className="text-3xl">⚙️</span>
                                            <span className="font-bold text-slate-800 text-sm">No machines found</span>
                                            <span className="text-xs text-slate-400">Try adjusting your search query or active filters.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((r, idx) => {
                                    const rowNum = startIndex + idx + 1;
                                    const assetId = r["Asset ID"] || r["assetId"] || r["Machine ID"] || `SKY-00${rowNum}`;
                                    const name = r["Machine Name"] || r["Name"] || r["machineName"] || "Machine";
                                    const cat = r["Category"] || r["category"] || r["Type"] || "—";
                                    const dept = r["Department"] || r["department"] || "Production";
                                    const loc = r["Location"] || r["location"] || r["Bay"] || "Plant Floor";
                                    const make = r["Make"] || r["make"] || "—";
                                    const model = r["Model"] || r["model"] || "—";
                                    const serial = r["Serial No."] || r["Serial No"] || r["serialNo"] || "—";
                                    const crit = r["Criticality"] || r["criticality"] || "Normal";
                                    const resp = r["Responsible Person"] || r["responsiblePerson"] || r["User Name"] || r["userName"] || "—";
                                    const status = r["Status"] || r["status"] || "Running";
                                    const pmFreq = r["PM Frequency"] || r["pmFrequency"] || r["Frequency"] || "Monthly";
                                    const amcVendor = r["AMC Vendor"] || r["amcVendor"] || r["Vendor"] || "—";
                                    const amcContact = r["AMC Contact"] || r["amcContact"] || "—";
                                    const amcExpiry = r["AMC Expiry"] || r["amcExpiry"] || "—";
                                    const installDate = r["Installation Date"] || r["installationDate"] || "—";
                                    const qrLink = getMachineQrUrl(r);

                                    return (
                                        <tr key={assetId || idx} className="hover:bg-slate-50/80 transition-colors h-[54px] group">
                                            {/* Row Number */}
                                            <td className="px-3.5 py-3 whitespace-nowrap text-[11px] font-mono text-slate-400">
                                                {rowNum}
                                            </td>

                                            {/* 1. Asset ID */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                                    {assetId}
                                                </span>
                                            </td>

                                            {/* 2. Machine Name */}
                                            <td className="px-4 py-3 whitespace-nowrap font-extrabold text-slate-900 text-xs">
                                                {name}
                                            </td>

                                            {/* 3. Category */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
                                                    {cat}
                                                </span>
                                            </td>

                                            {/* 4. Department */}
                                            <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-700 text-xs">
                                                {dept}
                                            </td>

                                            {/* 5. Location */}
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-600 text-xs">
                                                <span className="flex items-center gap-1">
                                                    <span className="text-slate-400">📍</span> {loc}
                                                </span>
                                            </td>

                                            {/* 6. Make */}
                                            <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800 text-xs">
                                                {make}
                                            </td>

                                            {/* 7. Model */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-700">
                                                {model}
                                            </td>

                                            {/* 8. Serial No. */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600">
                                                {serial}
                                            </td>

                                            {/* 9. Criticality */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {/critical/i.test(crit) ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-900 border border-rose-300">
                                                        🔥 Critical
                                                    </span>
                                                ) : /high/i.test(crit) ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-800 border border-rose-200">
                                                        ⚠️ High
                                                    </span>
                                                ) : /medium/i.test(crit) ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800 border border-amber-200">
                                                        ⚡ Medium
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                                                        ● Normal
                                                    </span>
                                                )}
                                            </td>

                                            {/* 10. Responsible Person */}
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800 text-xs">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="h-5 w-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                                                        👤
                                                    </span>
                                                    {resp}
                                                </span>
                                            </td>

                                            {/* 11. Assigned Users */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {(() => {
                                                    let rawUsers = (r as any).assignedUsers;
                                                    if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
                                                        if (r["Assigned Users"]) {
                                                            rawUsers = typeof r["Assigned Users"] === "string"
                                                                ? r["Assigned Users"].split(",").map((s: string) => s.trim()).filter(Boolean)
                                                                : Array.isArray(r["Assigned Users"]) ? r["Assigned Users"] : [];
                                                        }
                                                    }
                                                    const userList: string[] = Array.isArray(rawUsers)
                                                        ? rawUsers
                                                        : String(rawUsers || "").split(",").map((s: string) => s.trim()).filter(Boolean);
                                                    if (userList.length === 0) {
                                                        return <span className="text-[11px] text-slate-400 italic">None assigned</span>;
                                                    }
                                                    const userDetails: any[] = (r as any).assignedUserDetails || [];
                                                    return (
                                                        <div className="flex flex-wrap items-center gap-1.5 max-w-[240px]">
                                                            {userList.slice(0, 2).map((uId) => {
                                                                const match = userDetails.find(
                                                                    (u: any) => String(u.userId || "").toUpperCase() === String(uId).toUpperCase()
                                                                );
                                                                const displayName = match && match.name && match.name !== uId ? `${match.name} (${uId})` : uId;
                                                                const tooltip = match ? `${match.name} (${uId}) · ${match.role}${match.email ? ` · ${match.email}` : ""}` : uId;
                                                                return (
                                                                    <span
                                                                        key={uId}
                                                                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-900 border border-indigo-200"
                                                                        title={tooltip}
                                                                    >
                                                                        <span>👤</span>
                                                                        <span className="font-bold">{displayName}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                            {userList.length > 2 && (
                                                                <span
                                                                    className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200"
                                                                    title={userList.slice(2).join(", ")}
                                                                >
                                                                    +{userList.length - 2}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            {/* 12. Status */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {/^(running|operational|active)$/i.test(status) ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        Operational
                                                    </span>
                                                ) : /maintenance|scheduled|pm/i.test(status) ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                                        Under PM
                                                    </span>
                                                ) : /out of service|breakdown/i.test(status) ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                                        Out of Service
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                                                        Standby
                                                    </span>
                                                )}
                                            </td>

                                            {/* 12. PM Frequency */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                                                    ⏱️ {pmFreq}
                                                </span>
                                            </td>

                                            {/* 13. AMC Vendor */}
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800 text-xs">
                                                {amcVendor}
                                            </td>

                                            {/* 14. AMC Contact */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                                                {amcContact}
                                            </td>

                                            {/* 15. AMC Expiry */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px]">
                                                {amcExpiry && amcExpiry !== "—" && amcExpiry !== "N/A" ? (
                                                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700 border border-slate-200">
                                                        📅 {amcExpiry}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* 16. Installation Date */}
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                                                {installDate}
                                            </td>

                                            {/* 17. QR Link */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenQrModal(r)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-[#880b13]/20 bg-[#faf1f2] px-2.5 py-1 text-[11px] font-bold text-[#880b13] hover:bg-[#880b13] hover:text-white transition-all shadow-2xs cursor-pointer"
                                                    title={`View QR details for ${assetId}`}
                                                >
                                                    <span>📷</span> View QR
                                                </button>
                                            </td>

                                            {/* Actions Column (Sticky on right) */}
                                            <td className="px-4 py-3 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50/80 transition-colors shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)]">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenQrModal(r)}
                                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                                                        title="View QR Label & Scanner"
                                                    >
                                                        📷 QR
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit(r)}
                                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                                                        title="Edit Machine Details"
                                                    >
                                                        ✎ Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(r)}
                                                        className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer"
                                                        title="Delete Machine"
                                                    >
                                                        🗑
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

                {/* PAGINATION FOOTER */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-4 py-3 text-xs text-slate-600">
                    <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-600">
                            Showing <strong className="text-slate-900 font-bold">{totalRecords === 0 ? 0 : startIndex + 1}–{endIndex}</strong> of{" "}
                            <strong className="text-slate-900 font-bold">{totalRecords}</strong> machines
                        </span>
                        <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                            <span className="text-[11px] text-slate-500 font-medium">Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs focus:border-[#880b13] focus:outline-hidden cursor-pointer"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={safeCurrentPage <= 1}
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed shadow-2xs transition-colors"
                        >
                            ← Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={`h-8 w-8 rounded-lg text-xs font-black transition-all shadow-2xs ${page === safeCurrentPage ? "bg-[#880b13] text-white shadow-xs" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={safeCurrentPage >= totalPages}
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed shadow-2xs transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>

            {/* DEFECT 7: DEDICATED VIEW QR CODE MODAL (DOES NOT REDIRECT OR LEAVE ADMIN PANEL) */}
            {selectedQrMachine && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedQrMachine(null);
                    }}
                >
                    <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#880b13] to-[#a3121b] px-5 py-4 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-lg border border-white/20">
                                    📷
                                </div>
                                <div>
                                    <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                                        Machine QR Code
                                        <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-bold text-emerald-200 border border-emerald-400/30 uppercase tracking-wider">
                                            Live Asset Tag
                                        </span>
                                    </h3>
                                    <p className="text-[11px] text-white/80 font-medium">
                                        Scan or print permanent industrial label
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedQrMachine(null)}
                                className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors font-bold text-xs cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4 text-center">
                            {/* Machine Identity */}
                            <div>
                                <span className="font-mono text-xs font-black text-[#880b13] bg-[#faf1f2] border border-[#880b13]/20 px-3 py-1 rounded-full inline-block mb-1.5">
                                    {selectedQrMachine["Asset ID"] || selectedQrMachine["assetId"] || selectedQrMachine["Machine ID"]}
                                </span>
                                <h4 className="text-base font-black text-slate-900">
                                    {selectedQrMachine["Machine Name"] || selectedQrMachine["Name"] || selectedQrMachine["machineName"] || "Machine"}
                                </h4>
                                <div className="flex items-center justify-center gap-1.5 mt-1 text-[11px] font-semibold text-slate-500">
                                    {selectedQrMachine["Department"] && (
                                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-700 font-bold">
                                            🏢 {selectedQrMachine["Department"]}
                                        </span>
                                    )}
                                    {selectedQrMachine["Location"] && (
                                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-700 font-bold">
                                            📍 {selectedQrMachine["Location"]}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* QR Code Canvas / Image Display */}
                            <div className="relative mx-auto w-56 h-56 rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 shadow-inner flex items-center justify-center">
                                {qrLoading ? (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="w-8 h-8 border-3 border-[#880b13] border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-xs font-bold text-slate-500">Generating QR...</span>
                                    </div>
                                ) : qrDataUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={qrDataUrl}
                                        alt="Machine QR Code"
                                        className="w-full h-full object-contain rounded-xl"
                                    />
                                ) : (
                                    <span className="text-xs text-rose-500 font-bold">Failed to load QR</span>
                                )}
                            </div>

                            {/* Encoded URL & Copy Button */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-left space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                                        Encoded Destination URL:
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        className="text-[11px] font-bold text-[#880b13] hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <span>{copiedLink ? "✓ Copied!" : "📋 Copy Link"}</span>
                                    </button>
                                </div>
                                <p className="font-mono text-[11px] text-slate-800 break-all bg-white p-1.5 rounded-lg border border-slate-200">
                                    {getMachineQrUrl(selectedQrMachine)}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                                <button
                                    type="button"
                                    onClick={handlePrintLabel}
                                    className="rounded-xl bg-[#880b13] hover:bg-[#a3121b] text-white py-2.5 px-3 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <span>🖨️</span> Print Label
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDownloadPng}
                                    className="rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 py-2.5 px-3 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <span>⬇️</span> Download PNG
                                </button>
                            </div>

                            <div className="flex items-center justify-center gap-3 pt-1">
                                <a
                                    href={getMachineQrUrl(selectedQrMachine)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-bold text-slate-600 hover:text-[#880b13] transition-colors flex items-center gap-1"
                                >
                                    <span>Open Machine Workstation in New Tab</span>
                                    <span>↗</span>
                                </a>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-400">
                                Skyline QR System • Safe & Permanent Tag
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedQrMachine(null)}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
