import fs from "fs";

const raw = fs.readFileSync("scripts/hira_raw.txt", "utf-8");
console.log("Raw length:", raw.length);

const matches = raw.match(/\"[a-zA-Z]+\"\s*[\d"{\[]/g);
console.log("Potential missing colons:", matches);

// Check if raw ends with valid JSON
console.log("Raw ending 200 chars:", raw.substring(raw.length - 200));
