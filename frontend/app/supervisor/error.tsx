"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SupervisorErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Skyline Supervisor Error]:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-3xl mb-4 font-bold shadow-lg">
                📊
            </div>
            <h2 className="text-2xl font-black mb-2">Supervisor Module Error</h2>
            <p className="text-slate-300 mb-6 max-w-md text-xs leading-relaxed">
                {error?.message || "An unexpected error occurred while loading the supervisor portal."}
            </p>
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={() => reset()}
                    className="px-5 py-2.5 bg-[#880b13] hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all text-xs cursor-pointer"
                >
                    Try Again
                </button>
                <Link
                    href="/supervisor/dashboard"
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition-all text-xs"
                >
                    Supervisor Dashboard
                </Link>
            </div>
        </div>
    );
}
