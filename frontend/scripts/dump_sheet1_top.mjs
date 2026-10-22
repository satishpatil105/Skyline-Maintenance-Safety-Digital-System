import fs from "fs";

const raw = fs.readFileSync("scripts/hira_pristine_workbook.json", "utf-8");
const sheets = JSON.parse(raw);
const sheet1 = sheets[0];

sheet1.rows.slice(0, 16).forEach(r => {
  const textValues = r.cells.filter(c => c.value !== null && c.value !== undefined).map(c => `[C${c.col}]: ${String(c.value).replace(/\n/g, ' ')}`);
  if (textValues.length > 0) {
    console.log(`Row ${r.rowNumber}: ${textValues.join(' | ')}`);
  }
});
