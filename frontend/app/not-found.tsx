import Link from "next/link";

export default function RootNotFoundPage() {
    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
            <div className="w-16 h-16 rounded-2xl bg-[#880b13]/20 text-[#880b13] border border-[#880b13]/30 flex items-center justify-center text-3xl mb-4 font-bold shadow-lg">
                🔎
            </div>
            <h2 className="text-2xl font-black mb-2">Page Not Found</h2>
            <p className="text-slate-300 mb-6 max-w-md text-xs leading-relaxed">
                The requested page or route could not be found. Please return to your portal workstation below.
            </p>
            <div className="flex justify-center">
                <Link
                    href="/operator/dashboard"
                    className="px-6 py-3 bg-[#880b13] hover:bg-rose-700 text-white font-black rounded-xl shadow-md transition-all text-xs flex items-center gap-2"
                >
                    <span>🚜</span>
                    <span>Operator Workstation</span>
                </Link>
            </div>
        </div>
    );
}
