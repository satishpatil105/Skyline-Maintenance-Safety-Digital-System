import { MongoClient } from "mongodb";

const uri = "mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log("Connected to Atlas!");

  const adminDb = client.db().admin();
  const dbs = await adminDb.listDatabases();
  console.log("Databases in cluster:", dbs.databases.map(d => d.name));

  for (const dbInfo of dbs.databases) {
    if (["admin", "local"].includes(dbInfo.name)) continue;
    const db = client.db(dbInfo.name);
    const cols = await db.listCollections().toArray();
    console.log(`\nCollections in DB "${dbInfo.name}":`);
    for (const c of cols) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`  - ${c.name}: ${count} docs`);
    }
  }

  await client.close();
}

main().catch(console.error);
