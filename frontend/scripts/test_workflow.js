const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

// Read .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  });
}

async function run() {
  const uri = process.env.MONGODB_URI;
  console.log("Connecting with MongoDB URI from .env.local...");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas database!");
    const db = client.db(process.env.MONGODB_DB_NAME || "Skyline_Project_Engineers");

    // 1. Check maintenance_requests
    const reqCount = await db.collection("maintenance_requests").countDocuments();
    console.log("Total maintenance_requests in Atlas:", reqCount);

    // 2. Check maintenance_records
    const recCount = await db.collection("maintenance_records").countDocuments();
    console.log("Total maintenance_records in Atlas:", recCount);

    // 3. Check breakdowns
    const bdCount = await db.collection("breakdowns").countDocuments();
    console.log("Total breakdowns in Atlas:", bdCount);

    // 4. Check pm_schedules
    const pmCount = await db.collection("pm_schedules").countDocuments();
    console.log("Total pm_schedules in Atlas:", pmCount);

    // 5. Check amc_contracts
    const amcCount = await db.collection("amc_contracts").countDocuments();
    console.log("Total amc_contracts in Atlas:", amcCount);

    // 6. Check notifications
    const notifCount = await db.collection("notifications").countDocuments();
    console.log("Total notifications in Atlas:", notifCount);

    // Check machines
    const machinesCount = await db.collection("machines").countDocuments();
    console.log("Total machines in Atlas:", machinesCount);

    console.log("\nALL DATABASE COLLECTIONS ACCESSIBLE & VERIFIED!");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await client.close();
  }
}

run();
