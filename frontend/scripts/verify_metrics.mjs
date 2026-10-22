import fs from "fs";

const raw = fs.readFileSync("scripts/hira_38_records.json", "utf-8");
const records = JSON.parse(raw);

console.log("=== CALCULATING METRICS FROM 38 RECORDS ===");

const existingCounts = { Low: 0, Medium: 0, High: 0, "Very High": 0 };
const residualCounts = { Low: 0, Medium: 0, High: 0, "Very High": 0 };
const statusCounts = { Open: 0, "In Progress": 0, Closed: 0 };

records.forEach(r => {
  // Verify calculation:
  const expExistingScore = r.existingLikelihood * r.existingSeverity;
  if (expExistingScore !== r.existingRiskScore) {
    console.warn(`Mismatch in existing score for Sr ${r.srNo}: formula gave ${r.existingRiskScore}, calculated ${expExistingScore}`);
  }

  const expResidualScore = r.residualLikelihood * r.residualSeverity;
  if (expResidualScore !== r.residualRiskScore) {
    console.warn(`Mismatch in residual score for Sr ${r.srNo}: formula gave ${r.residualRiskScore}, calculated ${expResidualScore}`);
  }

  // Count
  existingCounts[r.existingRiskLevel] = (existingCounts[r.existingRiskLevel] || 0) + 1;
  residualCounts[r.residualRiskLevel] = (residualCounts[r.residualRiskLevel] || 0) + 1;
  
  const status = r.actionStatus || "Open";
  statusCounts[status] = (statusCounts[status] || 0) + 1;
});

console.log("\nExisting Risk Level Distribution:", existingCounts);
console.log("Residual Risk Level Distribution:", residualCounts);
console.log("Reductions (Existing - Residual):", {
  Low: existingCounts.Low - residualCounts.Low,
  Medium: existingCounts.Medium - residualCounts.Medium,
  High: existingCounts.High - residualCounts.High,
  "Very High": existingCounts["Very High"] - residualCounts["Very High"]
});
console.log("\nAction Status Distribution:", statusCounts);
console.log("Total Hazards:", records.length);
const closurePct = ((statusCounts.Closed / records.length) * 100).toFixed(1);
console.log(`Action Closure: ${closurePct}%`);

console.log("\nComparing with Sheet 4:");
console.log("Sheet 4 Existing: Low: 2, Medium: 24, High: 10, Very High: 2, Total: 38");
console.log("Sheet 4 Residual: Low: 11, Medium: 26, High: 1, Very High: 0, Total: 38");
console.log("Sheet 4 Reductions: Low: -9, Medium: -2, High: 9, Very High: 2");
console.log("Sheet 4 Status: Open: 37, In Progress: 0, Closed: 1, Total: 38");
