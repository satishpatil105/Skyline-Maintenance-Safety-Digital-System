"use client";

import { useState } from "react";
import StatusBanner, { StatusType } from "./StatusBanner";

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({ type: null, message: "" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (next !== confirm) {
      setStatus({ type: "error", message: "The two new passwords do not match." });
      return;
    }

    setBusy(true);
    setStatus({ type: null, message: "" });
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const result = await response.json();

      if (result.success) {
        setStatus({ type: "success", message: result.message });
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setStatus({ type: "error", message: result.message || "Could not change the password." });
      }
    } catch (error) {
      setStatus({ type: "error", message: "Server Error: " + (error instanceof Error ? error.message : String(error)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="mb-1 border-b-2 border-slate-200 pb-2.5 text-xl font-bold text-skyline-deep">
        Change Password
      </h2>

      <label className="field-label" htmlFor="currentPassword">Current password</label>
      <input id="currentPassword" type="password" className="field-input" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />

      <label className="field-label" htmlFor="newPassword">New password</label>
      <input id="newPassword" type="password" className="field-input" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
      <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>

      <label className="field-label" htmlFor="confirmPassword">Repeat new password</label>
      <input id="confirmPassword" type="password" className="field-input" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />

      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? "Saving..." : "Change Password"}
      </button>
      <StatusBanner type={status.type} message={status.message} />
    </form>
  );
}
