const path = require("path");
const fs = require("fs");

async function testApply() {
  const dbPath = path.join(__dirname, "../data/db.json");
  const raw = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  console.log("Existing notifications in db.json:", raw.notifications ? raw.notifications.length : 0);

  // Check how many candidates collectCandidates would generate
  const { today, parseDate, addInterval, parseInterval, daysBetween, formatIso, formatDisplay, formatCompact } = require("../lib/alertDates");
}
testApply().catch(console.error);
