import Link from "next/link";

export default function SupervisorNotFoundPage() {
    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-3xl mb-4 font-bold shadow-lg">
                🔎
            </div>
            <h2 className="text-2xl font-black mb-2">Page Not Found</h2>
            <p className="text-slate-300 mb-6 max-w-md text-xs leading-relaxed">
                The supervisor page or route you requested could not be found.
            </p>
            <Link
                href="/supervisor/dashboard"
                className="px-5 py-2.5 bg-[#880b13] hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all text-xs"
            >
                Return to Supervisor Dashboard
            </Link>
        </div>
    );
}
