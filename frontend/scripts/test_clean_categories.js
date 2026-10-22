const fs = require("fs");
const path = require("path");

const db = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/db.json"), "utf8"));

const DAY_MS = 86_400_000;
function parseDate(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,3})/);
  if (m) {
    const yr = Number(m[3]);
    const fullYear = yr === 26 || yr === 226 ? 2026 : yr < 50 ? 2000 + yr : 1900 + yr;
    return new Date(Date.UTC(fullYear, Number(m[2]) - 1, Number(m[1])));
  }
  return null;
}
function addInterval(date, interval) {
  if (interval.months) {
    const total = date.getUTCMonth() + interval.months;
    const year = date.getUTCFullYear() + Math.floor(total / 12);
    const month = ((total % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
  }
  return new Date(date.getTime() + (interval.days ?? 0) * DAY_MS);
}
function parseInterval(text) {
  const s = String(text ?? "").trim().toLowerCase();
  if (!s || /as required|on demand|n\/?a|not applicable/.test(s)) return null;
  const num = s.match(/(\d+(?:\.\d+)?)\s*[- ]?\s*(day|d\b|week|wk|month|mth|mo\b|year|yr)/);
  if (num) {
    const n = Number(num[1]);
    const unit = num[2];
    if (n > 0) {
      if (unit.startsWith("d")) return { days: n };
      if (unit.startsWith("w")) return { days: n * 7 };
      if (unit.startsWith("m")) return { months: n };
      return { months: n * 12 };
    }
  }
  return { months: 6 };
}
const daysBetween = (a, b) => Math.round((a.getTime() - b.getTime()) / DAY_MS);

const now = new Date(Date.UTC(2026, 9, 17));

const alerts = [];

// 1. Checklist Defects -> DUE
for (const cr of db.checklistRecords || []) {
  const resp = String(cr.response || cr.status || "").trim();
  if (/not ok|fail|defect/i.test(resp)) {
    alerts.push({
      id: `NTF-CHK-${cr.recordId}`,
      categoryType: "due",
      type: "Checklist Defect",
      machine: cr.machineName || cr.assetId,
      message: `Inspection defect reported as "${resp}" on checkpoint: ${cr.checkPointName || "Inspection item"}`,
      status: "Overdue Action",
      priority: "Critical",
      daysLeft: -2,
    });
  }
}

// 2. Open Safety Records -> PENDING
for (const s of db.safetyRecords || []) {
  if (!s.recordId || /closed|resolved|completed/i.test(s.status || "")) continue;
  const target = parseDate(s.targetDate);
  const raised = parseDate(s.date);
  const isOverdue = target && target < now;
  alerts.push({
    id: `NTF-SAF-${s.recordId}`,
    categoryType: isOverdue ? "due" : "pending",
    type: "Safety Observation",
    machine: s.machineName || s.assetId,
    message: `Safety action on ${s.machineName || s.assetId}: ${s.observation || s.safetyType || "Safety observation"}`,
    status: isOverdue ? "Overdue Target" : (s.status || "Pending Review"),
    priority: /high|critical/i.test(s.riskLevel || "") ? "High" : "Medium",
    daysLeft: target ? daysBetween(target, now) : null,
  });
}

// 3. Low stock spare parts -> PENDING
for (const p of db.pmParts || []) {
  const item = p["Part Name"] || p["Item / Part Name"] || "";
  const stock = Number(p["Quantity"] || p["Stock Quantity"] || 99);
  const minStock = Number(p["Min Quantity"] || p["Min Qty"] || 15);
  if (stock <= minStock) {
    alerts.push({
      id: `NTF-STK-${p["Part ID"] || item}`,
      categoryType: "pending",
      type: "Low Stock Inventory",
      machine: p["Machine / Asset"] || "Inventory Stores",
      message: `Critical spare part "${item}" low on stock: ${stock} remaining (Min: ${minStock})`,
      status: "Pending Reorder",
      priority: stock <= 5 ? "Critical" : "High",
      daysLeft: 0,
    });
  }
}

// 4. PM Frequency Machines -> UPCOMING or DUE
for (const m of db.machines || []) {
  const asset = m["Asset ID"];
  const freq = parseInterval(m["PM Frequency"]);
  if (freq && asset) {
    const install = parseDate(m["Installation Date"]) ?? now;
    let d = install;
    while (d < now) {
      d = addInterval(d, freq);
    }
    const days = daysBetween(d, now);
    alerts.push({
      id: `NTF-PMM-${asset}`,
      categoryType: days <= 0 ? "due" : "upcoming",
      type: "PM Schedule Due",
      machine: m["Machine Name"] || asset,
      message: `Preventive maintenance scheduled for ${m["Machine Name"]} (Frequency: ${m["PM Frequency"]})`,
      status: days <= 0 ? "Due Today" : `Due in ${days}d`,
      priority: /high|critical/i.test(m.Criticality || "") ? "High" : "Medium",
      daysLeft: days,
    });
  }
}

// 5. PM Parts Replacement Due -> UPCOMING
for (const p of db.pmParts || []) {
  const item = p["Part Name"] || p["Item / Part Name"] || "";
  const due = parseDate(p["Expiry / Due Date"] || p["AMC Expiry"] || p.dueDate);
  if (due) {
    const days = daysBetween(due, now);
    if (days > 0 && days <= 180) {
      alerts.push({
        id: `NTF-PRT-${p["Part ID"] || item}`,
        categoryType: "upcoming",
        type: /amc/i.test(item) ? "AMC Renewal" : "Component Replacement",
        machine: p["Machine / Asset"] || "Equipment Asset",
        message: `${item} replacement/inspection due in ${days} days (${due.toISOString().split("T")[0]})`,
        status: `Due in ${days}d`,
        priority: "Medium",
        daysLeft: days,
      });
    }
  }
}

const due = alerts.filter(a => a.categoryType === "due");
const pending = alerts.filter(a => a.categoryType === "pending");
const upcoming = alerts.filter(a => a.categoryType === "upcoming");

console.log("TOTAL ALERTS:", alerts.length);
console.log("DUE COUNT:", due.length);
console.log("PENDING COUNT:", pending.length);
console.log("UPCOMING COUNT:", upcoming.length);
