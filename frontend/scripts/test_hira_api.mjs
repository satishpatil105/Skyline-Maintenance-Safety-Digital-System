import fs from "fs";

async function testHiraApi() {
  console.log("Testing GET http://localhost:3000/api/hira ...");
  const res = await fetch("http://localhost:3000/api/hira");
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Success:", data.success);
  console.log("Total records returned:", data.records?.length);
  console.log("Summary:", JSON.stringify(data.summary, null, 2));
  console.log("Metadata docId:", data.metadata?.docId);
  console.log("First record:", data.records?.[0]?.activity, "| Risk Score:", data.records?.[0]?.existingRiskScore);
}

testHiraApi().catch(console.error);
