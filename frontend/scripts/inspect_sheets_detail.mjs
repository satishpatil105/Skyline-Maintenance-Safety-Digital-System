import fs from "fs";

const raw = fs.readFileSync("scripts/hira_pristine_workbook.json", "utf-8");
const sheets = JSON.parse(raw);

console.log("=== DETAILED INSPECTION OF ALL 4 WORKSHEETS ===");

sheets.forEach((sheet, idx) => {
  console.log(`\n======================================================`);
  console.log(`SHEET ${idx + 1}: "${sheet.name}"`);
  console.log(`Rows: ${sheet.rowCount}, Cols: ${sheet.columnCount}, Non-empty row count: ${sheet.rows.length}`);
  console.log(`======================================================`);
  
  // Print first 5 rows and last 2 rows
  sheet.rows.slice(0, 10).forEach(r => {
    const textValues = r.cells.filter(c => c.value !== null && c.value !== undefined).map(c => `[C${c.col}]: ${String(c.value).replace(/\n/g, ' ')}`);
    if (textValues.length > 0) {
      console.log(`Row ${r.rowNumber}: ${textValues.join(' | ')}`);
    }
  });

  if (sheet.rows.length > 10) {
    console.log(`... (${sheet.rows.length - 12} intermediate rows omitted) ...`);
    sheet.rows.slice(-2).forEach(r => {
      const textValues = r.cells.filter(c => c.value !== null && c.value !== undefined).map(c => `[C${c.col}]: ${String(c.value).replace(/\n/g, ' ')}`);
      if (textValues.length > 0) {
        console.log(`Row ${r.rowNumber}: ${textValues.join(' | ')}`);
      }
    });
  }
});
