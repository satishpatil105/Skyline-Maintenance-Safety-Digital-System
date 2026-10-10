"use client";

import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Skyline App Error]:", error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-3xl mb-4 font-bold">
                ⚠️
            </div>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-slate-300 mb-6 max-w-md text-sm">{error?.message || "An unexpected error occurred while processing your request."}</p>
            <div className="flex gap-4">
                <button
                    onClick={() => reset()}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition-all text-sm cursor-pointer"
                >
                    Try Again
                </button>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition-all text-sm cursor-pointer"
                >
                    Reload Page
                </button>
            </div>
        </div>
    );
}
