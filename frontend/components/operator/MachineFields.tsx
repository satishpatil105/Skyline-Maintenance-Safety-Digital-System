"use client";

import type { Machine } from "@/lib/types";

type FieldKey = keyof Machine;

const TEXT_FIELDS: {
  key: FieldKey;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}[] = [
  { key: "Asset ID", label: "Asset ID", placeholder: "Leave blank to auto-generate (e.g. SKY-MC-004)" },
  { key: "Machine Name", label: "Machine Name", placeholder: "Example: Hydraulic Press 50T", required: true },
  { key: "Category", label: "Category", placeholder: "Example: Fabrication Equipment" },
  { key: "Department", label: "Department" },
  { key: "Location", label: "Location" },
  { key: "Make", label: "Make" },
  { key: "Model", label: "Model" },
  { key: "Serial No.", label: "Serial No." },
  { key: "Responsible Person", label: "Responsible Person" },
  { key: "AMC Vendor", label: "AMC Vendor" },
  { key: "AMC Contact", label: "AMC Contact" },
  { key: "AMC Expiry", label: "AMC Expiry", placeholder: "e.g. 31-03-2027" },
  { key: "Installation Date", label: "Installation Date", placeholder: "e.g. 15-06-2021" },
  { key: "QR Link", label: "QR Link", placeholder: "Auto-generated e.g. http://localhost:3000/machine/..." },
];

const SELECT_FIELDS: { key: FieldKey; label: string; options: string[] }[] = [
  { key: "Criticality", label: "Criticality", options: ["Low", "Medium", "High", "Critical"] },
  { key: "Status", label: "Status", options: ["Running", "Operational", "Under Maintenance", "Out of Service"] },
  { key: "PM Frequency", label: "PM Frequency", options: ["Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly", "As Required"] },
];

/** The machine input grid, shared by the Add and Edit forms. */
export default function MachineFields({
  values,
  onChange,
  lockAssetId = false,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Asset ID is permanent (the QR depends on it), so Edit locks it. */
  lockAssetId?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
      {TEXT_FIELDS.map((f) => {
        const locked = lockAssetId && f.key === "Asset ID";
        return (
          <div key={f.key}>
            <label className="field-label" htmlFor={`m-${f.key}`}>
              {f.label} {f.required && <span className="text-red-600">*</span>}
            </label>
            <input
              id={`m-${f.key}`}
              type={f.type || "text"}
              className={`field-input ${locked ? "cursor-not-allowed bg-slate-100" : ""}`}
              placeholder={f.placeholder}
              required={f.required}
              readOnly={locked}
              autoComplete="off"
              value={values[f.key] || ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          </div>
        );
      })}
      {SELECT_FIELDS.map((f) => (
        <div key={f.key}>
          <label className="field-label" htmlFor={`m-${f.key}`}>
            {f.label}
          </label>
          <select
            id={`m-${f.key}`}
            className="field-input"
            value={values[f.key] || ""}
            onChange={(e) => onChange(f.key, e.target.value)}
          >
            <option value="">Select...</option>
            {/* Keep a value the sheet already has, even if it is not in our list. */}
            {(values[f.key] && !f.options.includes(values[f.key]) ? [...f.options, values[f.key]] : f.options).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
