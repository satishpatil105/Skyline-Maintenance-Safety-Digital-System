import { MongoClient } from "mongodb";

const uri = "mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("Skyline_Project_Engineers");
  
  const hiraDocs = await db.collection("hira").find({}).toArray();
  console.log(`Found ${hiraDocs.length} docs in "hira":`);
  console.log(JSON.stringify(hiraDocs.slice(0, 3), null, 2));

  await client.close();
}

main().catch(console.error);
