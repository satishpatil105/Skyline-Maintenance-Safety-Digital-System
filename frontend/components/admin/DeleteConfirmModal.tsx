"use client";

import { useEffect } from "react";
import type { Row } from "./UserMasterTable";

interface DeleteConfirmModalProps {
    isOpen: boolean;
    row: Row | null;
    itemName?: string;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting?: boolean;
}

export default function DeleteConfirmModal({
    isOpen,
    row,
    itemName = "Record",
    onClose,
    onConfirm,
    isDeleting = false,
}: DeleteConfirmModalProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !row) return null;

    // Find a friendly display title / ID from the row object
    const identifier =
        row["User ID"] ||
        row["Asset ID"] ||
        row["recordId"] ||
        row["Template ID"] ||
        row["Alert ID"] ||
        row["partId"] ||
        row["docId"] ||
        row["Machine Name"] ||
        row["Name"] ||
        row["Title"] ||
        row["Check Point"] ||
        "Selected Item";

    const category =
        row["Category"] ||
        row["Role"] ||
        row["Department"] ||
        row["Frequency"] ||
        row["Severity"] ||
        row["Inspection Type"] ||
        "Master Record";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 overflow-hidden text-left transform transition-all animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#880b13]" />

                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-[#880b13] border border-rose-200 shadow-2xs">
                        <span className="text-2xl">⚠️</span>
                    </div>

                    <div className="flex-1 space-y-1">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">
                            Confirm Delete {itemName}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Are you sure you want to delete this item? This action will remove the record from the digital register.
                        </p>
                    </div>
                </div>

                {/* Record Identifier Highlight Box */}
                <div className="mt-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                            {category}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-rose-100/70 px-2 py-0.5 text-[10px] font-extrabold text-[#880b13]">
                            Permanent Delete
                        </span>
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-800 break-all leading-snug">
                        {identifier}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 focus:outline-hidden disabled:opacity-50 transition-all shadow-2xs"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#880b13] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#6b080e] focus:outline-hidden disabled:opacity-50 transition-all shadow-xs"
                    >
                        {isDeleting ? (
                            <>
                                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                🗑️ Confirm Delete
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
