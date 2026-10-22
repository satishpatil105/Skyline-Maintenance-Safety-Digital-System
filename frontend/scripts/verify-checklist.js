const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function getUri() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      if (line.startsWith("MONGODB_URI=")) {
        return line.replace("MONGODB_URI=", "").trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.MONGODB_URI;
}

async function verify() {
  const uri = getUri();
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("Skyline_Project_Engineers");
    
    const machines = await db.collection("machines").find({}).toArray();
    console.log(`Total machines in Machine Master: ${machines.length}`);
    
    const checklists = await db.collection("checklist_master").find({}).toArray();
    console.log(`Total checklists in Checklist Master: ${checklists.length}`);
    
    const checklistAssetIds = new Set(checklists.map(c => c["Asset ID"]));
    
    console.log("\nMachine Master Asset IDs & Checklist Coverage:");
    let missing = 0;
    for (const m of machines) {
      const assetId = m["Asset ID"] || m["assetId"] || m["id"];
      const count = checklists.filter(c => c["Asset ID"] === assetId).length;
      console.log(`- [${assetId}] ${m["Machine Name"] || m["name"]} (${m["Category"] || m["category"]}): ${count} checkpoints`);
      if (count === 0) {
        missing++;
      }
    }
    
    console.log(`\nMachines without direct specific checklist: ${missing}`);
    
    // Check "ALL" checklist points
    const universalCount = checklists.filter(c => c["Asset ID"] === "ALL").length;
    console.log(`Universal ('ALL') checkpoints: ${universalCount}`);
    
  } finally {
    await client.close();
  }
}

verify().catch(console.error);
