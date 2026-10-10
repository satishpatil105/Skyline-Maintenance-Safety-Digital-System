"use client";

import { useState } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import MachineQrScannerModal from "@/components/operator/MachineQrScannerModal";

/** "Signed in as ..." strip with Scan Machine QR button. */
export default function UserBar({ user }: { user: SessionUser }) {
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <>
      <section className="card flex flex-wrap items-center justify-between gap-3 !py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <span>
            Signed in as <strong>{user.name}</strong>
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${user.role === "Admin" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
              }`}
          >
            {user.role}
          </span>
          {user.role !== "Admin" && user.departmentMachine && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 border border-emerald-300">
              🚜 {user.departmentMachine}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-bold">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-skyline-deep/10 px-3.5 py-1.5 text-xs font-black text-skyline-deep hover:bg-skyline-deep hover:text-white transition-all shadow-xs cursor-pointer"
            title="Scan machine QR code with camera"
          >
            <span>📷</span>
            <span>Scan Machine QR</span>
          </button>

          {user.role === "Admin" ? (
            <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-[#880b13] font-black hover:underline">
              <span>📊</span>
              <span>Admin Dashboard</span>
            </Link>
          ) : user.role?.toLowerCase() === "supervisor" ? (
            <Link href="/supervisor/dashboard" className="inline-flex items-center gap-1 text-emerald-800 font-black hover:underline">
              <span>📊</span>
              <span>Supervisor Dashboard</span>
            </Link>
          ) : (
            <Link href="/operator" className="inline-flex items-center gap-1 text-blue-800 font-black hover:underline">
              <span>🚜</span>
              <span>Operator Dashboard</span>
            </Link>
          )}
        </div>
      </section>

      <MachineQrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        user={user}
      />
    </>
  );
}
