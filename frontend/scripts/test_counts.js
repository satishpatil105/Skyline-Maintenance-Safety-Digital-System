const fs = require("fs");
const path = require("path");

const db = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/db.json"), "utf8"));

// Import compiled or transpile test
console.log("Checking candidate conditions:");

// 1. Machine Master: PM frequency
let pmCount = 0;
for (const m of db.machines) {
  if (m["PM Frequency"]) {
    pmCount++;
    console.log(`PM Machine: ${m["Asset ID"]} (${m["Machine Name"]}), freq: ${m["PM Frequency"]}`);
  }
}
console.log("PM frequency machines count:", pmCount);

// 2. Checklist records: defects
let defectCount = 0;
for (const cr of (db.checklistRecords || [])) {
  const resp = String(cr.response || cr.status || "").trim();
  if (/^(not ok|fail|failed|no)$/i.test(resp)) {
    defectCount++;
    console.log(`Checklist defect: ${cr.recordId} on ${cr.machineName || cr.assetId}, resp: ${resp}, date: ${cr.date}`);
  }
}
console.log("Checklist defects count:", defectCount);

// 3. Safety records
let openSafetyCount = 0;
for (const r of (db.safetyRecords || [])) {
  const status = String(r.status || "").trim();
  if (status && !/^(closed|resolved|completed)$/i.test(status)) {
    openSafetyCount++;
    console.log(`Open safety: ${r.recordId} on ${r.machineName || r.assetId}, status: ${status}, risk: ${r.riskLevel}, targetDate: ${r.targetDate}, date: ${r.date}`);
  }
}
console.log("Open safety records count:", openSafetyCount);

// 4. PM Parts
let partCount = 0;
for (const p of (db.pmParts || [])) {
  const item = p["Part Name"] || p["Item / Part Name"] || "";
  const stock = Number(p["Quantity"] || p["Stock Quantity"] || 99);
  const minStock = Number(p["Min Quantity"] || p["Min Qty"] || 15);
  const due = p["Expiry / Due Date"] || p["AMC Expiry"] || p.dueDate;
  if (stock <= minStock || due) {
    partCount++;
    console.log(`PM Part: ${item}, stock: ${stock}/${minStock}, due: ${due}`);
  }
}
console.log("PM parts alerts count:", partCount);

// 5. Document Register
let docCount = 0;
for (const d of (db.documentRegister || [])) {
  const exp = d["Revision Date"] || d["Expiry Date"] || d.date;
  if (exp) {
    docCount++;
  }
}
console.log("Document register total with dates:", docCount);
