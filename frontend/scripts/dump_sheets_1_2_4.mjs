import fs from "fs";

const raw = fs.readFileSync("scripts/hira_pristine_workbook.json", "utf-8");
const sheets = JSON.parse(raw);

[0, 1, 3].forEach(idx => {
  const sheet = sheets[idx];
  console.log(`\n======================================================`);
  console.log(`FULL DUMP OF SHEET ${idx + 1}: "${sheet.name}"`);
  console.log(`======================================================`);
  sheet.rows.forEach(r => {
    const textValues = r.cells.filter(c => c.value !== null && c.value !== undefined).map(c => `[C${c.col}]: ${String(c.value).replace(/\n/g, ' ')}`);
    if (textValues.length > 0) {
      console.log(`Row ${r.rowNumber}: ${textValues.join(' | ')}`);
    }
  });
});
