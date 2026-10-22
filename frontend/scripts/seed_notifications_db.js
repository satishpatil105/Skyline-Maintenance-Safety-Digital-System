const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../data/db.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

const DEFAULT_NOTIF_HEADERS = [
  "Notification ID",
  "Date",
  "Notification Type",
  "Asset ID",
  "Machine / Equipment",
  "Message",
  "Priority",
  "Assigned To",
  "Status",
  "Due Date",
  "Created By",
  "Closed Date",
  "Remarks",
  "Created At",
  "Last Updated",
];

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
const formatIso = (d) => d.toISOString().split("T")[0];

const now = new Date(Date.UTC(2026, 9, 17));
const stamp = new Date().toISOString();

const notifs = [];

// 1. Checklist defects (DUE)
for (const cr of db.checklistRecords || []) {
  const resp = String(cr.response || cr.status || "").trim();
  if (/not ok|fail|defect/i.test(resp)) {
    const d = parseDate(cr.date) ?? now;
    const days = daysBetween(d, now);
    notifs.push({
      "Notification ID": `NTF-CHKDEF-${cr.assetId || "CHK"}-${formatIso(d).replace(/-/g, "")}`,
      "Date": formatIso(d),
      "Notification Type": "Checklist Due",
      "Asset ID": cr.assetId || "",
      "Machine / Equipment": cr.machineName || cr.assetId || "Punching Machine",
      "Message": `Checklist defect reported on ${cr.machineName || cr.assetId}: "${cr.checkPointName || cr.checkpoint || "Inspection Point"}" reported Not OK`,
      "Priority": "Critical",
      "Assigned To": "Sidharth Bachate",
      "Status": days < 0 ? `Overdue by ${-days}d` : "Due Today",
      "Due Date": formatIso(d),
      "Created By": "System Auto-Sync",
      "Closed Date": "",
      "Remarks": `Auto-generated from Checklist defect ${cr.recordId}`,
      "Created At": cr.createdAt || stamp,
      "Last Updated": stamp,
    });
  }
}

// 2. Open Safety records (PENDING & DUE)
for (const s of db.safetyRecords || []) {
  if (!s.recordId || /closed|resolved|completed/i.test(s.status || "")) continue;
  const target = parseDate(s.targetDate);
  const raised = parseDate(s.date) ?? now;
  const due = target ?? addInterval(raised, { days: 14 });
  const days = daysBetween(due, now);
  const isOverdue = days < 0;

  notifs.push({
    "Notification ID": `NTF-SAF-${s.recordId}-${formatIso(due).replace(/-/g, "")}`,
    "Date": formatIso(raised),
    "Notification Type": "Safety Action Due",
    "Asset ID": s.assetId || "",
    "Machine / Equipment": s.machineName || s.assetId || "Plant Wide",
    "Message": `Safety observation on ${s.machineName || "Plant Floor"}: ${s.observation || s.safetyType || "Safety observation"}`,
    "Priority": /high|critical/i.test(s.riskLevel || "") ? "High" : "Medium",
    "Assigned To": s.assignedTo || "Plant Supervisor",
    "Status": isOverdue ? `Overdue by ${-days}d` : "Pending Action",
    "Due Date": formatIso(due),
    "Created By": "System Auto-Sync",
    "Closed Date": "",
    "Remarks": `Auto-generated from Safety record ${s.recordId}`,
    "Created At": s.date || stamp,
    "Last Updated": stamp,
  });
}

// 3. Low stock spare parts (PENDING)
for (const p of db.pmParts || []) {
  const item = p["Part Name"] || p["Item / Part Name"] || "";
  const stock = Number(p["Quantity"] || p["Stock Quantity"] || 99);
  const minStock = Number(p["Minimum Reorder Level"] || p["Min Quantity"] || p["Min Qty"] || 10);
  if (stock <= minStock) {
    notifs.push({
      "Notification ID": `NTF-STK-${p["Part ID"] || item.replace(/\s+/g, "")}`,
      "Date": formatIso(now),
      "Notification Type": "Maintenance Pending",
      "Asset ID": p["Asset ID"] || "",
      "Machine / Equipment": p["Machine / Asset"] || p["Machine Model"] || "Plant Inventory",
      "Message": `Low spare part stock for ${p["Machine / Asset"] || "Equipment"}: "${item}" has ${stock} units remaining (min required: ${minStock})`,
      "Priority": stock <= 5 ? "Critical" : "High",
      "Assigned To": p["Vendor / AMC"] || "Stores Department",
      "Status": "Pending Reorder",
      "Due Date": formatIso(now),
      "Created By": "System Auto-Sync",
      "Closed Date": "",
      "Remarks": `Auto-generated from PM Parts Inventory`,
      "Created At": stamp,
      "Last Updated": stamp,
    });
  }
}

// 4. Machine PM Frequency (UPCOMING)
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
    notifs.push({
      "Notification ID": `NTF-PMM-${asset}-${formatIso(d).replace(/-/g, "")}`,
      "Date": formatIso(now),
      "Notification Type": "PM Due",
      "Asset ID": asset,
      "Machine / Equipment": m["Machine Name"] || asset,
      "Message": `Preventive maintenance scheduled for ${m["Machine Name"]} (frequency: ${m["PM Frequency"]}) is due in ${days} days`,
      "Priority": /high|critical/i.test(m.Criticality || "") ? "High" : "Medium",
      "Assigned To": m["Responsible Person"] || "Maintenance Head",
      "Status": days <= 0 ? "Due Today" : `Due in ${days}d`,
      "Due Date": formatIso(d),
      "Created By": "System Auto-Sync",
      "Closed Date": "",
      "Remarks": `Auto-generated from Machine Master PM Frequency`,
      "Created At": stamp,
      "Last Updated": stamp,
    });
  }
}

// 5. PM Parts Component Replacement (UPCOMING)
for (const p of db.pmParts || []) {
  const item = p["Part Name"] || p["Item / Part Name"] || "";
  const due = parseDate(p["Expiry / Due Date"] || p["AMC Expiry"] || p.dueDate);
  if (due) {
    const days = daysBetween(due, now);
    if (days > 0 && days <= 180) {
      notifs.push({
        "Notification ID": `NTF-PRTDUE-${p["Part ID"] || item.replace(/\s+/g, "")}-${formatIso(due).replace(/-/g, "")}`,
        "Date": formatIso(now),
        "Notification Type": /amc/i.test(item) ? "AMC Expiry" : "PM Due",
        "Asset ID": p["Asset ID"] || "",
        "Machine / Equipment": p["Machine / Asset"] || p["Machine Model"] || "Plant Machinery",
        "Message": `${item} for ${p["Machine / Asset"] || "Equipment"} is due on ${formatIso(due)} (in ${days} days)`,
        "Priority": "Medium",
        "Assigned To": p["Vendor / AMC"] || "Maintenance Team",
        "Status": `Due in ${days}d`,
        "Due Date": formatIso(due),
        "Created By": "System Auto-Sync",
        "Closed Date": "",
        "Remarks": `Auto-generated from PM Parts Register`,
        "Created At": stamp,
        "Last Updated": stamp,
      });
    }
  }
}

db.notifications = notifs;
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");

console.log(`Successfully seeded db.json with ${notifs.length} notifications!`);
const due = notifs.filter(n => /overdue|due today/i.test(n.Status) || /defect/i.test(n["Notification Type"]));
const pending = notifs.filter(n => /pending/i.test(n.Status));
const upcoming = notifs.filter(n => /due in/i.test(n.Status) && !/overdue/i.test(n.Status));
console.log(`Summary: Due: ${due.length}, Pending: ${pending.length}, Upcoming: ${upcoming.length}`);
