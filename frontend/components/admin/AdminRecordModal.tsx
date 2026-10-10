"use client";

import { useState, useEffect } from "react";
import PhotoInput from "@/components/operator/PhotoInput";
import { uploadPhoto } from "@/lib/uploadPhoto";
import type { Row } from "./UserMasterTable";

export interface EditorState {
    row: Row;
    isNew: boolean;
}

interface AdminRecordModalProps {
    editor: EditorState | null;
    columns?: string[];
    activeViewKey?: string;
    activeView?: string;
    singularName?: string;
    machinesList?: any[];
    usersList?: any[];
    onClose: () => void;
    onSave?: (row: Row) => void;
    onSuccess?: (msg: string) => void;
}

export default function AdminRecordModal({
    editor,
    columns = [],
    activeViewKey = "",
    activeView = "",
    singularName = "Record",
    machinesList = [],
    usersList = [],
    onClose,
    onSave,
    onSuccess,
}: AdminRecordModalProps) {
    if (!editor) return null;

    const [row, setRow] = useState<Row>({ ...(editor.row || {}) });
    const [photoUploading, setPhotoUploading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [copiedPass, setCopiedPass] = useState(false);

    const keyLower = (activeViewKey || activeView || "").toLowerCase().trim();
    const isUserMaster = keyLower.includes("user");
    const isMachineMaster = keyLower.includes("machine");
    const isChecklistMaster = keyLower.includes("checklist");
    const isBreakdownView = keyLower.includes("breakdown") || keyLower.includes("repair");
    const isMaintenanceView = keyLower.includes("maintenance");
    const isSafetyView = keyLower.includes("safety");
    const isPartsView = keyLower.includes("part") || keyLower.includes("amc");
    const isDocumentView = keyLower.includes("doc") || keyLower.includes("register");
    const isNotificationsView = keyLower.includes("notification") || keyLower.includes("alert");
    const isComplianceView = keyLower.includes("month") || keyLower.includes("compliance");
    const isTrainingView = keyLower.includes("training") || keyLower.includes("skill");
    const isHiraView = keyLower.includes("hira") || keyLower.includes("hazard") || keyLower.includes("risk");

    // Track unique record ID to prevent parent re-renders from overwriting typed state
    const rowId = editor?.row
        ? editor.row["recordId"] ||
        editor.row["User ID"] ||
        editor.row["Asset ID"] ||
        editor.row["Template ID"] ||
        editor.row["Alert ID"] ||
        editor.row["partId"] ||
        editor.row["docId"] ||
        editor.row["__row"] ||
        JSON.stringify(editor.row)
        : null;

    useEffect(() => {
        if (editor) {
            const initialRow = { ...editor.row };

            // Auto-generate realistic record IDs when creating a NEW record if empty
            if (editor.isNew) {
                const todayStr = new Date().toISOString().split("T")[0];
                const randomNum = Math.floor(100 + Math.random() * 900);

                if (isUserMaster && !initialRow["User ID"]) initialRow["User ID"] = `USR-0${randomNum}`;
                if (isMachineMaster && !initialRow["Asset ID"]) initialRow["Asset ID"] = `MAC-0${randomNum}`;
                if (isChecklistMaster && !initialRow["Template ID"]) initialRow["Template ID"] = `CHK-${randomNum}`;
                if (isMaintenanceView && !initialRow["recordId"] && !initialRow["Maintenance ID"]) {
                    initialRow["recordId"] = `MNT-0${randomNum}`;
                    initialRow["Maintenance ID"] = `MNT-0${randomNum}`;
                    initialRow["Date"] = todayStr;
                }
                if (isSafetyView && !initialRow["recordId"] && !initialRow["Safety Record ID"]) {
                    initialRow["recordId"] = `SAF-0${randomNum}`;
                    initialRow["Safety Record ID"] = `SAF-0${randomNum}`;
                    initialRow["Date"] = todayStr;
                }
                if (isPartsView && !initialRow["Part / AMC ID"] && !initialRow["partId"]) {
                    initialRow["Part / AMC ID"] = `PRT-0${randomNum}`;
                    initialRow["partId"] = `PRT-0${randomNum}`;
                }
                if (isDocumentView && !initialRow["Document ID"] && !initialRow["docId"]) {
                    initialRow["Document ID"] = `DOC-0${randomNum}`;
                    initialRow["docId"] = `DOC-0${randomNum}`;
                    initialRow["Date"] = todayStr;
                }
                if (isNotificationsView && !initialRow["Alert ID"]) {
                    initialRow["Alert ID"] = `ALT-0${randomNum}`;
                    initialRow["Date & Time"] = new Date().toLocaleString();
                }
                if (isComplianceView && !initialRow["Compliance ID"]) {
                    initialRow["Compliance ID"] = `CMP-0${randomNum}`;
                    initialRow["Month"] = "October 2026";
                }
                if (isBreakdownView && !initialRow["Breakdown Ticket"]) {
                    initialRow["Breakdown Ticket"] = `BD-2026${randomNum}`;
                    initialRow["Reported Date"] = todayStr;
                    initialRow["Status"] = "Open";
                }
                if (isTrainingView && !initialRow["Training ID"]) {
                    initialRow["Training ID"] = `TRN-0${randomNum}`;
                    initialRow["Completion Date"] = todayStr;
                    initialRow["Status"] = "Completed";
                }
                if (isHiraView && !initialRow["Hazard ID"]) {
                    initialRow["Hazard ID"] = `HIRA-0${randomNum}`;
                    initialRow["Status"] = "Active Control";
                }
                // Fire Safety
                if (keyLower.includes("fire") && !initialRow["Equipment ID"]) {
                    initialRow["Equipment ID"] = `EXT-0${randomNum}`;
                    initialRow["Inspection Date"] = todayStr;
                    initialRow["Status"] = "● Operational";
                }
                // Environmental
                if ((keyLower.includes("environmental") || keyLower.includes("environment")) && !initialRow["Log ID"]) {
                    initialRow["Log ID"] = `ENV-0${randomNum}`;
                    initialRow["Compliance Status"] = "✓ Compliant";
                }
                // Employee Safety
                if (keyLower.includes("employee_safety") && !initialRow["Safety ID"]) {
                    initialRow["Safety ID"] = `EMP-SAF-0${randomNum}`;
                    initialRow["Date"] = todayStr;
                }
                // Employee Master
                if ((keyLower.includes("employee_master") || (keyLower.includes("employee") && !keyLower.includes("safety"))) && !initialRow["Employee ID"]) {
                    initialRow["Employee ID"] = `EMP-0${randomNum}`;
                }
                // Audit Logs
                if (keyLower.includes("audit") && !initialRow["Log ID"]) {
                    initialRow["Log ID"] = `AUD-0${randomNum}`;
                    initialRow["Timestamp"] = new Date().toLocaleString();
                }
            }

            setRow(initialRow);
        }
    }, [rowId, editor?.isNew]);

    const getRowVal = (keys: string[]): string => {
        for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
                return String(row[k]);
            }
        }
        return "";
    };

    const handleChange = (col: string, val: string) => {
        const updated = { ...row, [col]: val };

        // Synchronize machine selection across Asset ID & Machine Name
        if (col === "Asset ID" || col === "assetId") {
            updated["assetId"] = val;
            updated["Asset ID"] = val;
            const match = machinesList.find((m) => m.assetId === val);
            if (match) {
                updated["Name"] = match.name;
                updated["machineName"] = match.name;
                updated["Machine Name"] = match.name;
            }
        }

        if (col === "Machine Name" || col === "machineName") {
            updated["machineName"] = val;
            updated["Machine Name"] = val;
            const match = machinesList.find((m) => m.name === val);
            if (match) {
                updated["Asset ID"] = match.assetId;
                updated["assetId"] = match.assetId;
            }
        }

        // Synchronize User ID & User Name
        if (col === "User ID") {
            const match = usersList.find((u) => u.userId === val);
            if (match) {
                updated["Name"] = match.name;
                updated["User Name"] = match.name;
                updated["submittedBy"] = match.name;
            }
        }

        if (isUserMaster && col === "Name" && editor.isNew) {
            const cleanName = val.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
            if (cleanName && (!updated["Login Email"] || updated["Login Email"].includes("@gmail.com"))) {
                updated["Login Email"] = `${cleanName}@gmail.com`;
            }
        }

        setRow(updated);
    };

    const generateRandomPassword = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let pass = "";
        for (let i = 0; i < 10; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        handleChange("Password", pass);
    };

    const handleCopyPassword = () => {
        const pass = getRowVal(["Password"]);
        if (pass) {
            navigator.clipboard.writeText(pass);
            setCopiedPass(true);
            setTimeout(() => setCopiedPass(false), 2000);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave?.(row);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">

                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/90 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-[#faf1f2] text-[#880b13] flex items-center justify-center font-bold text-lg border border-[#880b13]/10">
                            {editor.isNew ? "➕" : "✏️"}
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-900">
                                {editor.isNew ? `Add New ${singularName}` : `Edit ${singularName}`}
                            </h2>
                            <p className="text-xs font-semibold text-slate-500">
                                Fill in details below and click save to submit changes.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">

                    {/* 1. USER & ROLE MASTER */}
                    {isUserMaster && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">User ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["User ID", "userId"])}
                                        onChange={(e) => handleChange("User ID", e.target.value)}
                                        placeholder="e.g. USR-001, OP-001"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Name", "userName"])}
                                        onChange={(e) => handleChange("Name", e.target.value)}
                                        placeholder="User Full Name"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Login Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={getRowVal(["Login Email", "email"])}
                                    onChange={(e) => handleChange("Login Email", e.target.value)}
                                    placeholder="user@skyline.com"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>

                            {/* Password Box */}
                            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-purple-950">Password Provisioning</label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleChange("Password", "1234")}
                                            className="rounded-lg bg-purple-100 hover:bg-purple-200 border border-purple-300 px-2.5 py-1 text-[11px] font-bold text-purple-900 transition-colors"
                                        >
                                            ⚡ Set 1234
                                        </button>
                                        <button
                                            type="button"
                                            onClick={generateRandomPassword}
                                            className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 text-[11px] font-bold transition-colors"
                                        >
                                            🔑 Generate
                                        </button>
                                    </div>
                                </div>
                                <div className="relative flex items-center">
                                    <input
                                        type={showPass ? "text" : "password"}
                                        value={getRowVal(["Password"])}
                                        onChange={(e) => handleChange("Password", e.target.value)}
                                        placeholder="Enter password..."
                                        className="w-full rounded-xl border border-purple-300 bg-white pl-3 pr-20 py-2 text-xs font-mono font-bold text-purple-950 focus:border-purple-600 focus:outline-hidden"
                                    />
                                    <div className="absolute right-2 flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowPass(!showPass)}
                                            className="p-1 text-slate-400 hover:text-slate-700 text-xs"
                                        >
                                            {showPass ? "🙈" : "👁️"}
                                        </button>
                                        {getRowVal(["Password"]) && (
                                            <button
                                                type="button"
                                                onClick={handleCopyPassword}
                                                className="p-1 text-purple-700 hover:text-purple-900 text-xs font-bold"
                                            >
                                                {copiedPass ? "✓" : "📋"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Role / App Access</label>
                                    <select
                                        value={getRowVal(["Role", "App Access"]) || "Operator"}
                                        onChange={(e) => {
                                            handleChange("Role", e.target.value);
                                            handleChange("App Access", e.target.value);
                                        }}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Admin">👑 Admin</option>
                                        <option value="Supervisor">🛡 Supervisor</option>
                                        <option value="Operator">👤 Operator / Technician</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Active Status</label>
                                    <select
                                        value={getRowVal(["Active"]) || "Yes"}
                                        onChange={(e) => handleChange("Active", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Yes">● Active</option>
                                        <option value="No">○ Inactive</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. MACHINE MASTER */}
                    {isMachineMaster && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Asset ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Asset ID", "assetId"])}
                                        onChange={(e) => handleChange("Asset ID", e.target.value)}
                                        placeholder="e.g. LSR-001, BND-002"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Machine Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Machine Name", "machineName", "Name"])}
                                        onChange={(e) => {
                                            handleChange("Machine Name", e.target.value);
                                            handleChange("Name", e.target.value);
                                            handleChange("machineName", e.target.value);
                                        }}
                                        placeholder="Machine Name / Model"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Category / Type</label>
                                    <select
                                        value={getRowVal(["Category", "Type"]) || "Laser Cutting"}
                                        onChange={(e) => handleChange("Category", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Laser Cutting">Laser Cutting</option>
                                        <option value="Turret Punch">Turret Punch</option>
                                        <option value="CNC Shearing Machine">CNC Shearing Machine</option>
                                        <option value="Bending Machine">Bending Machine</option>
                                        <option value="Air Compressor">Air Compressor</option>
                                        <option value="EOT Crane">EOT Crane</option>
                                        <option value="CO2 Welding Machine">CO2 Welding Machine</option>
                                        <option value="Drill Machine">Drill Machine</option>
                                        <option value="Powder Coating Oven">Powder Coating Oven</option>
                                        <option value="UPS">UPS</option>
                                        <option value="Stabilizer">Stabilizer</option>
                                        <option value="Electrical Panel">Electrical Panel</option>
                                        <option value="Pneumatic Machine">Pneumatic Machine</option>
                                        <option value="Powder Spray Booth">Powder Spray Booth</option>
                                        <option value="Powder Spray Gun">Powder Spray Gun</option>
                                        <option value="Grinder Machine">Grinder Machine</option>
                                        <option value="General Equipment">General Equipment</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Location / Bay</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Location", "Bay"])}
                                        onChange={(e) => handleChange("Location", e.target.value)}
                                        placeholder="e.g. Shopfloor Bay A1"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">PM Frequency</label>
                                    <select
                                        value={getRowVal(["PM Frequency", "Frequency"]) || "Daily"}
                                        onChange={(e) => handleChange("PM Frequency", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Quarterly">Quarterly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Responsible Person</label>
                                    <select
                                        value={getRowVal(["Responsible Person", "User Name", "userName"])}
                                        onChange={(e) => handleChange("Responsible Person", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="">Select Responsible Person...</option>
                                        {usersList && usersList.length > 0 ? (
                                            usersList.map((u: any, idx: number) => {
                                                const uName = u.name || u.Name || u.userName || u["User ID"] || `User ${idx + 1}`;
                                                return (
                                                    <option key={idx} value={uName}>
                                                        {uName} ({u.role || u.Role || "Personnel"})
                                                    </option>
                                                );
                                            })
                                        ) : (
                                            <>
                                                <option value="Satish Patil">Satish Patil (Admin)</option>
                                                <option value="Rahul Sharma">Rahul Sharma (Supervisor)</option>
                                                <option value="Vijay Shinde">Vijay Shinde (Maintenance)</option>
                                                <option value="Plant Supervisor">Plant Supervisor</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={getRowVal(["Status"]) || "Active"}
                                        onChange={(e) => handleChange("Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Active">● Active</option>
                                        <option value="Under Maintenance">⚠️ Under Maintenance</option>
                                        <option value="Offline">○ Offline</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. CHECKLIST MASTER */}
                    {isChecklistMaster && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Template ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Template ID", "templateId"])}
                                        onChange={(e) => handleChange("Template ID", e.target.value)}
                                        placeholder="e.g. LSR-001, CHK-163"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Category / Equipment</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Category"])}
                                        onChange={(e) => handleChange("Category", e.target.value)}
                                        placeholder="e.g. Laser Cutting, Turret Punch"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Check Point / Inspection Task *</label>
                                <input
                                    type="text"
                                    required
                                    value={getRowVal(["Check Point", "checkPoint"])}
                                    onChange={(e) => handleChange("Check Point", e.target.value)}
                                    placeholder="e.g. Emergency Stop Switch functionality"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Standard / Quality Requirement *</label>
                                <textarea
                                    rows={2}
                                    required
                                    value={getRowVal(["Standard / Requirement", "standard"])}
                                    onChange={(e) => handleChange("Standard / Requirement", e.target.value)}
                                    placeholder="Specify operating parameters or standard..."
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Frequency</label>
                                    <select
                                        value={getRowVal(["Frequency"]) || "Daily"}
                                        onChange={(e) => handleChange("Frequency", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">IF Not OK Action</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["IF Not ok Action", "actionIfNotOk"])}
                                        onChange={(e) => handleChange("IF Not ok Action", e.target.value)}
                                        placeholder="Action if checkpoint fails"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Active</label>
                                    <select
                                        value={getRowVal(["Active"]) || "Yes"}
                                        onChange={(e) => handleChange("Active", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Yes">● Yes</option>
                                        <option value="No">○ No</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. MAINTENANCE RECORDS */}
                    {isMaintenanceView && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Maintenance ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["recordId", "Maintenance ID", "Record ID"])}
                                        onChange={(e) => handleChange("Maintenance ID", e.target.value)}
                                        placeholder="e.g. MNT-001"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-[#880b13] focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Date", "date"])}
                                        onChange={(e) => handleChange("Date", e.target.value)}
                                        placeholder="YYYY-MM-DD"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Asset ID *</label>
                                    <select
                                        value={getRowVal(["Asset ID", "assetId"])}
                                        onChange={(e) => handleChange("Asset ID", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="">Select Asset...</option>
                                        {machinesList.map((m) => (
                                            <option key={m.assetId} value={m.assetId}>
                                                {m.assetId} - {m.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Machine Name</label>
                                <input
                                    type="text"
                                    value={getRowVal(["Machine Name", "machineName"])}
                                    onChange={(e) => handleChange("Machine Name", e.target.value)}
                                    placeholder="Machine Name"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Issue / Breakdown Description *</label>
                                <textarea
                                    rows={2}
                                    required
                                    value={getRowVal(["Issue", "Description", "observation"])}
                                    onChange={(e) => handleChange("Issue", e.target.value)}
                                    placeholder="Describe maintenance breakdown or issue..."
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Action Taken</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Action Taken", "actionTaken"])}
                                        onChange={(e) => handleChange("Action Taken", e.target.value)}
                                        placeholder="Work performed..."
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Technician / Submitted By</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Submitted By", "submittedBy", "Technician"])}
                                        onChange={(e) => handleChange("Submitted By", e.target.value)}
                                        placeholder="Technician Name"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={getRowVal(["Status"]) || "Open"}
                                        onChange={(e) => handleChange("Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Open">● Open</option>
                                        <option value="In Progress">⚡ In Progress</option>
                                        <option value="Resolved">✓ Resolved</option>
                                        <option value="Closed">🔒 Closed</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. SAFETY RECORDS */}
                    {isSafetyView && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Safety Record ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["recordId", "Safety Record ID", "Record ID"])}
                                        onChange={(e) => handleChange("recordId", e.target.value)}
                                        placeholder="e.g. SAF-001"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-[#880b13] focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Inspection Date *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Date", "date"])}
                                        onChange={(e) => handleChange("Date", e.target.value)}
                                        placeholder="YYYY-MM-DD"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Asset ID *</label>
                                    <select
                                        value={getRowVal(["Asset ID", "assetId"])}
                                        onChange={(e) => handleChange("Asset ID", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="">Select Asset...</option>
                                        {machinesList.map((m) => (
                                            <option key={m.assetId} value={m.assetId}>
                                                {m.assetId} - {m.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Inspection Type</label>
                                    <select
                                        value={getRowVal(["Safety Type", "safetyType", "Inspection Type"]) || "EHS Inspection"}
                                        onChange={(e) => handleChange("safetyType", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="EHS Inspection">🛡️ EHS Inspection</option>
                                        <option value="Interlock & Sensor Inspection">🔒 Interlock &amp; Sensor Inspection</option>
                                        <option value="Emergency Stop Test">🚨 Emergency Stop Test</option>
                                        <option value="PPE & Guarding Audit">🥽 PPE &amp; Guarding Audit</option>
                                        <option value="Hydraulic Safety Check">⚙️ Hydraulic Safety Check</option>
                                        <option value="Electrical Grounding Check">⚡ Electrical Grounding Check</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Risk Level</label>
                                    <select
                                        value={getRowVal(["Risk Level", "riskLevel"]) || "Medium"}
                                        onChange={(e) => handleChange("riskLevel", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="High">🚨 High Risk</option>
                                        <option value="Medium">⚠️ Medium Risk</option>
                                        <option value="Low">✓ Low Risk</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Observation / Issue Finding *</label>
                                <textarea
                                    rows={2}
                                    required
                                    value={getRowVal(["Observation", "observation"])}
                                    onChange={(e) => handleChange("observation", e.target.value)}
                                    placeholder="Describe EHS observation or safety risk..."
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Inspector / Submitted By</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Inspector", "inspector", "Submitted By"])}
                                        onChange={(e) => handleChange("inspector", e.target.value)}
                                        placeholder="Inspector Name"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={getRowVal(["Status"]) || "Open"}
                                        onChange={(e) => handleChange("Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Open">● Open</option>
                                        <option value="Resolved">⚡ Resolved</option>
                                        <option value="Closed">✓ Closed</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 6. PM PARTS & AMC */}
                    {isPartsView && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Part / AMC ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Part / AMC ID", "partId", "Part ID"])}
                                        onChange={(e) => handleChange("Part / AMC ID", e.target.value)}
                                        placeholder="e.g. PRT-001, AMC-002"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-[#880b13] focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Part Name / AMC Title *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Part Name", "Title", "Name"])}
                                        onChange={(e) => handleChange("Part Name", e.target.value)}
                                        placeholder="Part or AMC Service Name"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Machine / Asset</label>
                                    <select
                                        value={getRowVal(["Asset ID", "assetId"])}
                                        onChange={(e) => handleChange("Asset ID", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="">Select Asset...</option>
                                        {machinesList.map((m) => (
                                            <option key={m.assetId} value={m.assetId}>
                                                {m.assetId} - {m.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Vendor</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Supplier", "Vendor"])}
                                        onChange={(e) => handleChange("Supplier", e.target.value)}
                                        placeholder="Vendor / Manufacturer"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Stock Quantity</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Stock Quantity", "Quantity"])}
                                        onChange={(e) => handleChange("Stock Quantity", e.target.value)}
                                        placeholder="e.g. 5 Units"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={getRowVal(["Status"]) || "In Stock"}
                                        onChange={(e) => handleChange("Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="In Stock">● In Stock</option>
                                        <option value="Reorder Required">⚠️ Reorder Required</option>
                                        <option value="Active AMC">⚡ Active AMC</option>
                                        <option value="Expired AMC">○ Expired AMC</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 7. DOCUMENT REGISTER */}
                    {isDocumentView && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Document ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Document ID", "docId"])}
                                        onChange={(e) => handleChange("Document ID", e.target.value)}
                                        placeholder="e.g. DOC-001"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-[#880b13] focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Document Title *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Document Title", "Title"])}
                                        onChange={(e) => handleChange("Document Title", e.target.value)}
                                        placeholder="Document Title"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                                    <select
                                        value={getRowVal(["Category"]) || "SOP"}
                                        onChange={(e) => handleChange("Category", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="SOP">SOP Manual</option>
                                        <option value="Safety Protocol">Safety Protocol</option>
                                        <option value="Machine Schematic">Machine Schematic</option>
                                        <option value="Audit Certificate">Audit Certificate</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Version</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Version"])}
                                        onChange={(e) => handleChange("Version", e.target.value)}
                                        placeholder="v1.0"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={getRowVal(["Status"]) || "Active"}
                                        onChange={(e) => handleChange("Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Active">● Active</option>
                                        <option value="Archived">○ Archived</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 8. NOTIFICATIONS & ALERTS */}
                    {isNotificationsView && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Alert ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Alert ID", "alertId"])}
                                        onChange={(e) => handleChange("Alert ID", e.target.value)}
                                        placeholder="e.g. ALT-001"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-[#880b13] focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Alert Title / Topic *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Alert Title", "Title"])}
                                        onChange={(e) => handleChange("Alert Title", e.target.value)}
                                        placeholder="Alert Title"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Severity</label>
                                    <select
                                        value={getRowVal(["Severity"]) || "Warning"}
                                        onChange={(e) => handleChange("Severity", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Critical">🚨 Critical</option>
                                        <option value="Warning">⚠️ Warning</option>
                                        <option value="Info">ℹ️ Info</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Source / Machine</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Source", "Machine"])}
                                        onChange={(e) => handleChange("Source", e.target.value)}
                                        placeholder="System / Machine ID"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={getRowVal(["Status"]) || "Active"}
                                        onChange={(e) => handleChange("Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Active">● Active</option>
                                        <option value="Acknowledged">⚡ Acknowledged</option>
                                        <option value="Resolved">✓ Resolved</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 9. MONTHLY COMPLIANCE */}
                    {isComplianceView && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Compliance ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Compliance ID"])}
                                        onChange={(e) => handleChange("Compliance ID", e.target.value)}
                                        placeholder="e.g. CMP-001"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-[#880b13] focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Month & Year *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Month"])}
                                        onChange={(e) => handleChange("Month", e.target.value)}
                                        placeholder="e.g. October 2026"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Department"])}
                                        onChange={(e) => handleChange("Department", e.target.value)}
                                        placeholder="e.g. EHS & Safety"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Compliance %</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Compliance %"])}
                                        onChange={(e) => handleChange("Compliance %", e.target.value)}
                                        placeholder="e.g. 98%"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-emerald-800 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Audit Status</label>
                                    <select
                                        value={getRowVal(["Audit Status", "Status"]) || "Compliant"}
                                        onChange={(e) => handleChange("Audit Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Compliant">✓ Compliant</option>
                                        <option value="Action Required">⚠️ Action Required</option>
                                        <option value="Pending Audit">○ Pending Audit</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 10. BREAKDOWNS & REPAIRS */}
                    {isBreakdownView && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Breakdown Ticket *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Breakdown Ticket", "recordId", "id"])}
                                        onChange={(e) => handleChange("Breakdown Ticket", e.target.value)}
                                        placeholder="e.g. BD-2026001"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-[#880b13] focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Machine Asset *</label>
                                    <select
                                        value={getRowVal(["Machine Asset", "Asset ID", "assetId"])}
                                        onChange={(e) => handleChange("Machine Asset", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="">Select Asset...</option>
                                        {machinesList.map((m) => (
                                            <option key={m.assetId} value={m.assetId}>
                                                {m.assetId} - {m.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Reported Date *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Reported Date", "Date"])}
                                        onChange={(e) => handleChange("Reported Date", e.target.value)}
                                        placeholder="YYYY-MM-DD"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Breakdown Issue *</label>
                                <textarea
                                    rows={2}
                                    required
                                    value={getRowVal(["Breakdown Issue", "Issue"])}
                                    onChange={(e) => handleChange("Breakdown Issue", e.target.value)}
                                    placeholder="Describe breakdown issue..."
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Root Cause</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Root Cause"])}
                                        onChange={(e) => handleChange("Root Cause", e.target.value)}
                                        placeholder="Identified root cause..."
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Downtime (Hours)</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Downtime (Hours)", "Downtime"])}
                                        onChange={(e) => handleChange("Downtime (Hours)", e.target.value)}
                                        placeholder="e.g. 1.5"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Resolved Date</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Resolved Date"])}
                                        onChange={(e) => handleChange("Resolved Date", e.target.value)}
                                        placeholder="YYYY-MM-DD"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={getRowVal(["Status"]) || "Open"}
                                        onChange={(e) => handleChange("Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Open">● Open</option>
                                        <option value="In Progress">⚡ In Progress</option>
                                        <option value="Resolved & Verified">✓ Resolved &amp; Verified</option>
                                        <option value="Closed">🔒 Closed</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 11. TRAINING RECORDS */}
                    {isTrainingView && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Training ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Training ID", "trainingId"])}
                                        onChange={(e) => handleChange("Training ID", e.target.value)}
                                        placeholder="e.g. TRN-001"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-[#880b13] focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Course Title *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Course Title", "courseTitle"])}
                                        onChange={(e) => handleChange("Course Title", e.target.value)}
                                        placeholder="e.g. EHS Safety & PPE Protocols"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Trainer / Faculty</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Trainer / Faculty", "trainer"])}
                                        onChange={(e) => handleChange("Trainer / Faculty", e.target.value)}
                                        placeholder="e.g. Safety Dept / OEM"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Category</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Target Category"])}
                                        onChange={(e) => handleChange("Target Category", e.target.value)}
                                        placeholder="e.g. Maintenance Crew / All Operators"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Attendees (Count)</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Attendees", "attendees"])}
                                        onChange={(e) => handleChange("Attendees", e.target.value)}
                                        placeholder="e.g. 28"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Completion Date</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Completion Date", "completionDate"])}
                                        onChange={(e) => handleChange("Completion Date", e.target.value)}
                                        placeholder="YYYY-MM-DD"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={getRowVal(["Status"]) || "Completed"}
                                        onChange={(e) => handleChange("Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Planned">○ Planned</option>
                                        <option value="In Progress">⚡ In Progress</option>
                                        <option value="Completed">✓ Completed</option>
                                        <option value="Cancelled">✕ Cancelled</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 12. HIRA — HAZARD ID & RISK ASSESSMENT */}
                    {isHiraView && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Hazard ID *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Hazard ID", "hazardId"])}
                                        onChange={(e) => handleChange("Hazard ID", e.target.value)}
                                        placeholder="e.g. HIRA-001"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-[#880b13] focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Process / Activity *</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(["Process / Activity", "processActivity"])}
                                        onChange={(e) => handleChange("Process / Activity", e.target.value)}
                                        placeholder="e.g. Laser Cutting Operation"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Identified Hazard *</label>
                                <textarea
                                    rows={2}
                                    required
                                    value={getRowVal(["Identified Hazard", "hazard"])}
                                    onChange={(e) => handleChange("Identified Hazard", e.target.value)}
                                    placeholder="Describe the identified hazard..."
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Risk Level</label>
                                    <select
                                        value={getRowVal(["Risk Level", "riskLevel"]) || "Medium Risk"}
                                        onChange={(e) => handleChange("Risk Level", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Critical Risk">🔴 Critical Risk</option>
                                        <option value="High Risk">🟠 High Risk</option>
                                        <option value="Medium Risk">🟡 Medium Risk</option>
                                        <option value="Low Risk">🟢 Low Risk</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={getRowVal(["Status"]) || "Active Control"}
                                        onChange={(e) => handleChange("Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Active Control">✓ Active Control</option>
                                        <option value="Under Review">⚡ Under Review</option>
                                        <option value="Mitigated">✅ Mitigated</option>
                                        <option value="Residual Risk">⚠️ Residual Risk</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Control Measures</label>
                                <textarea
                                    rows={2}
                                    value={getRowVal(["Control Measures", "controlMeasures"])}
                                    onChange={(e) => handleChange("Control Measures", e.target.value)}
                                    placeholder="e.g. Laser Interlock Enclosure & Safety Goggles..."
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>
                        </div>
                    )}

                    {/* 13. UNIVERSAL DYNAMIC FORM BUILDER FOR ANY TAB / NEW PAGE */}
                    {(!isUserMaster && !isMachineMaster && !isChecklistMaster && !isBreakdownView && !isMaintenanceView && !isSafetyView && !isPartsView && !isDocumentView && !isNotificationsView && !isComplianceView && !isTrainingView && !isHiraView) && (
                        <div className="space-y-4">
                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs font-semibold text-slate-600">
                                📝 Enter details for <span className="font-bold text-slate-900">{singularName}</span>:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {(columns && columns.length > 0
                                    ? columns
                                    : Object.keys(row).length > 0
                                        ? Object.keys(row)
                                        : ["Record ID", "Title / Name", "Category", "Description", "Status", "Date"]
                                )
                                    .filter((c) => c !== "__row" && c !== "__id" && c !== "actions" && c !== "id" && c !== "_id")
                                    .map((colName) => {
                                        const val = getRowVal([colName]);
                                        const lowerCol = colName.toLowerCase();

                                        if (lowerCol.includes("status")) {
                                            return (
                                                <div key={colName}>
                                                    <label className="block text-xs font-bold text-slate-700 mb-1">{colName}</label>
                                                    <select
                                                        value={val || "Active"}
                                                        onChange={(e) => handleChange(colName, e.target.value)}
                                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                                    >
                                                        <option value="Active">● Active</option>
                                                        <option value="Open">● Open</option>
                                                        <option value="In Progress">⚡ In Progress</option>
                                                        <option value="Resolved">✓ Resolved</option>
                                                        <option value="Closed">🔒 Closed</option>
                                                        <option value="Completed">✓ Completed</option>
                                                        <option value="Pending">○ Pending</option>
                                                    </select>
                                                </div>
                                            );
                                        }

                                        if (lowerCol.includes("machine") || lowerCol.includes("asset")) {
                                            return (
                                                <div key={colName}>
                                                    <label className="block text-xs font-bold text-slate-700 mb-1">{colName}</label>
                                                    <select
                                                        value={val}
                                                        onChange={(e) => handleChange(colName, e.target.value)}
                                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                                    >
                                                        <option value="">Select Asset...</option>
                                                        {machinesList.map((m) => (
                                                            <option key={m.assetId} value={m.assetId}>
                                                                {m.assetId} - {m.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        }

                                        if (lowerCol.includes("person") || lowerCol.includes("user") || lowerCol.includes("technician") || lowerCol.includes("submitted") || lowerCol.includes("assigned")) {
                                            return (
                                                <div key={colName}>
                                                    <label className="block text-xs font-bold text-slate-700 mb-1">{colName}</label>
                                                    <select
                                                        value={val}
                                                        onChange={(e) => handleChange(colName, e.target.value)}
                                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                                    >
                                                        <option value="">Select Personnel...</option>
                                                        {usersList && usersList.length > 0 ? (
                                                            usersList.map((u: any, idx: number) => {
                                                                const uName = u.name || u.Name || u.userName || u["User ID"] || `User ${idx + 1}`;
                                                                return (
                                                                    <option key={idx} value={uName}>
                                                                        {uName} ({u.role || u.Role || "Personnel"})
                                                                    </option>
                                                                );
                                                            })
                                                        ) : (
                                                            <>
                                                                <option value="Satish Patil">Satish Patil (Admin)</option>
                                                                <option value="Rahul Sharma">Rahul Sharma (Supervisor)</option>
                                                                <option value="Vijay Shinde">Vijay Shinde (Maintenance)</option>
                                                            </>
                                                        )}
                                                    </select>
                                                </div>
                                            );
                                        }

                                        if (lowerCol.includes("desc") || lowerCol.includes("cause") || lowerCol.includes("remark") || lowerCol.includes("observation")) {
                                            return (
                                                <div key={colName} className="sm:col-span-2">
                                                    <label className="block text-xs font-bold text-slate-700 mb-1">{colName}</label>
                                                    <textarea
                                                        rows={2}
                                                        value={val}
                                                        onChange={(e) => handleChange(colName, e.target.value)}
                                                        placeholder={`Enter ${colName}...`}
                                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                                    />
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={colName}>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">{colName}</label>
                                                <input
                                                    type="text"
                                                    value={val}
                                                    onChange={(e) => handleChange(colName, e.target.value)}
                                                    placeholder={`Enter ${colName}...`}
                                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                                />
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Modal Footer Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={photoUploading}
                            className="rounded-xl bg-[#880b13] hover:bg-[#72070e] text-white px-6 py-2.5 text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <span>{editor.isNew ? "➕ Save Record" : "💾 Save Changes"}</span>
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
