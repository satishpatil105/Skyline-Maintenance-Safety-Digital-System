const { MongoClient } = require("mongodb");
const ExcelJS = require("exceljs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const possiblePaths = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, ".env"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "backend", ".env"),
    path.join(process.cwd(), "frontend", ".env")
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

let rawUri = process.env.MONGODB_URI || "mongodb://localhost:27017/skyms";
let uri = rawUri.trim();
if (uri.includes("/Skyline Maintenance & Safety")) {
  uri = uri.replace("/Skyline Maintenance & Safety", "");
}

const maskedUri = uri.replace(/(mongodb\+srv:\/\/[^:]+:)([^@]+)(@.+)/, "$1******$3");

function normalizeVal(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  if (typeof v === "object") {
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    if (v.richText) return v.richText.map(rt => rt.text || "").join("").trim();
  }
  return String(v).trim();
}

async function importUsersOnly() {
  console.log("================================================================================");
  console.log("             SKYMS — IMPORT USERS TABLE DATA ONLY (MONGODB)                     ");
  console.log("================================================================================");
  console.log(`Target Cluster:  ${maskedUri}`);
  console.log(`Target Database: skyms`);
  console.log(`Target Collection: users ONLY\n`);

  const candidateDirs = [
    "C:\\Users\\ADMIN\\OneDrive\\Desktop\\data",
    path.resolve(__dirname, "..", "data"),
    path.resolve(process.cwd(), "backend", "data"),
    path.resolve(process.cwd(), "data")
  ];

  const userMap = new Map();
  let foundSources = 0;

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith(".xlsx") || f.endsWith(".xls") || f.endsWith(".xlsm"));
    for (const file of files) {
      const filePath = path.join(dir, file);
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.readFile(filePath);
        workbook.eachSheet((worksheet) => {
          const sName = worksheet.name.toLowerCase();
          if (sName.includes("user") || sName.includes("1.") || sName.includes("login") || sName.includes("admin")) {
            console.log(`✓ Found User Sheet: "${worksheet.name}" in [${file}]`);
            foundSources++;
            let headers = [];
            worksheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
              if (rowNum === 1) {
                headers = row.values.map(v => normalizeVal(v)).filter(Boolean);
              } else {
                const rowData = {};
                let hasVal = false;
                row.values.forEach((val, idx) => {
                  const h = headers[idx - 1];
                  if (h) {
                    const clean = normalizeVal(val);
                    rowData[h] = clean;
                    if (clean !== "") hasVal = true;
                  }
                });

                if (hasVal) {
                  const email = rowData["Login Email"] || rowData["Email"] || rowData["User ID"] || rowData["email"] || "";
                  const name = rowData["Full Name"] || rowData["Name"] || rowData["name"] || "";
                  const role = rowData["Role"] || rowData["role"] || "Technician";
                  const department = rowData["Department"] || rowData["Department / Machine"] || rowData["department"] || "";
                  const mobile = rowData["Mobile Number"] || rowData["Mobile"] || rowData["Phone"] || "";
                  const shift = rowData["Shift"] || rowData["shift"] || "General";
                  const designation = rowData["Designation"] || rowData["designation"] || role;
                  const status = rowData["Status"] || rowData["Active"] || "Active";
                  const password = rowData["Password (Encrypted)"] || rowData["Password"] || rowData["password"] || "Skyline@123";
                  const createdDate = rowData["Created Date"] || rowData["Date"] || new Date().toISOString().split("T")[0];

                  const cleanFirstName = (name || "user").trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
                  const defaultEmail = cleanFirstName ? `${cleanFirstName}@gmail.com` : "user@gmail.com";
                  const userId = rowData["User ID"] || rowData["userId"] || rowData["Emp ID"] || "";

                  const key = userId.toLowerCase() || email.toLowerCase() || name.toLowerCase();
                  if (key) {
                    userMap.set(key, {
                      "User ID": userId,
                      "Login Email": email || defaultEmail,
                      Name: name,
                      Role: role,
                      "Department / Machine": department,
                      Mobile: mobile,
                      Shift: shift,
                      Designation: designation,
                      Active: status.toLowerCase().includes("inact") ? "No" : "Yes",
                      "Password Hash": password,
                      "Created Date": createdDate,
                      rawExcelData: rowData,
                      sourceFile: file,
                      sourceSheet: worksheet.name,
                      importedAt: new Date().toISOString()
                    });
                  }
                }
              }
            });
          }
        });
      } catch (err) {
        console.warn(`[WARN] Reading ${file}: ${err.message}`);
      }
    }

    // Also check db.json if exists
    const dbJsonPath = path.join(dir, "db.json");
    if (fs.existsSync(dbJsonPath)) {
      try {
        const dbJson = JSON.parse(fs.readFileSync(dbJsonPath, "utf-8"));
        if (dbJson.users && Array.isArray(dbJson.users)) {
          console.log(`✓ Found users in db.json (${dbJson.users.length} records)`);
          dbJson.users.forEach(u => {
            const userId = u["User ID"] || u.userId || "";
            const email = u["Login Email"] || u.email || "";
            const name = u["Full Name"] || u["Name"] || u.name || "";
            const cleanFirstName = (name || "user").trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
            const defaultEmail = cleanFirstName ? `${cleanFirstName}@gmail.com` : "user@gmail.com";
            const key = userId.toLowerCase() || email.toLowerCase() || name.toLowerCase();
            if (key && !userMap.has(key)) {
              userMap.set(key, {
                "User ID": userId,
                "Login Email": email || defaultEmail,
                Name: name,
                Role: u["Role"] || u.role || "Technician",
                "Department / Machine": u["Department"] || u.department || "",
                Mobile: u["Mobile"] || u.mobile || "",
                Shift: u["Shift"] || u.shift || "General",
                Designation: u["Designation"] || u.designation || u["Role"] || "Technician",
                Active: (u["Status"] || u.status || "Active").toLowerCase().includes("inact") ? "No" : "Yes",
                "Password Hash": u["Password (Encrypted)"] || u.password || "Skyline@123",
                "Created Date": u["Created Date"] || new Date().toISOString().split("T")[0],
                sourceFile: "db.json",
                sourceSheet: "users",
                importedAt: new Date().toISOString()
              });
            }
          });
        }
      } catch (e) { }
    }
  }

  const userDocs = Array.from(userMap.values());
  console.log(`\nTotal Unique Users Extracted from Excel: ${userDocs.length}`);

  if (userDocs.length === 0) {
    console.error("No user records found in source files!");
    return;
  }

  // Connect to MongoDB Atlas
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✓ Connected to MongoDB Atlas successfully!");

    const db = client.db("skyms");
    const usersCollection = db.collection("users");

    // Clean existing users collection to ensure accurate fresh import
    await usersCollection.deleteMany({});
    console.log("✓ Cleared previous records in 'users' collection.");

    // Insert only user documents
    const result = await usersCollection.insertMany(userDocs);
    console.log(`✓ Successfully inserted ${result.insertedCount} users into collection [users]!\n`);

    // Ensure Indexes
    await usersCollection.createIndex({ "User ID": 1 }, { unique: true, sparse: true });
    await usersCollection.createIndex({ "Login Email": 1 }, { unique: true, sparse: true });
    await usersCollection.createIndex({ Role: 1 });
    await usersCollection.createIndex({ Active: 1 });
    console.log("✓ Indexes created on [users] collection.");

    // Audit and verify all collections in database
    console.log("\n================================================================================");
    console.log("                DATABASE AUDIT: USER IMPORT VERIFICATION REPORT                 ");
    console.log("================================================================================");

    const allCollections = await db.listCollections().toArray();
    console.log(String("COLLECTION NAME").padEnd(28) + " | " + String("DOCUMENTS").padEnd(12) + " | " + "STATUS");
    console.log("--------------------------------------------------------------------------------");

    for (const c of allCollections) {
      const col = db.collection(c.name);
      const count = await col.countDocuments();
      let status = "0 (EMPTY)";
      if (c.name === "users") {
        status = `✓ ${count} USERS INSERTED`;
      }
      console.log(
        String(c.name).padEnd(28) + " | " +
        String(count).padEnd(12) + " | " +
        status
      );
    }
    console.log("================================================================================");

    console.log("\nIMPORTED USERS LIST:");
    console.log("--------------------------------------------------------------------------------");
    userDocs.forEach((u, i) => {
      console.log(`${(i + 1).toString().padStart(2, "0")}. Name: ${u.name.padEnd(22)} | Role: ${u.role.padEnd(15)} | Dept: ${u.department.padEnd(18)} | Email: ${u.email}`);
    });
    console.log("--------------------------------------------------------------------------------\n");
    console.log(">>> SUCCESS: ONLY the 'users' table has been populated in database 'skyms'. <<<");

  } catch (err) {
    console.error("Error during user import:", err.message);
  } finally {
    await client.close();
  }
}

importUsersOnly();
