"use client";

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Skyline Global Error]:", error);
    }, [error]);

    return (
        <html lang="en">
            <body className="bg-slate-900 text-white flex items-center justify-center min-h-screen p-6 font-sans">
                <div className="max-w-md w-full bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-3xl mx-auto mb-4 font-bold">
                        ⚡
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Critical System Error</h2>
                    <p className="text-slate-300 text-sm mb-6">{error?.message || "An unexpected error occurred."}</p>
                    <button
                        onClick={() => reset()}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-lg"
                    >
                        Retry Application
                    </button>
                </div>
            </body>
        </html>
    );
}
