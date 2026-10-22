const path = require("path");
// Set up ts-node or run via compiled ts
const { readFileSync } = require("fs");

async function check() {
  const dbData = JSON.parse(readFileSync(path.join(__dirname, "../data/db.json"), "utf8"));
  console.log("Machines count:", dbData.machines?.length);
  console.log("Checklist records:", dbData.checklistRecords?.length);
  console.log("Safety records:", dbData.safetyRecords?.length);
  console.log("Maintenance records:", dbData.maintenanceRecords?.length);
  console.log("PM parts:", dbData.pmParts?.length);
  console.log("Documents:", dbData.documentRegister?.length);

  // Check machines with breakdown or non-running status
  const nonRunning = (dbData.machines || []).filter(m => {
    const s = String(m.Status || "").trim();
    return s && !/^(running|active|idle|standby|ok|operational)$/i.test(s);
  });
  console.log("Non-running machines:", nonRunning.map(m => ({ id: m["Asset ID"], name: m["Machine Name"], status: m.Status })));

  // Check safety records
  const openSafety = (dbData.safetyRecords || []).filter(s => !/^(closed|resolved|completed)$/i.test(String(s.status || "")));
  console.log("Open safety records:", openSafety.length, openSafety.map(s => ({ id: s.recordId, status: s.status, machine: s.machineName, date: s.date, targetDate: s.targetDate })));

  // Check checklist defect records
  const defects = (dbData.checklistRecords || []).filter(c => /not ok|defect|fail/i.test(String(c.response || c.status || "")));
  console.log("Defect checklist records:", defects.length, defects.map(d => ({ id: d.recordId, machine: d.machineName, checkpoint: d.checkpointName, response: d.response })));

  // Check PM frequency
  const pmMachines = (dbData.machines || []).filter(m => m["PM Frequency"]);
  console.log("PM frequency machines:", pmMachines.length, pmMachines.map(m => ({ id: m["Asset ID"], freq: m["PM Frequency"], amc: m["AMC Expiry"] })));
}

check().catch(console.error);
