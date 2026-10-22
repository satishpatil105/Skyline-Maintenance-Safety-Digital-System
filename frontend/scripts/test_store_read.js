const path = require("path");
const fs = require("fs");

async function testRead() {
  const dbPath = path.join(__dirname, "../data/db.json");
  const raw = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  console.log("Raw notifications in db.json:", raw.notifications ? raw.notifications.length : 0);

  // Test what normalizeKey does
  function normalizeKey(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  }

  const tabName = "8. Notifications";
  const sheetName = "notifications";
  console.log("normalizeKey(tabName):", normalizeKey(tabName));
  console.log("normalizeKey(sheetName):", normalizeKey(sheetName));
  console.log("match test:", normalizeKey(sheetName).includes("notif") && normalizeKey(tabName).includes("notif"));
}

testRead().catch(console.error);
