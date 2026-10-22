const fs = require("fs");
const path = require("path");

const db = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/db.json"), "utf8"));

// Implementation of date helpers from alertDates.ts
const DAY_MS = 86_400_000;
function utc(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}
function parseDate(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d])/);
  if (m) return utc(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?![\d])/);
  if (m) return utc(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,3})(?![\d])/);
  if (m) {
    const yr = Number(m[3]);
    const fullYear = yr === 26 || yr === 226 ? 2026 : yr < 50 ? 2000 + yr : 1900 + yr;
    return utc(fullYear, Number(m[2]), Number(m[1]));
  }
  return null;
}
const pad = (n) => String(n).padStart(2, "0");
const formatIso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const formatDisplay = (d) => `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
const formatCompact = (d) => formatIso(d).replace(/-/g, "");
const daysBetween = (a, b) => Math.round((a.getTime() - b.getTime()) / DAY_MS);

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
const WORDS = [
  [/half[\s-]?year|semi[\s-]?annual|six[\s-]?month/, { months: 6 }],
  [/quarter/, { months: 3 }],
  [/bi[\s-]?month/, { months: 2 }],
  [/fort[\s-]?night|bi[\s-]?week/, { days: 14 }],
  [/year|annual/, { months: 12 }],
  [/month/, { months: 1 }],
  [/week/, { days: 7 }],
  [/dai?ly|every ?day/, { days: 1 }],
];
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
  for (const [pattern, interval] of WORDS) if (pattern.test(s)) return interval;
  return null;
}

const now = new Date(Date.UTC(2026, 9, 17)); // 2026-10-17
console.log("Testing with now =", formatIso(now));

// Check candidates
const candidates = [];
const machineByAsset = new Map(
  db.machines.filter((m) => m["Asset ID"]).map((m) => [String(m["Asset ID"]).trim().toLowerCase(), m])
);
const machineName = (assetId, fallback = "") =>
  fallback || machineByAsset.get(assetId.toLowerCase())?.["Machine Name"] || assetId;

// 1. Checklist defects
const lastChecklist = new Map();
if (db.checklistRecords && Array.isArray(db.checklistRecords)) {
  for (const cr of db.checklistRecords) {
    const resp = String(cr.response || cr.status || "").trim();
    const d = parseDate(cr.date) ?? parseDate(cr.createdAt);
    if (!d) continue;
    const key = `${String(cr.assetId).toLowerCase()}|${String(cr.checklistId || cr.templateId || cr.recordId).toLowerCase()}`;
    const prev = lastChecklist.get(key);
    if (!prev || d >= prev.date) {
      lastChecklist.set(key, {
        date: d,
        response: resp,
        recordId: String(cr.recordId ?? ""),
        checkPoint: String(cr.checkPoint ?? "Shift Inspection Checkpoint"),
        assetId: String(cr.assetId ?? ""),
      });
    }
  }
}
for (const [key, item] of lastChecklist) {
  if (/^(not ok|fail|failed|no)$/i.test(item.response.trim())) {
    const machine = machineName(item.assetId);
    candidates.push({
      code: "CHKDEF",
      sourceId: `${item.assetId}-${item.recordId}`,
      type: "Checklist Due",
      assetId: item.assetId,
      machine,
      due: item.date,
      window: 999,
      days: daysBetween(item.date, now),
      critical: true,
      desc: `Checklist defect on ${machine}: reported ${item.response} on ${formatDisplay(item.date)}`,
    });
  }
}

// 2. Safety records
for (const r of db.safetyRecords || []) {
  if (!r.recordId || /closed|resolved|completed/i.test(r.status ?? "")) continue;
  const asset = String(r.assetId ?? "").trim();
  const machine = machineName(asset, r.machineName);
  const what = String(r.observation || r.safetyType || "Safety action").slice(0, 80);
  const target = parseDate(r.targetDate);
  const raised = parseDate(r.date) ?? parseDate(r.createdAt);
  const due = target ?? (raised ? addInterval(raised, { days: 7 }) : now);

  candidates.push({
    code: "SAF",
    sourceId: r.recordId,
    type: "Safety Action Due",
    assetId: asset,
    machine,
    due,
    window: target ? 60 : 999,
    days: daysBetween(due, now),
    critical: /critical|high/i.test(r.riskLevel ?? ""),
    desc: `Safety action on ${machine}: ${what} (Status: ${r.status})`,
  });
}

// 3. PM Parts
for (const p of db.pmParts || []) {
  const item = p["Part Name"] || p["Item / Part Name"] || "";
  if (!item || /closed|replaced/i.test(p.status || "")) continue;
  const due = parseDate(p["Expiry / Due Date"] || p["AMC Expiry"] || p.dueDate);
  const stock = Number(p["Quantity"] || p["Stock Quantity"] || 99);
  const minStock = Number(p["Min Quantity"] || p["Min Qty"] || 15);
  const asset = p["Asset ID"] || p.assetId || "";
  const machine = machineName(asset, p["Machine / Asset"] || p.machineName);

  if (stock <= minStock) {
    candidates.push({
      code: "STK",
      sourceId: p["Part ID"] || item,
      type: "Maintenance Pending",
      assetId: asset,
      machine,
      due: now,
      window: 999,
      days: 0,
      critical: stock <= 5,
      desc: `Low spare part stock for ${machine}: "${item}" has ${stock} units remaining (min required: ${minStock})`,
    });
  }

  if (due) {
    candidates.push({
      code: "PRTDUE",
      sourceId: p["Part ID"] || `${item}-${formatCompact(due)}`,
      type: /amc/i.test(item) ? "AMC Expiry" : "PM Due",
      assetId: asset,
      machine,
      due,
      window: 180,
      days: daysBetween(due, now),
      critical: false,
      desc: `${item} for ${machine} due on ${formatDisplay(due)}`,
    });
  }
}

// 4. Machine PM frequency
for (const m of db.machines) {
  const asset = String(m["Asset ID"] ?? "").trim();
  const machine = m["Machine Name"] || asset;
  const freq = parseInterval(m["PM Frequency"]);
  if (freq) {
    const install = parseDate(m["Installation Date"]) ?? parseDate(m["Created At"]);
    let due = install ?? now;
    if (install) {
      while (due < now && daysBetween(due, now) > 30) {
        due = addInterval(due, freq);
      }
    } else {
      due = addInterval(now, freq);
    }
    candidates.push({
      code: "PMM",
      sourceId: asset,
      type: "PM Due",
      assetId: asset,
      machine,
      due,
      window: 60,
      days: daysBetween(due, now),
      critical: /critical/i.test(m.Criticality ?? ""),
      desc: `Preventive maintenance for ${machine} (freq: ${m["PM Frequency"]})`,
    });
  }
}

console.log("Total candidates found:", candidates.length);
const dueItems = candidates.filter(c => c.days <= 0 || /defect|not ok|breakdown/i.test(c.type + " " + c.desc));
const pendingItems = candidates.filter(c => c.days === 0 || /pending|open|stock|stk|safety/i.test(c.type + " " + c.desc));
const upcomingItems = candidates.filter(c => c.days > 0);

console.log(`Due items: ${dueItems.length}`);
dueItems.slice(0, 5).forEach(c => console.log(`  [DUE] ${c.code} | ${c.machine} | ${c.desc} (days: ${c.days})`));

console.log(`Pending items: ${pendingItems.length}`);
pendingItems.slice(0, 5).forEach(c => console.log(`  [PENDING] ${c.code} | ${c.machine} | ${c.desc} (days: ${c.days})`));

console.log(`Upcoming items: ${upcomingItems.length}`);
upcomingItems.slice(0, 5).forEach(c => console.log(`  [UPCOMING] ${c.code} | ${c.machine} | ${c.desc} (days: ${c.days})`));
