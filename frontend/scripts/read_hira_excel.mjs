import ExcelJS from "exceljs";
import fs from "fs";

async function readHiraWorkbook() {
  const filePath = "C:\\Users\\ADMIN\\Downloads\\Skyline_HIRA_Register 1.xlsx";
  console.log("Reading workbook from:", filePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log(`Found ${workbook.worksheets.length} worksheets:`);
  
  const allSheetsData = [];

  workbook.eachSheet((worksheet, sheetId) => {
    console.log(`\n--- Sheet ${sheetId}: "${worksheet.name}" ---`);
    console.log(`Row count: ${worksheet.rowCount}, Col count: ${worksheet.columnCount}`);

    const sheetData = {
      id: sheetId,
      name: worksheet.name,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      rows: []
    };

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowValues = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let val = cell.value;
        let formula = cell.formula;
        let result = cell.result;
        
        // Handle rich text or object values
        if (val && typeof val === "object") {
          if (val.richText) {
            val = val.richText.map(t => t.text).join("");
          } else if (val.result !== undefined) {
            result = val.result;
            formula = val.formula;
            val = result;
          } else if (val.text) {
            val = val.text;
          }
        }

        rowValues.push({
          col: colNumber,
          address: cell.address,
          value: val,
          formula: formula,
          result: result,
          type: cell.type
        });
      });

      sheetData.rows.push({
        rowNumber,
        cells: rowValues
      });
    });

    allSheetsData.push(sheetData);
  });

  fs.writeFileSync("scripts/hira_pristine_workbook.json", JSON.stringify(allSheetsData, null, 2));
  console.log("\nSuccessfully saved all sheets to scripts/hira_pristine_workbook.json!");
}

readHiraWorkbook().catch(err => {
  console.error("Failed to read HIRA workbook:", err);
  process.exit(1);
});
