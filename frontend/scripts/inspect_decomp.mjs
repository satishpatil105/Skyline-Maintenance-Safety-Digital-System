import fs from "fs";

const raw = fs.readFileSync("scripts/hira_raw.txt", "utf-8");
console.log("Total length:", raw.length);

// Print sheet headers / names from the raw text
console.log("First 1000 chars:");
console.log(raw.substring(0, 1000));

// Find sheet names
const sheetNameMatches = [...raw.matchAll(/"name":\s*"([^"]+)"/g)];
console.log("Found sheets:", sheetNameMatches.map(m => m[1]));
