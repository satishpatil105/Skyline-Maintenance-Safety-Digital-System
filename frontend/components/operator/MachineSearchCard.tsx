"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/auth";
import type { Machine } from "@/lib/types";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";
import QrCodeCard from "./QrCodeCard";

const DISPLAY_FIELDS: (keyof Machine)[] = [
  "Asset ID",
  "Machine Name",
  "Category",
  "Department",
  "Location",
  "Make",
  "Model",
  "Serial No.",
  "Criticality",
  "Responsible Person",
  "Status",
  "PM Frequency",
  "AMC Vendor",
  "AMC Contact",
  "AMC Expiry",
  "Installation Date",
];

export default function MachineSearchCard({
  user,
  canMaintenance = true,
  canSafety = true,
  onMachineSelected,
  onOpenMaintenance,
  onOpenSafety,
}: {
  user?: SessionUser;
  canMaintenance?: boolean;
  canSafety?: boolean;
  onMachineSelected: (machine: Machine | null) => void;
  onOpenMaintenance: () => void;
  onOpenSafety: () => void;
}) {
  const [assetId, setAssetId] = useState("");
  const [machine, setMachine] = useState<Machine | null>(null);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({
    type: null,
    message: "",
  });

  async function searchMachine() {
    const trimmed = assetId.trim();

    if (!trimmed) {
      setStatus({ type: "error", message: "Please enter Asset ID." });
      setMachine(null);
      onMachineSelected(null);
      return;
    }

    setSearching(true);
    setStatus({ type: "info", message: "Searching machine..." });
    setMachine(null);

    try {
      const response = await fetch(
        `/api/machine?assetId=${encodeURIComponent(trimmed)}`
      );
      const result = await response.json();

      if (result.success && result.machine) {
        if (user && user.role !== "Admin" && user.departmentMachine) {
          const dept = user.departmentMachine.trim().toLowerCase();
          const tokens = dept.split(/[\s/,-]+/).filter((t) => t.length > 2 && t !== "machine");
          const mName = (result.machine["Machine Name"] || "").toLowerCase();
          const mId = (result.machine["Asset ID"] || "").toLowerCase();
          const mCat = (result.machine.Category || "").toLowerCase();
          const matches =
            dept === mName ||
            dept === mId ||
            dept === mCat ||
            mName.includes(dept) ||
            dept.includes(mName) ||
            (tokens.length > 0 && tokens.some((t) => mName.includes(t) || mId.includes(t) || mCat.includes(t)));

          if (!matches) {
            onMachineSelected(null);
            setStatus({
              type: "error",
              message: `🚫 Access Restricted: You are assigned strictly to ${user.departmentMachine}. Another machine cannot be opened.`,
            });
            return;
          }
        }

        setMachine(result.machine);
        onMachineSelected(result.machine);
        setStatus({ type: "success", message: "Machine found successfully." });
      } else {
        onMachineSelected(null);
        setStatus({
          type: "error",
          message: result.message || "Machine not found.",
        });
      }
    } catch (error) {
      onMachineSelected(null);
      setStatus({
        type: "error",
        message:
          "Server Error: " +
          (error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setSearching(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      searchMachine();
    }
  }

  return (
    <section className="card">
      <h2 className="mb-4 border-b-2 border-slate-200 pb-2.5 text-xl font-bold text-skyline-deep">
        Find Machine / Equipment
      </h2>

      <label className="field-label" htmlFor="assetId">
        Asset ID <span className="text-red-600">*</span>
      </label>
      <input
        type="text"
        id="assetId"
        className="field-input"
        placeholder="Example: SKY-LSR-001"
        autoComplete="off"
        value={assetId}
        onChange={(event) => setAssetId(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <button
        type="button"
        className="primary-button"
        disabled={searching}
        onClick={searchMachine}
      >
        {searching ? "Searching..." : "Search Machine"}
      </button>

      <StatusBanner type={status.type} message={status.message} />

      {machine && (
        <div className="mt-6">
          <h2 className="mb-4 border-b-2 border-slate-200 pb-2.5 text-xl font-bold text-skyline-deep">
            Machine Details
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DISPLAY_FIELDS.filter(
              (field) => machine[field] !== undefined && machine[field] !== ""
            ).map((field) => (
              <div
                key={field}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <strong className="mb-1.5 block text-xs text-slate-500">
                  {field}
                </strong>
                <span className="text-sm font-bold text-slate-800">
                  {machine[field]}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:auto-cols-fr sm:grid-flow-col">
            {canMaintenance && (
              <button
                type="button"
                className="primary-button mt-0"
                onClick={onOpenMaintenance}
              >
                Maintenance Record
              </button>
            )}
            {canSafety && (
              <button
                type="button"
                className="primary-button mt-0 bg-slate-500 hover:bg-slate-600"
                onClick={onOpenSafety}
              >
                Safety Inspection
              </button>
            )}
            <a
              href={`/operator/machine/${encodeURIComponent(machine["Asset ID"])}`}
              target="_blank"
              rel="noopener noreferrer"
              className="primary-button mt-0 block bg-slate-500 text-center no-underline hover:bg-slate-600"
            >
              Open Machine Page ↗
            </a>
          </div>

          <QrCodeCard
            key={machine["Asset ID"]}
            assetId={machine["Asset ID"]}
            machineName={machine["Machine Name"]}
          />
        </div>
      )}
    </section>
  );
}
