/**
 * The Safety Department's record formats. Pure data (no server code), so the
 * forms in the browser and the checks on the server share one definition.
 *
 * Each category is one tab in the Excel workbook. Its columns are:
 *   Record ID | Date | <the category's own fields> | Status | Remarks |
 *   Photo / Evidence | Submitted By | Created At | Last Updated | Closed By
 */

export type FieldKind = "text" | "textarea" | "date" | "select" | "number";

export interface DeptField {
  /** Also the column header in the workbook. */
  label: string;
  kind: FieldKind;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** Worked out by the app (never typed): risk scores and ratings. */
  computed?: boolean;
  /** Form layout: "half" fields sit two to a row on wide screens. */
  half?: boolean;
}

export type CategoryId = "fire" | "employee" | "hira" | "environmental" | "other";

export interface DeptCategory {
  id: CategoryId;
  /** Short name on cards and headings. */
  label: string;
  /** Workbook tab created for it. */
  tab: string;
  /** Record ID prefix, e.g. FIRE-20260920-101500. */
  prefix: string;
  blurb: string;
  /** Field labels joined to make a record's title in lists and alerts. */
  headline: string[];
  /** Field labels shown as small facts under the title. */
  details: string[];
  fields: DeptField[];
  /** Extra rule beyond "required": a message, or null when fine. */
  check?: (values: Record<string, string>) => string | null;
}

export const STATUSES = ["Open", "In Progress", "Completed", "Closed"];
export const FINISHED = /^(closed|completed|rejected|cancelled|canceled|done)$/i;

export const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];

// ------------------------------------------------------------ HIRA risk maths

export const LIKELIHOOD = ["1 - Rare", "2 - Unlikely", "3 - Possible", "4 - Likely", "5 - Almost certain"];
export const SEVERITY = ["1 - Insignificant", "2 - Minor", "3 - Moderate", "4 - Major", "5 - Catastrophic"];

const digit = (v: string | undefined) => {
  const n = parseInt(String(v ?? "").trim(), 10);
  return n >= 1 && n <= 5 ? n : 0;
};

/** Likelihood x Severity (1-25), or 0 when either is missing. */
export function riskScore(likelihood: string | undefined, severity: string | undefined): number {
  return digit(likelihood) * digit(severity);
}

/** 1-4 Low, 5-9 Medium, 10-14 High, 15-25 Critical. */
export function riskRating(score: number): string {
  if (score <= 0) return "";
  if (score <= 4) return "Low";
  if (score <= 9) return "Medium";
  if (score <= 14) return "High";
  return "Critical";
}

/** The four figures the HIRA sheet stores, from the L x S choices. */
export function hiraFigures(v: Record<string, string>) {
  const score = riskScore(v["Likelihood"], v["Severity"]);
  const residual = riskScore(v["Residual Likelihood"], v["Residual Severity"]);
  return {
    "Risk Score": score ? String(score) : "",
    "Risk Rating": riskRating(score),
    "Residual Score": residual ? String(residual) : "",
    "Residual Rating": riskRating(residual),
  };
}

// --------------------------------------------------------------- categories

const responsible: DeptField[] = [
  { label: "Responsible Person", kind: "text", half: true },
  { label: "Target Date", kind: "date", half: true, help: "An alert is raised as this date gets close." },
];

export const CATEGORIES: DeptCategory[] = [
  {
    id: "fire",
    label: "Fire Safety",
    tab: "10. Fire Safety",
    prefix: "FIRE",
    blurb: "Fire extinguishers, hydrants, alarms, exits, fire drills and hot-work checks.",
    headline: ["Inspection Type", "Equipment ID / Tag"],
    details: ["Location / Area", "Condition", "Next Service / Expiry Date", "Responsible Person", "Target Date"],
    fields: [
      {
        label: "Inspection Type",
        kind: "select",
        required: true,
        half: true,
        options: [
          "Fire Extinguisher Check",
          "Hydrant / Hose Reel Check",
          "Fire Alarm / Detector Test",
          "Sprinkler System Check",
          "Emergency Exit / Assembly Point",
          "Fire Drill",
          "Hot Work Permit Check",
          "Other",
        ],
      },
      { label: "Location / Area", kind: "text", required: true, half: true, placeholder: "e.g. Assembly shop, near gate 2" },
      {
        label: "Equipment Type",
        kind: "select",
        half: true,
        options: ["ABC Dry Powder", "CO2", "Foam", "Water", "Hydrant", "Hose Reel", "Smoke Detector", "Alarm Panel", "Sprinkler", "Other"],
      },
      { label: "Equipment ID / Tag", kind: "text", half: true, placeholder: "e.g. FE-012", help: "The same ID lets the app track this extinguisher over time." },
      { label: "Capacity", kind: "text", half: true, placeholder: "e.g. 6 kg" },
      {
        label: "Condition",
        kind: "select",
        required: true,
        half: true,
        options: ["Satisfactory", "Needs Attention", "Defective", "Not Available"],
      },
      { label: "Last Service Date", kind: "date", half: true },
      { label: "Next Service / Expiry Date", kind: "date", half: true, help: "A reminder alert is raised before this date." },
      { label: "Observation", kind: "textarea", placeholder: "Pressure, seal and pin, hose, signage, access..." },
      { label: "Action Required", kind: "textarea" },
      ...responsible,
    ],
  },
  {
    id: "employee",
    label: "Employee Safety",
    tab: "11. Employee Safety",
    prefix: "EMP",
    blurb: "Incidents, near misses, first-aid cases, unsafe acts, PPE, training and medical checks.",
    headline: ["Record Type", "Employee Name"],
    details: ["Location / Area", "Severity", "Injury Type", "Next Due Date", "Responsible Person", "Target Date"],
    fields: [
      {
        label: "Record Type",
        kind: "select",
        required: true,
        half: true,
        options: [
          "PPE Issue & Monthly Review",
          "PPE Compliance Check",
          "Safety Training",
          "Toolbox Talk",
          "Incident / Injury",
          "Accident / Lost Time Injury",
          "Near Miss",
          "First Aid Case",
          "Unsafe Act",
          "Medical Checkup",
          "Other",
        ],
      },
      { label: "Location / Area", kind: "text", half: true },
      { label: "Employee Name", kind: "text", required: true, half: true },
      { label: "Employee ID", kind: "text", half: true },
      { label: "Department / Section", kind: "text", half: true },
      { label: "Severity", kind: "select", half: true, options: RISK_LEVELS },
      { label: "Description", kind: "textarea", required: true, placeholder: "What happened, or what was checked / taught?" },
      {
        label: "Injury Type",
        kind: "select",
        half: true,
        options: ["None", "First Aid", "Medical Treatment", "Lost Time Injury", "Fatality"],
      },
      { label: "Body Part Affected", kind: "text", half: true },
      { label: "PPE Used", kind: "select", half: true, options: ["Yes", "Partial", "No", "Not Applicable"] },
      { label: "Training / Topic", kind: "text", half: true, placeholder: "For training, toolbox talk or medical" },
      { label: "Trainer / Doctor", kind: "text", half: true },
      { label: "Next Due Date", kind: "date", half: true, help: "Next training or medical checkup; an alert is raised before it." },
      { label: "Root Cause", kind: "textarea" },
      { label: "Corrective Action", kind: "textarea" },
      ...responsible,
    ],
  },
  {
    id: "hira",
    label: "HIRA",
    tab: "12. HIRA",
    prefix: "HIRA",
    blurb: "Hazard Identification & Risk Assessment: hazard, likelihood x severity, controls, residual risk.",
    headline: ["Activity / Process", "Hazard Type"],
    details: ["Area / Department", "Risk Rating", "Residual Rating", "Responsible Person", "Target Date", "Review Date"],
    fields: [
      { label: "Activity / Process", kind: "text", required: true, half: true, placeholder: "e.g. Laser cutting, crane lifting" },
      { label: "Area / Department", kind: "text", required: true, half: true },
      { label: "Hazard", kind: "textarea", required: true, placeholder: "What could cause harm?" },
      {
        label: "Hazard Type",
        kind: "select",
        required: true,
        half: true,
        options: ["Mechanical", "Electrical", "Fire / Explosion", "Chemical", "Physical / Noise", "Ergonomic", "Working at Height", "Biological", "Environmental", "Other"],
      },
      { label: "Who Might Be Harmed", kind: "text", half: true, placeholder: "Operators, visitors, contractors..." },
      { label: "Existing Controls", kind: "textarea" },
      { label: "Likelihood", kind: "select", required: true, half: true, options: LIKELIHOOD },
      { label: "Severity", kind: "select", required: true, half: true, options: SEVERITY },
      { label: "Risk Score", kind: "number", computed: true, half: true },
      { label: "Risk Rating", kind: "text", computed: true, half: true },
      { label: "Additional Controls", kind: "textarea", help: "Required when the risk is High or Critical." },
      { label: "Residual Likelihood", kind: "select", half: true, options: LIKELIHOOD, help: "After the additional controls." },
      { label: "Residual Severity", kind: "select", half: true, options: SEVERITY },
      { label: "Residual Score", kind: "number", computed: true, half: true },
      { label: "Residual Rating", kind: "text", computed: true, half: true },
      ...responsible,
      { label: "Review Date", kind: "date", half: true, help: "When this assessment must be reviewed again." },
    ],
  },
  {
    id: "environmental",
    label: "Environmental",
    tab: "13. Environmental",
    prefix: "ENV",
    blurb: "Waste, effluent, emissions, spills, noise, chemical storage and permit compliance.",
    headline: ["Aspect", "Substance / Waste Type"],
    details: ["Location / Area", "Compliance", "Permit Due Date", "Responsible Person", "Target Date"],
    fields: [
      {
        label: "Aspect",
        kind: "select",
        required: true,
        half: true,
        options: [
          "Waste Generation & Disposal",
          "Effluent / Wastewater",
          "Air Emission",
          "Noise",
          "Spill / Leak",
          "Chemical Storage",
          "Water Consumption",
          "Energy Consumption",
          "Other",
        ],
      },
      { label: "Location / Area", kind: "text", required: true, half: true },
      { label: "Substance / Waste Type", kind: "text", half: true, placeholder: "e.g. Used oil, scrap metal, coolant" },
      { label: "Quantity", kind: "number", half: true },
      { label: "Unit", kind: "select", half: true, options: ["kg", "tonne", "litre", "m3", "dB", "kWh", "Nos", "Other"] },
      { label: "Disposal Method / Vendor", kind: "text", half: true },
      { label: "Manifest / Reference No.", kind: "text", half: true },
      { label: "Compliance", kind: "select", required: true, half: true, options: ["Compliant", "Non-Compliant", "Observation"] },
      { label: "Permit / Consent Name", kind: "text", half: true, placeholder: "e.g. Consent to Operate" },
      { label: "Permit Due Date", kind: "date", half: true, help: "Renewal date; an alert is raised before it." },
      { label: "Impact / Observation", kind: "textarea", required: true },
      { label: "Corrective Action", kind: "textarea" },
      ...responsible,
    ],
  },
  {
    id: "other",
    label: "Other Safety",
    tab: "14. Other Safety",
    prefix: "OTH",
    blurb: "Anything else: housekeeping, electrical, contractors, audits, statutory, emergency readiness.",
    headline: ["Title"],
    details: ["Category", "Location / Area", "Risk Level", "Responsible Person", "Target Date"],
    fields: [
      { label: "Title", kind: "text", required: true },
      {
        label: "Category",
        kind: "select",
        half: true,
        options: [
          "Housekeeping",
          "Electrical Safety",
          "Chemical Handling",
          "Contractor Safety",
          "Safety Audit Finding",
          "Statutory / Legal",
          "Emergency Preparedness",
          "Other",
        ],
      },
      { label: "Location / Area", kind: "text", required: true, half: true },
      { label: "Description", kind: "textarea", required: true },
      { label: "Risk Level", kind: "select", required: true, half: true, options: RISK_LEVELS },
      { label: "Action Taken", kind: "textarea" },
      ...responsible,
    ],
  },
];

/** Columns every category has around its own fields. */
export const HEAD_COLUMNS = ["Record ID", "Date"];
export const TAIL_COLUMNS = ["Status", "Remarks", "Photo / Evidence", "Submitted By", "Created At", "Last Updated", "Closed By"];

export const headersFor = (c: DeptCategory): string[] => [
  ...HEAD_COLUMNS,
  ...c.fields.map((f) => f.label),
  ...TAIL_COLUMNS,
];

export const categoryById = (id: string): DeptCategory | undefined => {
  const found = CATEGORIES.find((c) => c.id === id.toLowerCase());
  if (!found) return undefined;
  const { check, ...serializable } = found;
  return serializable as DeptCategory;
};

/** Dropdown lists for the Excel sheet itself (column label -> choices). */
export function dropdownsFor(c: DeptCategory): Record<string, string[]> {
  const out: Record<string, string[]> = { Status: STATUSES };
  for (const f of c.fields) if (f.kind === "select" && f.options) out[f.label] = f.options;
  return out;
}
