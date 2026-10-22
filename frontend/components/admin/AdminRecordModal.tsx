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

    // Machine Assignment State (User Master)
    const [selectedMachineToAssign, setSelectedMachineToAssign] = useState("");

    // User Assignment State (Machine Master)
    const [selectedUserToAssign, setSelectedUserToAssign] = useState("");

    const getAssignedMachines = (): string[] => {
        if (Array.isArray((row as any).assignedMachines) && (row as any).assignedMachines.length > 0) {
            return (row as any).assignedMachines;
        }
        const raw = row["Assigned Machines"] || (row as any).assignedMachines;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
    };

    const handleAddMachineAssignment = (assetId: string) => {
        if (!assetId) return;
        const current = getAssignedMachines();
        if (current.some((id) => id.toUpperCase() === assetId.toUpperCase())) {
            alert(`Machine "${assetId}" is already assigned to this user.`);
            return;
        }
        const updated = [...current, assetId];
        setRow((prev) => ({
            ...prev,
            assignedMachines: updated as any,
            "Assigned Machines": updated.join(", "),
        }));
        setSelectedMachineToAssign("");
    };

    const handleRemoveMachineAssignment = (assetId: string) => {
        const match = machinesList.find((m) => (m.assetId || m["Asset ID"] || "").toUpperCase() === assetId.toUpperCase());
        const mName = match ? (match.name || match["Machine Name"]) : assetId;
        if (!window.confirm(`Are you sure you want to remove assignment for "${assetId} — ${mName}"? Historical maintenance and checklist records will remain intact.`)) {
            return;
        }
        const updated = getAssignedMachines().filter((id) => id.toUpperCase() !== assetId.toUpperCase());
        setRow((prev) => ({
            ...prev,
            assignedMachines: updated as any,
            "Assigned Machines": updated.join(", "),
        }));
    };

    const getAssignedUsers = (): string[] => {
        if (Array.isArray((row as any).assignedUsers) && (row as any).assignedUsers.length > 0) {
            return (row as any).assignedUsers;
        }
        const raw = row["Assigned Users"] || (row as any).assignedUsers;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
    };

    const handleAddUserAssignment = (userId: string) => {
        if (!userId) return;
        const current = getAssignedUsers();
        if (current.some((id) => id.toUpperCase() === userId.toUpperCase())) {
            alert(`User "${userId}" is already assigned to this machine.`);
            return;
        }
        const updated = [...current, userId];
        setRow((prev) => ({
            ...prev,
            assignedUsers: updated as any,
            "Assigned Users": updated.join(", "),
        }));
        setSelectedUserToAssign("");
    };

    const handleRemoveUserAssignment = (userId: string) => {
        const match = usersList.find((u) => (u.userId || u["User ID"] || "").toUpperCase() === userId.toUpperCase());
        const uName = match ? (match.name || match.Name) : userId;
        if (!window.confirm(`Are you sure you want to remove user "${uName} (${userId})" from this machine? Historical records will remain intact.`)) {
            return;
        }
        const updated = getAssignedUsers().filter((id) => id.toUpperCase() !== userId.toUpperCase());
        setRow((prev) => ({
            ...prev,
            assignedUsers: updated as any,
            "Assigned Users": updated.join(", "),
        }));
    };

    const keyLower = (activeViewKey || activeView || "").toLowerCase().trim();
    const isUserMaster = keyLower.includes("user");
    const isAssetMaster = keyLower === "assets" || (keyLower.includes("asset") && !keyLower.includes("machine"));
    const isMachineMaster = keyLower === "machines" || (keyLower.includes("machine") && !keyLower.includes("asset"));
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
                if (isAssetMaster && !initialRow["Asset ID"]) initialRow["Asset ID"] = `AST-0${randomNum}`;
                if (isMachineMaster && !initialRow["Asset ID"]) initialRow["Asset ID"] = `MAC-0${randomNum}`;
                if (isChecklistMaster && !initialRow["Template ID"]) initialRow["Template ID"] = `CHK-${randomNum}`;
                if (isMaintenanceView && !initialRow["recordId"] && !initialRow["Maintenance ID"]) {
                    initialRow["recordId"] = `MNT-0${randomNum}`;
                    initialRow["Maintenance ID"] = `MNT-0${randomNum}`;
                    initialRow["Date"] = todayStr;
                    initialRow["date"] = todayStr;
                    initialRow["Status"] = "Open";
                    initialRow["status"] = "Open";
                    initialRow["Priority"] = "Medium";
                    initialRow["priority"] = "Medium";
                    initialRow["Checklist ID"] = "MNT-GENERAL";
                    initialRow["checklistId"] = "MNT-GENERAL";
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
        setRow((prev) => {
            const updated = { ...prev, [col]: val };

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

            if (col === "Machine Name" || col === "machineName" || col === "Name" || col === "Asset Name") {
                updated["machineName"] = val;
                updated["Machine Name"] = val;
                updated["Name"] = val;
                const match = machinesList.find((m) => m.name === val);
                if (match) {
                    updated["Asset ID"] = match.assetId;
                    updated["assetId"] = match.assetId;
                }
            }

            if (col === "Serial No." || col === "Serial No" || col === "serialNo") {
                updated["Serial No."] = val;
                updated["Serial No"] = val;
                updated["serialNo"] = val;
            }

            // Synchronize User ID & User Name
            if (col === "User ID" || col === "userId") {
                updated["userId"] = val;
                updated["User ID"] = val;
                const match = usersList.find((u) => u.userId === val);
                if (match) {
                    updated["Name"] = match.name;
                    updated["User Name"] = match.name;
                    updated["userName"] = match.name;
                    updated["submittedBy"] = match.name;
                    updated["Submitted By"] = match.name;
                }
            }
            if (col === "User Name" || col === "userName") {
                updated["User Name"] = val;
                updated["userName"] = val;
                updated["submittedBy"] = val;
                updated["Submitted By"] = val;
                const match = usersList.find((u) => u.name === val);
                if (match && match.userId) {
                    updated["User ID"] = match.userId;
                    updated["userId"] = match.userId;
                }
            }

            // Maintenance view field synchronization
            if (col === "Maintenance ID" || col === "recordId" || col === "Record ID") {
                updated["Maintenance ID"] = val;
                updated["recordId"] = val;
                updated["Record ID"] = val;
            }
            if (col === "Date" || col === "date") {
                updated["Date"] = val;
                updated["date"] = val;
            }
            if (col === "Checklist ID" || col === "checklistId" || col === "Template ID") {
                updated["Checklist ID"] = val;
                updated["checklistId"] = val;
                updated["Template ID"] = val;
            }
            if (col === "Issue" || col === "problem" || col === "Problem / Request" || col === "Problem") {
                updated["Issue"] = val;
                updated["problem"] = val;
                updated["Problem / Request"] = val;
                updated["Breakdown Issue"] = val;
            }
            if (col === "Assigned To" || col === "assignedTo" || col === "Technician" || col === "technicianName") {
                updated["Assigned To"] = val;
                updated["assignedTo"] = val;
                updated["technicianName"] = val;
                updated["Technician"] = val;
            }
            if (col === "Action Taken" || col === "correctiveAction" || col === "actionTaken" || col === "Corrective Action") {
                updated["Action Taken"] = val;
                updated["correctiveAction"] = val;
                updated["actionTaken"] = val;
                updated["Corrective Action"] = val;
            }
            if (col === "Completion Date" || col === "completionDate") {
                updated["Completion Date"] = val;
                updated["completionDate"] = val;
            }
            if (col === "Submitted By" || col === "submittedBy") {
                updated["Submitted By"] = val;
                updated["submittedBy"] = val;
            }
            if (col === "Status" || col === "status") {
                updated["Status"] = val;
                updated["status"] = val;
            }
            if (col === "Priority" || col === "priority") {
                updated["Priority"] = val;
                updated["priority"] = val;
            }

            if (isUserMaster && col === "Name" && editor.isNew) {
                const cleanName = val.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
                if (cleanName && (!updated["Login Email"] || updated["Login Email"].includes("@gmail.com"))) {
                    updated["Login Email"] = `${cleanName}@gmail.com`;
                }
            }

            return updated;
        });
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

    const isDirty = () => {
        if (editor.isNew) {
            return Object.keys(row).some(
                (k) => k !== "row" && k !== "__row" && k !== "Active" && row[k] && String(row[k]).trim() !== ""
            );
        }
        return JSON.stringify(row) !== JSON.stringify(editor.row);
    };

    const handleCancel = () => {
        if (isDirty()) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to discard them and close?")) {
                return;
            }
        }
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const submissionRow = { ...row };
        if (isMachineMaster) {
            const assetId = String(submissionRow["Asset ID"] || submissionRow["assetId"] || "").trim();
            const machineName = String(submissionRow["Machine Name"] || submissionRow["machineName"] || submissionRow["Name"] || "").trim();
            if (!machineName) {
                alert("Please enter a Machine Name.");
                return;
            }
            submissionRow["Machine Name"] = machineName;
            submissionRow["machineName"] = machineName;
            submissionRow["Name"] = machineName;
            if (assetId) {
                submissionRow["Asset ID"] = assetId;
                submissionRow["assetId"] = assetId;
                if (!submissionRow["QR Link"]) {
                    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
                    submissionRow["QR Link"] = `${origin}/machine/${encodeURIComponent(assetId)}`;
                }
            }
            const serial = String(submissionRow["Serial No."] || submissionRow["Serial No"] || submissionRow["serialNo"] || "").trim();
            if (serial) {
                submissionRow["Serial No."] = serial;
                submissionRow["Serial No"] = serial;
            }
        }
        if (isAssetMaster) {
            const assetId = String(submissionRow["Asset ID"] || submissionRow["assetId"] || "").trim();
            const assetName = String(submissionRow["Asset Name"] || submissionRow["Machine Name"] || submissionRow["assetName"] || submissionRow["machineName"] || submissionRow["Name"] || "").trim();
            if (!assetName) {
                alert("Please enter an Asset Name.");
                return;
            }
            submissionRow["Asset Name"] = assetName;
            submissionRow["Machine Name"] = assetName;
            submissionRow["Name"] = assetName;
            if (assetId) {
                submissionRow["Asset ID"] = assetId;
                submissionRow["assetId"] = assetId;
                if (!submissionRow["QR Link"]) {
                    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
                    submissionRow["QR Link"] = `${origin}/machine/${encodeURIComponent(assetId)}`;
                }
            }
            const serial = String(submissionRow["Serial No."] || submissionRow["Serial No"] || submissionRow["serialNo"] || "").trim();
            if (serial) {
                submissionRow["Serial No."] = serial;
                submissionRow["Serial No"] = serial;
            }
        }
        if (isUserMaster) {
            const assignedM = getAssignedMachines();
            submissionRow["Assigned Machines"] = assignedM.join(", ");
            submissionRow.assignedMachines = assignedM as any;
        }
        if (isMachineMaster || isAssetMaster) {
            const assignedU = getAssignedUsers();
            submissionRow["Assigned Users"] = assignedU.join(", ");
            submissionRow.assignedUsers = assignedU as any;
        }
        onSave?.(submissionRow);
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
                        onClick={handleCancel}
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

                            {/* Assigned Machines Section (Connected with Machine Master) */}
                            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">⚙️</span>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900 tracking-tight">Assigned Machines</h4>
                                            <p className="text-[11px] font-medium text-slate-500">
                                                Machines assigned to this user for operational workstations and checklists
                                            </p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                        {getAssignedMachines().length} {getAssignedMachines().length === 1 ? "Machine" : "Machines"}
                                    </span>
                                </div>

                                {/* Current Assigned Machine Chips */}
                                <div className="min-h-[46px] rounded-xl border border-slate-200 bg-white p-2.5 flex flex-wrap gap-2 items-center">
                                    {getAssignedMachines().length === 0 ? (
                                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 py-1 px-1">
                                            <span>ℹ️</span>
                                            <span>No machines assigned yet. Search and select machines below to assign.</span>
                                        </div>
                                    ) : (
                                        getAssignedMachines().map((assetId) => {
                                            const match = machinesList.find(
                                                (m) =>
                                                    (m.assetId || m["Asset ID"] || "").toUpperCase() === assetId.toUpperCase()
                                            );
                                            const machineName = match?.name || match?.["Machine Name"] || assetId;
                                            const dept = match?.department || match?.Department || "";

                                            return (
                                                <div
                                                    key={assetId}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 shadow-2xs hover:border-slate-400 transition-colors"
                                                >
                                                    <span className="font-mono text-[11px] font-black text-[#880b13] bg-white px-1.5 py-0.5 rounded border border-rose-200">
                                                        {assetId}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-800 max-w-[170px] truncate" title={machineName}>
                                                        {machineName}
                                                    </span>
                                                    {dept && (
                                                        <span className="text-[10px] font-medium text-slate-500 hidden sm:inline">
                                                            ({dept})
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveMachineAssignment(assetId)}
                                                        className="text-slate-400 hover:text-red-600 font-black text-xs p-0.5 ml-0.5 rounded hover:bg-red-50 transition-colors"
                                                        title={`Remove assignment for ${assetId}`}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Machine Selector & Search */}
                                {machinesList.length === 0 ? (
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-2">
                                        <span>⚠️</span>
                                        <span>No machines are currently available in Machine Master. Add machines in Machine Master first.</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-1">
                                            <select
                                                value={selectedMachineToAssign}
                                                onChange={(e) => setSelectedMachineToAssign(e.target.value)}
                                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#880b13] focus:outline-hidden"
                                            >
                                                <option value="">-- Search and select machine to assign --</option>
                                                {machinesList
                                                    .filter((m) => {
                                                        const mId = (m.assetId || m["Asset ID"] || "").toUpperCase();
                                                        return !getAssignedMachines().some((a) => a.toUpperCase() === mId);
                                                    })
                                                    .map((m, idx) => {
                                                        const mId = m.assetId || m["Asset ID"] || `MAC-00${idx}`;
                                                        const mName = m.name || m["Machine Name"] || "Machine";
                                                        const mDept = m.department || m.Department || "";
                                                        return (
                                                            <option key={mId} value={mId}>
                                                                {mId} — {mName} {mDept ? `(${mDept})` : ""}
                                                            </option>
                                                        );
                                                    })}
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={!selectedMachineToAssign}
                                            onClick={() => handleAddMachineAssignment(selectedMachineToAssign)}
                                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black shadow-xs transition-colors shrink-0"
                                        >
                                            <span>➕</span>
                                            <span>Assign Machine</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 2. MACHINE MASTER & ASSET MASTER */}
                    {(isMachineMaster || isAssetMaster) && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Asset ID *</label>
                                    <input
                                        type="text"
                                        required
                                        readOnly={!editor.isNew}
                                        value={getRowVal(["Asset ID", "assetId"])}
                                        onChange={(e) => {
                                            handleChange("Asset ID", e.target.value);
                                            if (!row["QR Link"]) {
                                                handleChange("QR Link", `http://localhost:3000/machine/${encodeURIComponent(e.target.value)}`);
                                            }
                                        }}
                                        placeholder={isAssetMaster ? "e.g. AST-001, AST-002" : "e.g. LSR-001, BND-002"}
                                        className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden ${!editor.isNew ? "bg-slate-100 cursor-not-allowed" : ""}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAssetMaster ? "Asset Name *" : "Machine Name *"}</label>
                                    <input
                                        type="text"
                                        required
                                        value={getRowVal(isAssetMaster ? ["Asset Name", "Machine Name", "assetName", "machineName", "Name"] : ["Machine Name", "machineName", "Name", "Asset Name"])}
                                        onChange={(e) => {
                                            if (isAssetMaster) {
                                                handleChange("Asset Name", e.target.value);
                                                handleChange("Machine Name", e.target.value);
                                            } else {
                                                handleChange("Machine Name", e.target.value);
                                            }
                                        }}
                                        placeholder={isAssetMaster ? "Asset Name / Title" : "Machine Name / Model"}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                                    <input
                                        type="text"
                                        list="category-suggestions"
                                        value={getRowVal(["Category", "Type"])}
                                        onChange={(e) => handleChange("Category", e.target.value)}
                                        placeholder="e.g. Laser Cutting, Fabrication"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                    <datalist id="category-suggestions">
                                        <option value="Laser Cutting" />
                                        <option value="Turret Punch" />
                                        <option value="CNC Shearing Machine" />
                                        <option value="Bending Machine" />
                                        <option value="Air Compressor" />
                                        <option value="EOT Crane" />
                                        <option value="CO2 Welding Machine" />
                                        <option value="Drill Machine" />
                                        <option value="Powder Coating Oven" />
                                        <option value="UPS" />
                                        <option value="Stabilizer" />
                                        <option value="Electrical Panel" />
                                        <option value="Pneumatic Machine" />
                                        <option value="Powder Spray Booth" />
                                        <option value="Powder Spray Gun" />
                                        <option value="Grinder Machine" />
                                        <option value="General Equipment" />
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                                    <input
                                        type="text"
                                        list="dept-suggestions"
                                        value={getRowVal(["Department", "department"])}
                                        onChange={(e) => handleChange("Department", e.target.value)}
                                        placeholder="e.g. Production, Maintenance"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                    <datalist id="dept-suggestions">
                                        <option value="Production" />
                                        <option value="Maintenance" />
                                        <option value="Quality" />
                                        <option value="Tooling" />
                                        <option value="Utility" />
                                        <option value="Electrical" />
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Location</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Location", "location", "Bay"])}
                                        onChange={(e) => handleChange("Location", e.target.value)}
                                        placeholder="e.g. Shopfloor Bay A1"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Make / Manufacturer</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Make", "make"])}
                                        onChange={(e) => handleChange("Make", e.target.value)}
                                        placeholder="e.g. Amada, Trumpf, Ermaksan"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Model</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Model", "model"])}
                                        onChange={(e) => handleChange("Model", e.target.value)}
                                        placeholder="e.g. LC-3015, HFE-100"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Serial No.</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["Serial No.", "Serial No", "serialNo"])}
                                        onChange={(e) => handleChange("Serial No.", e.target.value)}
                                        placeholder="e.g. SN-89211-B"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Criticality</label>
                                    <select
                                        value={getRowVal(["Criticality", "criticality"]) || "Normal"}
                                        onChange={(e) => handleChange("Criticality", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Normal">Normal</option>
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
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
                                        value={getRowVal(["Status", "status"]) || "Operational"}
                                        onChange={(e) => handleChange("Status", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Operational">● Operational</option>
                                        <option value="Running">● Running</option>
                                        <option value="Under Maintenance">⚠️ Under Maintenance</option>
                                        <option value="Standby">⏸️ Standby</option>
                                        <option value="Out of Service">🛑 Out of Service</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">PM Frequency</label>
                                    <select
                                        value={getRowVal(["PM Frequency", "pmFrequency", "Frequency"]) || "Daily"}
                                        onChange={(e) => handleChange("PM Frequency", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Quarterly">Quarterly</option>
                                        <option value="Half-Yearly">Half-Yearly</option>
                                        <option value="Yearly">Yearly</option>
                                        <option value="As Required">As Required</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">AMC Vendor</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["AMC Vendor", "amcVendor", "Vendor"])}
                                        onChange={(e) => handleChange("AMC Vendor", e.target.value)}
                                        placeholder="e.g. Ermaksan Engineering, Festo"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">AMC Contact</label>
                                    <input
                                        type="text"
                                        value={getRowVal(["AMC Contact", "amcContact"])}
                                        onChange={(e) => handleChange("AMC Contact", e.target.value)}
                                        placeholder="Phone or contact email"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">AMC Expiry</label>
                                    <input
                                        type="date"
                                        value={getRowVal(["AMC Expiry", "amcExpiry"])}
                                        onChange={(e) => handleChange("AMC Expiry", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Installation Date</label>
                                    <input
                                        type="date"
                                        value={getRowVal(["Installation Date", "installationDate"])}
                                        onChange={(e) => handleChange("Installation Date", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-bold text-slate-700">QR Link</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const aid = getRowVal(["Asset ID", "assetId"]) || "SKY-MC-NEW";
                                            handleChange("QR Link", `http://localhost:3000/machine/${encodeURIComponent(aid)}`);
                                        }}
                                        className="text-[11px] font-bold text-[#880b13] hover:underline"
                                    >
                                        ⚡ Auto-Generate Link
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={
                                        getRowVal(["QR Link", "qrLink"]) ||
                                        (getRowVal(["Asset ID", "assetId"]) ? `http://localhost:3000/machine/${encodeURIComponent(getRowVal(["Asset ID", "assetId"]))}` : "")
                                    }
                                    onChange={(e) => handleChange("QR Link", e.target.value)}
                                    placeholder="http://localhost:3000/machine/[Asset ID]"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono font-medium text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>

                            {/* Assigned Users Section (Connected with User Management) */}
                            <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">👥</span>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900 tracking-tight">Assigned Users & Personnel</h4>
                                            <p className="text-[11px] font-medium text-slate-500">
                                                Personnel authorized to operate, inspect, and service this machine
                                            </p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-200">
                                        {getAssignedUsers().length} {getAssignedUsers().length === 1 ? "User" : "Users"}
                                    </span>
                                </div>

                                {/* Current Assigned User Chips */}
                                <div className="min-h-[46px] rounded-xl border border-slate-200 bg-white p-2.5 flex flex-wrap gap-2 items-center">
                                    {getAssignedUsers().length === 0 ? (
                                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 py-1 px-1">
                                            <span>ℹ️</span>
                                            <span>No users currently assigned to this machine. Select personnel below to assign.</span>
                                        </div>
                                    ) : (
                                        getAssignedUsers().map((userId) => {
                                            const match = usersList.find(
                                                (u) =>
                                                    (u.userId || u["User ID"] || "").toUpperCase() === userId.toUpperCase() ||
                                                    (u.email || u["Login Email"] || "").toLowerCase() === userId.toLowerCase()
                                            );
                                            const userName = match?.name || match?.Name || userId;
                                            const role = match?.role || match?.Role || "Operator";

                                            return (
                                                <div
                                                    key={userId}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 shadow-2xs hover:border-slate-400 transition-colors"
                                                >
                                                    <span className="font-mono text-[11px] font-black text-purple-900 bg-white px-1.5 py-0.5 rounded border border-purple-200">
                                                        {userId}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-800 max-w-[160px] truncate" title={userName}>
                                                        {userName}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${/admin/i.test(role) ? "bg-purple-100 text-purple-800" : /supervisor/i.test(role) ? "bg-indigo-100 text-indigo-800" : "bg-blue-100 text-blue-800"}`}>
                                                        {role}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveUserAssignment(userId)}
                                                        className="text-slate-400 hover:text-red-600 font-black text-xs p-0.5 ml-0.5 rounded hover:bg-red-50 transition-colors"
                                                        title={`Remove user ${userId} from this machine`}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* User Selector */}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            value={selectedUserToAssign}
                                            onChange={(e) => setSelectedUserToAssign(e.target.value)}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#880b13] focus:outline-hidden"
                                        >
                                            <option value="">-- Search and select personnel to assign --</option>
                                            {usersList
                                                .filter((u) => {
                                                    const uId = (u.userId || u["User ID"] || u["Login Email"] || "").toUpperCase();
                                                    return !getAssignedUsers().some((a) => a.toUpperCase() === uId);
                                                })
                                                .map((u, idx) => {
                                                    const uId = u.userId || u["User ID"] || `USR-00${idx}`;
                                                    const uName = u.name || u.Name || "User";
                                                    const uRole = u.role || u.Role || "Operator";
                                                    return (
                                                        <option key={uId} value={uId}>
                                                            {uId} — {uName} ({uRole})
                                                        </option>
                                                    );
                                                })}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!selectedUserToAssign}
                                        onClick={() => handleAddUserAssignment(selectedUserToAssign)}
                                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black shadow-xs transition-colors shrink-0"
                                    >
                                        <span>➕</span>
                                        <span>Assign User</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. CHECKLIST MASTER */}
                    {isChecklistMaster && (
                        <div className="space-y-4">
                            {/* 1. Asset ID (Linked to Machine Master) */}
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                        <span>⚙️</span> 1. Machine / Asset ID *
                                    </label>
                                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                        Linked to Machine Master
                                    </span>
                                </div>
                                <select
                                    value={getRowVal(["Asset ID", "assetId", "Machine / Asset", "Asset ID / Machine"])}
                                    onChange={(e) => {
                                        const selectedAsset = e.target.value;
                                        handleChange("Asset ID", selectedAsset);
                                        handleChange("Asset ID / Machine", selectedAsset);
                                        handleChange("Machine / Asset", selectedAsset);
                                        const m = machinesList.find((mac) => mac.assetId === selectedAsset);
                                        if (m) {
                                            handleChange("Category", m.department || (m as any).category || "Machine Maintenance");
                                        }
                                    }}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-900 bg-white focus:border-[#880b13] focus:outline-hidden cursor-pointer"
                                >
                                    <option value="">Select a Machine from Machine Master...</option>
                                    <option value="ALL">🌟 ALL MACHINES (Universal Factory Checkpoint)</option>
                                    {machinesList && machinesList.length > 0 ? (
                                        machinesList.map((m, idx) => (
                                            <option key={m.assetId || idx} value={m.assetId}>
                                                {m.assetId} — {m.name} ({m.department || "Plant Floor"})
                                            </option>
                                        ))
                                    ) : (
                                        <option value="SKY-TPP-PUN-001">SKY-TPP-PUN-001 — Punching Machine</option>
                                    )}
                                </select>

                                {/* Manual Asset ID field if needed */}
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[11px] font-semibold text-slate-500">Or custom Asset ID:</span>
                                    <input
                                        type="text"
                                        value={getRowVal(["Asset ID", "assetId", "Machine / Asset", "Asset ID / Machine"])}
                                        onChange={(e) => {
                                            handleChange("Asset ID", e.target.value);
                                            handleChange("Asset ID / Machine", e.target.value);
                                            handleChange("Machine / Asset", e.target.value);
                                        }}
                                        placeholder="e.g. SKY-LSR-001, ALL"
                                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono font-bold text-slate-800 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* 2. Category */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">2. Category *</label>
                                    <input
                                        type="text"
                                        required
                                        list="checklist-cat-suggestions"
                                        value={getRowVal(["Category", "category"])}
                                        onChange={(e) => handleChange("Category", e.target.value)}
                                        placeholder="e.g. Mechanical, Electrical, Lubrication"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                    <datalist id="checklist-cat-suggestions">
                                        <option value="Mechanical" />
                                        <option value="Electrical" />
                                        <option value="Hydraulic & Pneumatic" />
                                        <option value="Lubrication & Greasing" />
                                        <option value="Safety Interlocks & E-Stop" />
                                        <option value="Tooling & Spindle" />
                                        <option value="Coolant & Chiller" />
                                        <option value="5S & Cleanliness" />
                                        <option value="Laser Optics & Calibration" />
                                        <option value="Monthly PM Maintenance" />
                                        <option value="Weekly PM Maintenance" />
                                        <option value="General Equipment" />
                                    </datalist>
                                </div>

                                {/* 5. Frequency */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">5. Frequency *</label>
                                    <select
                                        value={getRowVal(["Frequency", "frequency"]) || "Daily"}
                                        onChange={(e) => handleChange("Frequency", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Quarterly">Quarterly</option>
                                        <option value="Half-Yearly">Half-Yearly</option>
                                        <option value="Yearly">Yearly</option>
                                        <option value="As Required">As Required / Pre-Shift</option>
                                    </select>
                                </div>
                            </div>

                            {/* 3. Check Point */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">3. Check Point / Task *</label>
                                <input
                                    type="text"
                                    required
                                    value={getRowVal(["Check Point", "Check Point / Task", "checkPoint"])}
                                    onChange={(e) => {
                                        handleChange("Check Point", e.target.value);
                                        handleChange("Check Point / Task", e.target.value);
                                    }}
                                    placeholder="e.g. Check hydraulic oil level and filter indicator gauge"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>

                            {/* 4. Standard Requirement */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">4. Standard Requirement *</label>
                                <textarea
                                    rows={2}
                                    required
                                    value={getRowVal(["Standard Requirement", "Standard / Requirement", "Standard Parameter", "standard"])}
                                    onChange={(e) => {
                                        handleChange("Standard Requirement", e.target.value);
                                        handleChange("Standard / Requirement", e.target.value);
                                        handleChange("Standard Parameter", e.target.value);
                                    }}
                                    placeholder="Specify acceptable operating condition, parameters, or limits (e.g. Visual / Clean / No Leakage / Pressure 4-6 Bar)..."
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* 6. Response */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">6. Response Type</label>
                                    <select
                                        value={getRowVal(["Response", "response"]) || "OK / Not OK / NA"}
                                        onChange={(e) => handleChange("Response", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="OK / Not OK / NA">OK / Not OK / NA (Standard)</option>
                                        <option value="OK / Not OK">OK / Not OK</option>
                                        <option value="Measurement Value (Number)">Measurement Value (Number / Gauge)</option>
                                        <option value="Yes / No">Yes / No</option>
                                        <option value="Good / Fair / Poor">Good / Fair / Poor</option>
                                    </select>
                                </div>

                                {/* 7. Photo (Optional) */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">7. Photo Section (Optional)</label>
                                    <select
                                        value={getRowVal(["Required Photo", "requiredPhoto"]) || "No"}
                                        onChange={(e) => handleChange("Required Photo", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="No">No photo needed</option>
                                        <option value="Yes">📸 Yes (Optional photo attachment allowed)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* 8. If Not OK Action */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">8. If Not OK Action</label>
                                    <input
                                        type="text"
                                        list="if-not-ok-suggestions"
                                        value={getRowVal(["If Not OK Action", "IF Not ok Action", "actionIfNotOk"])}
                                        onChange={(e) => {
                                            handleChange("If Not OK Action", e.target.value);
                                            handleChange("IF Not ok Action", e.target.value);
                                            handleChange("actionIfNotOk", e.target.value);
                                        }}
                                        placeholder="Action when check fails"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                    <datalist id="if-not-ok-suggestions">
                                        <option value="Report to Maintenance & Log Issue" />
                                        <option value="Trigger Immediate Breakdown Ticket" />
                                        <option value="Notify Supervisor & Stop Machine" />
                                        <option value="Replenish Oil / Clean & Re-check" />
                                        <option value="Schedule Preventive Maintenance" />
                                    </datalist>
                                </div>

                                {/* 9. Active */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">9. Active Status</label>
                                    <select
                                        value={getRowVal(["Active", "Status", "status"]) || "Yes"}
                                        onChange={(e) => {
                                            handleChange("Active", e.target.value);
                                            handleChange("Status", e.target.value === "Yes" ? "Active" : "Inactive");
                                        }}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Yes">● Yes (Active Checkpoint)</option>
                                        <option value="No">○ No (Inactive / Archived)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. MAINTENANCE RECORDS */}
                    {isMaintenanceView && (
                        <div className="space-y-4">
                            {/* Section 1: Work Order & Machine Identification */}
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <div className="flex items-center gap-2 border-b border-slate-200/70 pb-2">
                                    <span className="text-[11px] font-black text-[#880b13] bg-[#880b13]/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                        Section 1 • Work Order & Machine
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            1. Work Order / Maintenance ID *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={getRowVal(["recordId", "Maintenance ID", "Record ID"])}
                                            onChange={(e) => handleChange("Maintenance ID", e.target.value)}
                                            placeholder="e.g. MNT-001"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-[#880b13] focus:border-[#880b13] focus:outline-hidden"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            2. Date *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={getRowVal(["Date", "date"])}
                                            onChange={(e) => handleChange("Date", e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            3. Asset ID *
                                        </label>
                                        <select
                                            value={getRowVal(["Asset ID", "assetId"])}
                                            onChange={(e) => handleChange("Asset ID", e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:border-[#880b13] focus:outline-hidden"
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
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            4. Machine Name
                                        </label>
                                        <input
                                            type="text"
                                            value={getRowVal(["Machine Name", "machineName"])}
                                            onChange={(e) => handleChange("Machine Name", e.target.value)}
                                            placeholder="Machine Name"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Requester / User Information */}
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <div className="flex items-center gap-2 border-b border-slate-200/70 pb-2">
                                    <span className="text-[11px] font-black text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                        Section 2 • User / Requester Information
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            5. User ID
                                        </label>
                                        <select
                                            value={getRowVal(["User ID", "userId"])}
                                            onChange={(e) => handleChange("User ID", e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:border-[#880b13] focus:outline-hidden"
                                        >
                                            <option value="">Select User ID...</option>
                                            {usersList.map((u) => (
                                                <option key={u.userId} value={u.userId}>
                                                    {u.userId} - {u.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            6. User Name
                                        </label>
                                        <input
                                            type="text"
                                            value={getRowVal(["User Name", "userName", "Submitted By", "submittedBy"])}
                                            onChange={(e) => handleChange("User Name", e.target.value)}
                                            placeholder="Requester / Operator Name"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Checklist Reference & Breakdown Issue */}
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <div className="flex items-center gap-2 border-b border-slate-200/70 pb-2">
                                    <span className="text-[11px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                        Section 3 • Checklist Reference &amp; Breakdown
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            7. Checklist ID
                                        </label>
                                        <input
                                            type="text"
                                            value={getRowVal(["Checklist ID", "checklistId", "Template ID"])}
                                            onChange={(e) => handleChange("Checklist ID", e.target.value)}
                                            placeholder="e.g. CHK-001 or MNT-GENERAL"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-emerald-950 focus:border-[#880b13] focus:outline-hidden"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            9. Priority
                                        </label>
                                        <select
                                            value={getRowVal(["Priority", "priority"]) || "Medium"}
                                            onChange={(e) => handleChange("Priority", e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:border-[#880b13] focus:outline-hidden"
                                        >
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Critical">Critical</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        8. Problem / Breakdown Description *
                                    </label>
                                    <textarea
                                        rows={2}
                                        required
                                        value={getRowVal(["Issue", "problem", "Problem / Request", "Description", "observation"])}
                                        onChange={(e) => handleChange("Issue", e.target.value)}
                                        placeholder="Describe maintenance breakdown, defect, or requested repair..."
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            {/* Section 4: Assignment, Action Taken & Completion */}
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <div className="flex items-center gap-2 border-b border-slate-200/70 pb-2">
                                    <span className="text-[11px] font-black text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                        Section 4 • Assignment &amp; Action Taken
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            10. Assigned To
                                        </label>
                                        <input
                                            type="text"
                                            value={getRowVal(["Assigned To", "assignedTo", "Technician", "technicianName"])}
                                            onChange={(e) => handleChange("Assigned To", e.target.value)}
                                            placeholder="Technician or Engineer Name"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            12. Status
                                        </label>
                                        <select
                                            value={getRowVal(["Status", "status"]) || "Open"}
                                            onChange={(e) => handleChange("Status", e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:border-[#880b13] focus:outline-hidden"
                                        >
                                            <option value="Open">● Open</option>
                                            <option value="In Progress">⚡ In Progress</option>
                                            <option value="Resolved">✓ Resolved</option>
                                            <option value="Closed">🔒 Closed</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        11. Action Taken
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={getRowVal(["Action Taken", "actionTaken", "correctiveAction", "Corrective Action"])}
                                        onChange={(e) => handleChange("Action Taken", e.target.value)}
                                        placeholder="Detail the corrective actions taken, parts replaced, or service performed..."
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        13. Completion Date
                                    </label>
                                    <input
                                        type="date"
                                        value={getRowVal(["Completion Date", "completionDate"])}
                                        onChange={(e) => handleChange("Completion Date", e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#880b13] focus:outline-hidden"
                                    />
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
                    {(!isUserMaster && !isMachineMaster && !isAssetMaster && !isChecklistMaster && !isBreakdownView && !isMaintenanceView && !isSafetyView && !isPartsView && !isDocumentView && !isNotificationsView && !isComplianceView && !isTrainingView && !isHiraView) && (
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
                            onClick={handleCancel}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
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
