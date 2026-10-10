const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const possiblePaths = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, ".env"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "backend", ".env")
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

let rawUri = process.env.MONGODB_URI || "mongodb://localhost:27017/skyms";
let uri = rawUri.trim();
if (uri.includes("/Skyline Maintenance & Safety")) {
  uri = uri.replace("/Skyline Maintenance & Safety", "");
}

const maskedUri = uri.replace(/(mongodb\+srv:\/\/[^:]+:)([^@]+)(@.+)/, "$1******$3");

console.log("================================================================================");
console.log("             CLEAN-RESET MONGODB DATABASE [skyms]                               ");
console.log("================================================================================");
console.log(`Cluster: ${maskedUri}`);
console.log(`Database: skyms\n`);

async function cleanResetDatabase() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log(" Connected to MongoDB Atlas successfully!");

    const db = client.db("skyms");
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      console.log("\nDatabase 'skyms' has 0 collections currently (already clean).");
    } else {
      console.log(`\nFound ${collections.length} collection(s) to drop:\n`);
      for (const col of collections) {
        await db.collection(col.name).drop();
        console.log(` ✓ Dropped collection: [${col.name}]`);
      }
    }

    // Verify
    const remainingCollections = await db.listCollections().toArray();

    console.log("\n================================================================================");
    console.log("                        CLEAN-RESET VERIFICATION REPORT                         ");
    console.log("================================================================================");
    console.log(`Database:                skyms`);
    console.log(`Dropped Collections:     ${collections.length}`);
    console.log(`Remaining Collections:   ${remainingCollections.length}`);
    console.log(`Database Status:         CLEAN & READY FOR FRESH MIGRATION`);
    console.log("================================================================================");

    if (remainingCollections.length === 0) {
      console.log("VERIFICATION: SUCCESS (Collections = 0)");
    } else {
      console.warn("VERIFICATION WARNING: Some collections could not be dropped.");
    }
    console.log("================================================================================\n");

  } catch (err) {
    console.error("Clean-reset error:", err.message);
  } finally {
    await client.close();
  }
}

cleanResetDatabase();
