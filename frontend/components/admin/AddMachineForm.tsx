"use client";

import { useState } from "react";
import type { Machine } from "@/lib/types";
import MachineFields from "@/components/operator/MachineFields";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";
import QrCodeCard from "@/components/operator/QrCodeCard";

export default function AddMachineForm({ email }: { email: string }) {
  const [values, setValues] = useState<Record<string, string>>({
    Status: "Running",
  });
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<Machine | null>(null);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({
    type: null,
    message: "",
  });

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setValues({ Status: "Running" });
    setAdded(null);
    setStatus({ type: null, message: "" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!email.trim()) {
      setStatus({ type: "error", message: "Enter your work email at the top first." });
      return;
    }

    setSaving(true);
    setStatus({ type: "info", message: "Saving machine..." });

    try {
      const response = await fetch("/api/machine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, email }),
      });
      const result = await response.json();

      if (result.success && result.machine) {
        setAdded(result.machine);
        setStatus({ type: "success", message: result.message });
      } else {
        setStatus({ type: "error", message: result.message || "Could not add machine." });
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: "Server Error: " + (error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2 className="mb-4 border-b-2 border-slate-200 pb-2.5 text-xl font-bold text-skyline-deep">
        Add Machine / Equipment
      </h2>

      {added ? (
        <>
          <StatusBanner type={status.type} message={status.message} />
          <p className="mt-4 text-sm text-slate-700">
            <strong>{added["Machine Name"]}</strong> is registered. Generate its
            QR code, print it and stick it on the machine — anyone who scans it
            sees this machine&apos;s full details.
          </p>
          <QrCodeCard assetId={added["Asset ID"]} machineName={added["Machine Name"]} />
          <button
            type="button"
            className="primary-button bg-slate-500 hover:bg-slate-600"
            onClick={reset}
          >
            Add Another Machine
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <MachineFields values={values} onChange={setValue} />
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Save Machine"}
          </button>
          <StatusBanner type={status.type} message={status.message} />
        </form>
      )}
    </section>
  );
}
