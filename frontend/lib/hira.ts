import { getMongoDb } from "./mongodb";
import { MongoClient } from "mongodb";

export interface HiraRecord {
  _id?: string;
  hiraId: string;
  srNo: number;
  department: string;
  activity: string;
  hazardCategory: string;
  hazardDescription: string;
  potentialConsequence: string;
  existingControls: string;
  existingLikelihood: number;
  existingSeverity: number;
  existingRiskScore: number;
  existingRiskLevel: "Low" | "Medium" | "High" | "Very High";
  additionalControls: string;
  responsiblePersonDept: string;
  targetTimeframe: string;
  residualLikelihood: number;
  residualSeverity: number;
  residualRiskScore: number;
  residualRiskLevel: "Low" | "Medium" | "High" | "Very High";
  actionStatus: "Open" | "In Progress" | "Closed";
  isTbc: boolean;
  sourceFile: string;
  validationStatus: string;
  formulas?: {
    existingRiskScoreFormula: string | null;
    existingRiskLevelFormula: string | null;
    residualRiskScoreFormula: string | null;
    residualRiskLevelFormula: string | null;
  };
  actionTracking: {
    assignedTo: string;
    targetTimeframe: string;
    targetDate: string | null;
    actualCompletionDate: string | null;
    completionEvidence: string | null;
    progressRemarks: string | null;
    auditTrail: Array<{
      changedBy: string;
      changeDate: string;
      previousStatus: string | null;
      newStatus: string;
      remarks?: string | null;
    }>;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface RiskLevelDistribution {
  Low: number;
  Medium: number;
  High: number;
  "Very High": number;
}

export interface HiraSummary {
  totalHazards: number;
  existingDistribution: RiskLevelDistribution;
  residualDistribution: RiskLevelDistribution;
  reductions: RiskLevelDistribution;
  actionStatusCounts: {
    Open: number;
    "In Progress": number;
    Closed: number;
  };
  actionClosurePercentage: number;
  tbcCount: number;
  departments: string[];
  categories: string[];
}

/**
 * Validates integer rating (1..5)
 */
export function validateRating(val: unknown): number {
  const n = parseInt(String(val ?? "").trim(), 10);
  if (isNaN(n) || n < 1 || n > 5) {
    throw new Error(`Invalid risk rating "${val}". Rating must be an integer between 1 and 5.`);
  }
  return n;
}

/**
 * Calculates Risk Score: L x S
 */
export function calculateRiskScore(l: number, s: number): number {
  return l * s;
}

/**
 * Assigns Risk Level based on score:
 * 1-4: Low
 * 5-9: Medium
 * 10-14: High
 * 15-25: Very High
 */
export function calculateRiskLevel(score: number): "Low" | "Medium" | "High" | "Very High" {
  if (score <= 4) return "Low";
  if (score <= 9) return "Medium";
  if (score <= 14) return "High";
  return "Very High";
}

/**
 * Compute summary statistics dynamically from records
 */
export function computeHiraSummary(records: HiraRecord[]): HiraSummary {
  const existing: RiskLevelDistribution = { Low: 0, Medium: 0, High: 0, "Very High": 0 };
  const residual: RiskLevelDistribution = { Low: 0, Medium: 0, High: 0, "Very High": 0 };
  const actionCounts = { Open: 0, "In Progress": 0, Closed: 0 };
  let tbcCount = 0;
  const deptSet = new Set<string>();
  const catSet = new Set<string>();

  for (const r of records) {
    if (r.existingRiskLevel && existing[r.existingRiskLevel] !== undefined) {
      existing[r.existingRiskLevel]++;
    }
    if (r.residualRiskLevel && residual[r.residualRiskLevel] !== undefined) {
      residual[r.residualRiskLevel]++;
    }

    const st = r.actionStatus || "Open";
    if (st === "Closed") actionCounts.Closed++;
    else if (st === "In Progress") actionCounts["In Progress"]++;
    else actionCounts.Open++;

    if (r.isTbc) tbcCount++;
    if (r.department) deptSet.add(r.department);
    if (r.hazardCategory) catSet.add(r.hazardCategory);
  }

  const reductions: RiskLevelDistribution = {
    Low: existing.Low - residual.Low,
    Medium: existing.Medium - residual.Medium,
    High: existing.High - residual.High,
    "Very High": existing["Very High"] - residual["Very High"],
  };

  const total = records.length;
  const actionClosurePercentage = total > 0 ? parseFloat(((actionCounts.Closed / total) * 100).toFixed(1)) : 0;

  return {
    totalHazards: total,
    existingDistribution: existing,
    residualDistribution: residual,
    reductions,
    actionStatusCounts: actionCounts,
    actionClosurePercentage,
    tbcCount,
    departments: Array.from(deptSet).sort(),
    categories: Array.from(catSet).sort(),
  };
}

/**
 * Get HIRA collection from MongoDB Atlas (checking skyms or fallback to active db)
 */
export async function getHiraCollection() {
  const db = await getMongoDb();
  return db.collection<HiraRecord>("hira");
}

export async function getHiraMetadataCollection() {
  const db = await getMongoDb();
  return db.collection("hira_metadata");
}

/**
 * Fetch all HIRA records from database
 */
export async function getAllHiraRecords(): Promise<HiraRecord[]> {
  const col = await getHiraCollection();
  // Fetch workbook records, sorted by srNo ascending
  const docs = await col
    .find({ sourceFile: "Skyline_HIRA_Register 1.xlsx" })
    .sort({ srNo: 1 })
    .toArray();

  return docs as unknown as HiraRecord[];
}

/**
 * Fetch HIRA metadata
 */
export async function getHiraMetadata(): Promise<any> {
  const col = await getHiraMetadataCollection();
  const meta = await col.findOne({ docId: "SKY-QA-HIRA-01" });
  return meta;
}
