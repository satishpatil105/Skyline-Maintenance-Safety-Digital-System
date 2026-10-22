import { MongoClient } from "mongodb";
import fs from "fs";

const uri = "mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0";

const rawRecords = JSON.parse(fs.readFileSync("scripts/hira_38_records.json", "utf-8"));
const pristineWorkbook = JSON.parse(fs.readFileSync("scripts/hira_pristine_workbook.json", "utf-8"));

// Prepare Sheet 1 (Legend & Instructions) and Sheet 2 (Risk Matrix) metadata
const metadataDoc = {
  docId: "SKY-QA-HIRA-01",
  docNo: "SKY/QA/HIRA/01",
  docDate: "17.08.2026",
  revNo: "0",
  revDate: "-",
  companyName: "SKYLINE PROJECT & ENGINEERS",
  plantLocation: "Chakan, Pune, Maharashtra",
  isoStandard: "ISO 45001:2018 — Occupational Health & Safety Management System",
  scopeCovered: "All routine & identified non-routine activities across Skyline's fabrication, surface-treatment, assembly and support processes at Chakan, Pune",
  riskMethodology: "5 x 5 matrix — Risk Score = Likelihood (L) x Severity (S), scored 1-5 each (max score 25)",
  validationStatus: "Draft / Pending EHS Validation",
  draftDisclaimer: "The Likelihood, Severity, existing controls and additional-control recommendations in this register are a professional DRAFT prepared from Skyline's process documents (Quality Manual, Process Control Plan, SOPs, Work Instructions) and general sheet-metal/surface-treatment industry knowledge — they have NOT been validated by an on-site walkthrough. Skyline's safety committee / EHS in-charge should review every row against actual site conditions, adjust L/S ratings and controls as needed, and formally approve before this is treated as the official HIRA.",
  hierarchyOfControls: [
    { level: 1, name: "Elimination", description: "Physically remove the hazard", effectiveness: "Most Effective", color: "#166534" },
    { level: 2, name: "Substitution", description: "Replace the hazard with a safer alternative", effectiveness: "High", color: "#15803d" },
    { level: 3, name: "Engineering Controls", description: "Isolate people from the hazard (guards, interlocks, ventilation)", effectiveness: "Moderate", color: "#b45309" },
    { level: 4, name: "Administrative Controls", description: "Change the way people work (SOPs, training, signage, permits)", effectiveness: "Low-Moderate", color: "#c2410c" },
    { level: 5, name: "PPE", description: "Protect the worker with Personal Protective Equipment (last line of defense)", effectiveness: "Last Line of Defense", color: "#b91c1c" }
  ],
  reviewTriggers: [
    "At least annually",
    "Immediately after any incident or near-miss",
    "When a new process, machine or chemical is introduced",
    "When legal or regulatory requirements change",
    "Following findings from an internal or certification-body audit",
    "Cross-reference with Skyline's separate Environmental & OH&S Legal Register (PESO, Fire NOC, MSIHC)"
  ],
  tbcItems: [
    { srNo: 24, activity: "Internal inspection/entry into fabricated fuel tank, if performed (Non-Routine)", department: "Diesel Tank Fabrication", reason: "Applicability depends on equipment/processes Skyline has installed; confined space entry risk requires validation." },
    { srNo: 27, activity: "Overhead crane / chain-hoist use for heavy fabrication parts, if installed (Routine)", department: "Fabrication / Assembly", reason: "Applicability depends on whether an overhead crane or hoist is installed in the bay." }
  ],
  likelihoodScale: [
    { score: 1, rating: "Rare", description: "May occur only in exceptional circumstances; not expected to occur" },
    { score: 2, rating: "Unlikely", description: "Could occur at some time; has happened elsewhere in the industry" },
    { score: 3, rating: "Possible", description: "Might occur at some time; occurs occasionally in similar operations" },
    { score: 4, rating: "Likely", description: "Will probably occur in most circumstances; has occurred before at this site" },
    { score: 5, rating: "Almost Certain", description: "Expected to occur in most circumstances; occurs frequently" }
  ],
  severityScale: [
    { score: 1, rating: "Negligible", description: "No injury, or first-aid only; no lost time" },
    { score: 2, rating: "Minor", description: "Minor injury / medical treatment case; no or minimal lost time (<1 day)" },
    { score: 3, rating: "Moderate", description: "Injury requiring medical treatment; lost-time injury; fully reversible" },
    { score: 4, rating: "Major", description: "Serious injury/illness, permanent partial disability; major property/environmental damage" },
    { score: 5, rating: "Catastrophic", description: "Fatality or multiple fatalities; irreversible disability; major fire/explosion/release" }
  ],
  riskBands: [
    { band: "1 - 4", level: "Low", interpretation: "Acceptable — monitor; no immediate additional action required", color: "#16a34a" },
    { band: "5 - 9", level: "Medium", interpretation: "Tolerable — additional controls to be considered and planned", color: "#ca8a04" },
    { band: "10 - 14", level: "High", interpretation: "Action required — implement additional controls promptly", color: "#ea580c" },
    { band: "15 - 25", level: "Very High", interpretation: "Immediate action required — consider stopping the activity until controls are implemented", color: "#dc2626" }
  ],
  importedAt: new Date().toISOString(),
  sourceWorkbook: "Skyline_HIRA_Register 1.xlsx"
};

async function seedHira() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log("Connected to MongoDB Atlas!");

  const targetDbs = ["Skyline_Project_Engineers", "skyms"];

  for (const dbName of targetDbs) {
    const db = client.db(dbName);
    console.log(`\n--- Seeding into Database: "${dbName}" ---`);

    const hiraCollection = db.collection("hira");
    const metaCollection = db.collection("hira_metadata");

    // Upsert metadata
    await metaCollection.updateOne(
      { docId: metadataDoc.docId },
      { $set: metadataDoc },
      { upsert: true }
    );
    console.log(`✓ Saved HIRA metadata into "${dbName}.hira_metadata"`);

    // Prepare records
    let inserted = 0;
    let updated = 0;

    for (const rec of rawRecords) {
      const hiraId = `HIRA-${String(rec.srNo).padStart(3, "0")}`;
      
      const doc = {
        hiraId,
        srNo: rec.srNo,
        department: rec.department,
        activity: rec.activity,
        hazardCategory: rec.hazardCategory,
        hazardDescription: rec.hazardDescription,
        potentialConsequence: rec.potentialConsequence,
        existingControls: rec.existingControls,
        existingLikelihood: rec.existingLikelihood,
        existingSeverity: rec.existingSeverity,
        existingRiskScore: rec.existingLikelihood * rec.existingSeverity,
        existingRiskLevel: rec.existingRiskLevel,
        additionalControls: rec.additionalControls,
        responsiblePersonDept: rec.responsiblePersonDept,
        targetTimeframe: rec.targetTimeframe,
        residualLikelihood: rec.residualLikelihood,
        residualSeverity: rec.residualSeverity,
        residualRiskScore: rec.residualLikelihood * rec.residualSeverity,
        residualRiskLevel: rec.residualRiskLevel,
        actionStatus: rec.actionStatus || "Open",
        isTbc: !!rec.isTbc,
        sourceFile: "Skyline_HIRA_Register 1.xlsx",
        sourceSrNo: rec.srNo,
        validationStatus: "Draft / Pending EHS Validation",
        formulas: {
          existingRiskScoreFormula: rec.existingRiskScoreFormula || null,
          existingRiskLevelFormula: rec.existingRiskLevelFormula || null,
          residualRiskScoreFormula: rec.residualRiskScoreFormula || null,
          residualRiskLevelFormula: rec.residualRiskLevelFormula || null
        },
        actionTracking: {
          assignedTo: rec.responsiblePersonDept,
          targetTimeframe: rec.targetTimeframe,
          targetDate: null,
          actualCompletionDate: rec.actionStatus === "Closed" ? "2026-08-17" : null,
          completionEvidence: null,
          progressRemarks: rec.actionStatus === "Closed" ? "Existing control measure active per calibration schedule" : null,
          auditTrail: [
            {
              changedBy: "System Import",
              changeDate: new Date().toISOString(),
              previousStatus: null,
              newStatus: rec.actionStatus || "Open",
              remarks: "Imported from Skyline_HIRA_Register 1.xlsx"
            }
          ]
        },
        updatedAt: new Date().toISOString()
      };

      const res = await hiraCollection.updateOne(
        { $or: [{ srNo: rec.srNo }, { hiraId: hiraId }] },
        {
          $set: doc,
          $setOnInsert: { createdAt: new Date().toISOString() }
        },
        { upsert: true }
      );

      if (res.upsertedCount > 0) inserted++;
      else updated++;
    }

    console.log(`✓ Processed ${rawRecords.length} records in "${dbName}.hira": ${inserted} inserted, ${updated} updated.`);

    const count = await hiraCollection.countDocuments({ sourceFile: "Skyline_HIRA_Register 1.xlsx" });
    console.log(`✓ Total HIRA records from workbook in "${dbName}.hira": ${count}`);
  }

  await client.close();
  console.log("\nAll MongoDB Atlas HIRA data seeded and verified successfully!");
}

seedHira().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
