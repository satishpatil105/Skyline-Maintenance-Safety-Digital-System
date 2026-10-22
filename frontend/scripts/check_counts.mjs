import { MongoClient } from "mongodb";

const uri = "mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0";

async function checkDocs() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("Skyline_Project_Engineers");
  const total = await db.collection("hira").countDocuments();
  const fromWorkbook = await db.collection("hira").countDocuments({ sourceFile: "Skyline_HIRA_Register 1.xlsx" });
  console.log(`Total docs in hira: ${total}, from workbook: ${fromWorkbook}`);
  
  // Show non-workbook docs
  const legacy = await db.collection("hira").find({ sourceFile: { $ne: "Skyline_HIRA_Register 1.xlsx" } }).toArray();
  console.log(`Legacy docs preserved: ${legacy.length}`);
  await client.close();
}

checkDocs();
