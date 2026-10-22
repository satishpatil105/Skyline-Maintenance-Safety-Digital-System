import fs from "fs";

const raw = fs.readFileSync("scripts/hira_pristine_workbook.json", "utf-8");
const sheets = JSON.parse(raw);
const sheet3 = sheets[2]; // "HIRA Register"

const colHeaders = [
  "srNo",                     // C1
  "department",               // C2
  "activity",                 // C3
  "hazardCategory",           // C4
  "hazardDescription",        // C5
  "potentialConsequence",     // C6
  "existingControls",         // C7
  "existingLikelihood",       // C8
  "existingSeverity",         // C9
  "existingRiskScore",        // C10
  "existingRiskLevel",        // C11
  "additionalControls",       // C12
  "responsiblePersonDept",    // C13
  "targetTimeframe",          // C14
  "residualLikelihood",       // C15
  "residualSeverity",         // C16
  "residualRiskScore",        // C17
  "residualRiskLevel",        // C18
  "actionStatus"              // C19
];

const records = [];

for (const r of sheet3.rows) {
  if (r.rowNumber < 7 || r.rowNumber > 44) continue;
  
  const rec = {
    rowNumber: r.rowNumber
  };

  for (let c = 1; c <= 19; c++) {
    const key = colHeaders[c - 1];
    const cell = r.cells.find(cell => cell.col === c);
    let val = cell ? cell.value : null;
    let formula = cell ? cell.formula : null;
    
    // Convert numbers
    if (["srNo", "existingLikelihood", "existingSeverity", "existingRiskScore", "residualLikelihood", "residualSeverity", "residualRiskScore"].includes(key)) {
      if (typeof val === "string") val = parseInt(val, 10);
    }
    
    rec[key] = val;
    if (formula) {
      rec[key + "Formula"] = formula;
    }
  }

  // TBC check
  const isTbc = String(rec.activity || "").toLowerCase().includes("to be confirmed") ||
                String(rec.hazardDescription || "").toLowerCase().includes("to be confirmed") ||
                String(rec.existingControls || "").toLowerCase().includes("to be confirmed") ||
                String(rec.additionalControls || "").toLowerCase().includes("to be confirmed") ||
                String(rec.department || "").toLowerCase().includes("to be confirmed");
  rec.isTbc = isTbc;

  records.push(rec);
}

console.log(`Parsed ${records.length} records.`);
console.log("Sample Record 1:", JSON.stringify(records[0], null, 2));

const tbcRecords = records.filter(r => r.isTbc);
console.log(`Found ${tbcRecords.length} records marked "To Be Confirmed":`, tbcRecords.map(r => `Sr ${r.srNo}: ${r.activity}`));

fs.writeFileSync("scripts/hira_38_records.json", JSON.stringify(records, null, 2));
console.log("Saved scripts/hira_38_records.json");
