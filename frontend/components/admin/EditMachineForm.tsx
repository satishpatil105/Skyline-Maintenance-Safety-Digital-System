"use client";

import { useState } from "react";
import type { Machine } from "@/lib/types";
import MachineFields from "@/components/operator/MachineFields";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";

export default function EditMachineForm({
  machine,
  email,
  onSaved,
}: {
  machine: Machine;
  email: string;
  onSaved?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    ...(machine as unknown as Record<string, string>),
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({
    type: null,
    message: "",
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus({ type: "info", message: "Saving changes..." });

    try {
      const response = await fetch("/api/machine", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, "Asset ID": machine["Asset ID"], email }),
      });
      const result = await response.json();

      if (result.success) {
        setStatus({ type: "success", message: result.message });
        onSaved?.();
      } else {
        setStatus({ type: "error", message: result.message || "Could not update machine." });
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
        Edit Machine Details
      </h2>
      <form onSubmit={submit}>
        <MachineFields
          values={values}
          onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
          lockAssetId
        />
        <p className="mt-2 text-xs text-slate-500">
          Asset ID can&apos;t be changed — the printed QR code depends on it.
        </p>
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <StatusBanner type={status.type} message={status.message} />
      </form>
    </section>
  );
}
