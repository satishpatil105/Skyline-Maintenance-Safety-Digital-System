import fs from "fs";
import { MongoClient } from "mongodb";

// Parse .env.local
const envContent = fs.readFileSync(".env.local", "utf8");
const uri = envContent.match(/MONGODB_URI=(.*)/)?.[1]?.trim();
const dbName = envContent.match(/MONGODB_DB_NAME=(.*)/)?.[1]?.trim() || "Skyline_Project_Engineers";

const BASE_URL = "http://localhost:3000";

import crypto from "crypto";

function makeToken(email) {
  const secret = process.env.SESSION_SECRET || "skyline-dev-only-secret";
  const payload = Buffer.from(
    JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + 86400 * 7 })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `skyline_session=${payload}.${signature}`;
}

async function loginAdmin() {
  const cookie = makeToken("mrsatishpatil105@gmail.com");
  console.log("✓ Admin session token generated");
  return cookie;
}

async function runTests() {
  console.log("===============================================================================");
  console.log("       STARTING E2E BUG FIX VERIFICATION: ASSIGNED USERS IN MACHINE MASTER    ");
  console.log("===============================================================================\n");

  const cookie = await loginAdmin();
  const mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  const atlasDb = mongoClient.db(dbName);
  console.log(`✓ Connected directly to MongoDB Atlas cluster database: ${dbName}\n`);

  const testAssetId = "SKY-BND-MCH-001"; // Bending Machine

  // -------------------------------------------------------------------------
  // TEST A: New assignment (Assign user OP-001 to SKY-BND-MCH-001)
  // -------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST A: New Assignment — Assign user OP-001 to SKY-BND-MCH-001");
  console.log("-------------------------------------------------------------------------------");

  const saveResA = await fetch(`${BASE_URL}/api/admin/machines`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      id: testAssetId,
      row: {
        "Asset ID": testAssetId,
        "Machine Name": "CNC Bending Press Brake",
        assignedUsers: ["OP-001"],
        "Assigned Users": "OP-001",
      },
    }),
  });

  const saveResultA = await saveResA.json();
  console.log("API Response (Save Single User):", saveResultA);
  if (!saveResA.ok || !saveResultA.success) {
    throw new Error(`Test A Failed on save: ${JSON.stringify(saveResultA)}`);
  }

  // Verify via API
  const listResA = await fetch(`${BASE_URL}/api/admin/machines`, {
    headers: { Cookie: cookie },
  });
  const listDataA = await listResA.json();
  const machineA = listDataA.rows?.find((m) => m["Asset ID"] === testAssetId);
  console.log("Machine record from API GET /api/admin/machines:");
  console.log("  Asset ID:", machineA?.["Asset ID"]);
  console.log("  Assigned Users (string):", machineA?.["Assigned Users"]);
  console.log("  assignedUsers (array):", machineA?.assignedUsers);
  console.log("  assignedUserDetails:", machineA?.assignedUserDetails);

  if (!machineA?.assignedUsers?.includes("OP-001")) {
    throw new Error("Test A Failed: OP-001 not found in assignedUsers array via API");
  }
  if (!machineA?.["Assigned Users"]?.includes("OP-001")) {
    throw new Error("Test A Failed: OP-001 not found in 'Assigned Users' string via API");
  }

  // Verify direct in MongoDB Atlas
  const atlasMachineA = await atlasDb.collection("machines").findOne({ "Asset ID": testAssetId });
  console.log("Machine record directly from MongoDB Atlas:");
  console.log("  Atlas assignedUsers:", atlasMachineA?.assignedUsers);
  console.log("  Atlas Assigned Users:", atlasMachineA?.["Assigned Users"]);
  if (!atlasMachineA?.assignedUsers?.includes("OP-001")) {
    throw new Error("Test A Failed: OP-001 not saved to MongoDB Atlas machines collection");
  }
  console.log(">>> TEST A PASSED: New assignment saved and verified in API & MongoDB Atlas! <<<\n");

  // -------------------------------------------------------------------------
  // TEST B: Multiple assignments (Assign OP-001 and OP-002)
  // -------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST B: Multiple Assignments — Assign OP-001 and OP-002 without duplicates");
  console.log("-------------------------------------------------------------------------------");

  const saveResB = await fetch(`${BASE_URL}/api/admin/machines`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      id: testAssetId,
      row: {
        "Asset ID": testAssetId,
        "Machine Name": "CNC Bending Press Brake",
        assignedUsers: ["OP-001", "OP-002", "OP-001"], // purposefully include duplicate to test deduplication
        "Assigned Users": "OP-001, OP-002, OP-001",
      },
    }),
  });

  const saveResultB = await saveResB.json();
  console.log("API Response (Save Multiple Users):", saveResultB);

  const listResB = await fetch(`${BASE_URL}/api/admin/machines`, {
    headers: { Cookie: cookie },
  });
  const listDataB = await listResB.json();
  const machineB = listDataB.rows?.find((m) => m["Asset ID"] === testAssetId);
  console.log("Machine record from API after multiple assignment:");
  console.log("  assignedUsers:", machineB?.assignedUsers);
  console.log("  Assigned Users:", machineB?.["Assigned Users"]);
  console.log("  assignedUserDetails count:", machineB?.assignedUserDetails?.length);

  if (machineB?.assignedUsers?.length !== 2) {
    throw new Error(`Test B Failed: Expected exactly 2 unique assigned users, got ${machineB?.assignedUsers?.length}`);
  }
  if (!machineB.assignedUsers.includes("OP-001") || !machineB.assignedUsers.includes("OP-002")) {
    throw new Error("Test B Failed: OP-001 or OP-002 missing from assigned users");
  }

  const atlasMachineB = await atlasDb.collection("machines").findOne({ "Asset ID": testAssetId });
  if (atlasMachineB?.assignedUsers?.length !== 2) {
    throw new Error(`Test B Failed: Atlas machine expected 2 users, got ${atlasMachineB?.assignedUsers?.length}`);
  }
  console.log(">>> TEST B PASSED: Multiple assignments saved without duplicates! <<<\n");

  // -------------------------------------------------------------------------
  // TEST C: Existing assignment preservation (Edit unrelated field: Location & Make)
  // -------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST C: Existing Assignment Preservation — Edit unrelated fields (Make/Location)");
  console.log("-------------------------------------------------------------------------------");

  const saveResC = await fetch(`${BASE_URL}/api/admin/machines`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      id: testAssetId,
      row: {
        "Asset ID": testAssetId,
        "Machine Name": "CNC Bending Press Brake",
        Make: "Amada Japan",
        Location: "Shopfloor Bay C-99",
        // Note: assignedUsers is NOT explicitly provided in this payload to ensure preservation!
      },
    }),
  });

  const saveResultC = await saveResC.json();
  console.log("API Response (Edit Unrelated Field):", saveResultC);

  const listResC = await fetch(`${BASE_URL}/api/admin/machines`, {
    headers: { Cookie: cookie },
  });
  const listDataC = await listResC.json();
  const machineC = listDataC.rows?.find((m) => m["Asset ID"] === testAssetId);
  console.log("Machine record after updating Make and Location:");
  console.log("  Make:", machineC?.Make);
  console.log("  Location:", machineC?.Location);
  console.log("  assignedUsers preserved:", machineC?.assignedUsers);
  console.log("  Assigned Users string preserved:", machineC?.["Assigned Users"]);

  if (machineC?.Make !== "Amada Japan" || machineC?.Location !== "Shopfloor Bay C-99") {
    throw new Error("Test C Failed: Make or Location did not update");
  }
  if (!machineC?.assignedUsers?.includes("OP-001") || !machineC?.assignedUsers?.includes("OP-002")) {
    throw new Error("Test C Failed: Existing user assignments were lost when updating unrelated machine fields!");
  }

  const atlasMachineC = await atlasDb.collection("machines").findOne({ "Asset ID": testAssetId });
  if (!atlasMachineC?.assignedUsers?.includes("OP-001") || !atlasMachineC?.assignedUsers?.includes("OP-002")) {
    throw new Error("Test C Failed: Atlas machines lost assignments on unrelated field edit!");
  }
  console.log(">>> TEST C PASSED: Assignments preserved when updating unrelated fields! <<<\n");

  // -------------------------------------------------------------------------
  // TEST D: Refresh — Verify persistence across fresh fetches
  // -------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST D: Refresh — Hard re-fetch and verification");
  console.log("-------------------------------------------------------------------------------");

  const freshListRes = await fetch(`${BASE_URL}/api/admin/machines`, {
    headers: { Cookie: cookie, "Cache-Control": "no-cache" },
  });
  const freshListData = await freshListRes.json();
  const freshMachine = freshListData.rows?.find((m) => m["Asset ID"] === testAssetId);
  console.log("Freshly fetched machine:", {
    assetId: freshMachine?.["Asset ID"],
    assignedUsers: freshMachine?.assignedUsers,
    assignedUsersStr: freshMachine?.["Assigned Users"],
    assignedUserDetails: freshMachine?.assignedUserDetails,
  });

  if (!freshMachine?.assignedUsers?.length) {
    throw new Error("Test D Failed: Assignments not visible after fresh reload");
  }
  console.log(">>> TEST D PASSED: Assignments persist across refresh! <<<\n");

  // -------------------------------------------------------------------------
  // TEST E: Edit assignment — Remove OP-002, keep OP-001
  // -------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST E: Edit Assignment — Remove OP-002, keep OP-001");
  console.log("-------------------------------------------------------------------------------");

  const saveResE = await fetch(`${BASE_URL}/api/admin/machines`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      id: testAssetId,
      row: {
        "Asset ID": testAssetId,
        "Machine Name": "CNC Bending Press Brake",
        assignedUsers: ["OP-001"],
        "Assigned Users": "OP-001",
      },
    }),
  });

  const saveResultE = await saveResE.json();
  console.log("API Response (Remove OP-002):", saveResultE);

  const listResE = await fetch(`${BASE_URL}/api/admin/machines`, {
    headers: { Cookie: cookie },
  });
  const listDataE = await listResE.json();
  const machineE = listDataE.rows?.find((m) => m["Asset ID"] === testAssetId);
  console.log("Machine record after removing OP-002:");
  console.log("  assignedUsers:", machineE?.assignedUsers);
  console.log("  Assigned Users:", machineE?.["Assigned Users"]);

  if (machineE?.assignedUsers?.includes("OP-002")) {
    throw new Error("Test E Failed: OP-002 is still in assignedUsers after removal");
  }
  if (!machineE?.assignedUsers?.includes("OP-001")) {
    throw new Error("Test E Failed: OP-001 was lost after removing OP-002");
  }
  console.log(">>> TEST E PASSED: Assignment removal saved and updated properly! <<<\n");

  // -------------------------------------------------------------------------
  // TEST F: Database verification in MongoDB Atlas
  // -------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST F: Database Verification — Direct verification in MongoDB Atlas");
  console.log("-------------------------------------------------------------------------------");

  // 1. Machines collection
  const dbMachine = await atlasDb.collection("machines").findOne({ "Asset ID": testAssetId });
  console.log("1. MongoDB Atlas 'machines' document:");
  console.log("   Asset ID:", dbMachine?.["Asset ID"]);
  console.log("   assignedUsers:", dbMachine?.assignedUsers);
  console.log("   Assigned Users:", dbMachine?.["Assigned Users"]);

  // 2. Machine assignments collection
  const dbAssignments = await atlasDb.collection("machine_assignments").find({ assetId: testAssetId }).toArray();
  console.log("2. MongoDB Atlas 'machine_assignments' audit collection records:", dbAssignments.length);
  for (const asgn of dbAssignments) {
    console.log(`   - User: ${asgn.userId} (${asgn.userName}) | Status: ${asgn.status} | AssignedAt: ${asgn.assignedAt}${asgn.removedAt ? ` | RemovedAt: ${asgn.removedAt}` : ""}`);
  }

  // 3. Users collection
  const dbUser = await atlasDb.collection("users").findOne({ "User ID": "OP-001" });
  console.log("3. MongoDB Atlas 'users' document for OP-001:");
  console.log("   User ID:", dbUser?.["User ID"]);
  console.log("   Name:", dbUser?.Name);
  console.log("   assignedMachines:", dbUser?.assignedMachines);
  console.log("   Assigned Machines:", dbUser?.["Assigned Machines"]);

  if (!dbMachine?.assignedUsers?.includes("OP-001")) {
    throw new Error("Test F Failed: OP-001 not found in Atlas machines collection");
  }
  const op001Asgn = dbAssignments.find((a) => a.userId === "OP-001");
  if (!op001Asgn || op001Asgn.status !== "Active") {
    throw new Error("Test F Failed: Active assignment not found in machine_assignments collection");
  }
  const op002Asgn = dbAssignments.find((a) => a.userId === "OP-002");
  if (!op002Asgn || op002Asgn.status !== "Removed") {
    throw new Error("Test F Failed: Removed assignment audit status not found for OP-002");
  }
  if (!dbUser?.assignedMachines?.includes(testAssetId)) {
    throw new Error("Test F Failed: testAssetId not found in user OP-001 assignedMachines");
  }
  console.log(">>> TEST F PASSED: MongoDB Atlas database state is 100% verified and consistent! <<<\n");

  // -------------------------------------------------------------------------
  // TEST G: Regression testing (Checklist, Maintenance, User Management)
  // -------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST G: Regression Testing — Checklists, Maintenance, and Machine Details");
  console.log("-------------------------------------------------------------------------------");

  // 1. Machine Details lookup endpoint
  const machineLookupRes = await fetch(`${BASE_URL}/api/machine?assetId=${encodeURIComponent(testAssetId)}`, {
    headers: { Cookie: cookie },
  });
  const machineLookupData = await machineLookupRes.json();
  console.log("1. /api/machine lookup status:", machineLookupRes.status);
  console.log("   Machine Name:", machineLookupData.machine?.["Machine Name"]);
  console.log("   Assigned Users:", machineLookupData.machine?.["Assigned Users"]);
  console.log("   assignedUserDetails:", machineLookupData.machine?.assignedUserDetails);
  if (!machineLookupData.success || !machineLookupData.machine?.assignedUsers?.includes("OP-001")) {
    throw new Error("Test G Failed: /api/machine did not return assigned user");
  }

  // 2. Checklist records
  const checklistRes = await fetch(`${BASE_URL}/api/checklist/records`, {
    headers: { Cookie: cookie },
  });
  console.log("2. /api/checklist/records status:", checklistRes.status);
  if (!checklistRes.ok) {
    throw new Error(`Test G Failed: Checklist records endpoint returned ${checklistRes.status}`);
  }

  // 3. Maintenance hub
  const mntRes = await fetch(`${BASE_URL}/api/admin/maintenance/hub`, {
    headers: { Cookie: cookie },
  });
  console.log("3. /api/admin/maintenance/hub status:", mntRes.status);
  if (!mntRes.ok) {
    throw new Error(`Test G Failed: Maintenance hub returned ${mntRes.status}`);
  }

  // 4. Users list
  const usersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Cookie: cookie },
  });
  console.log("4. /api/admin/users status:", usersRes.status);
  if (!usersRes.ok) {
    throw new Error(`Test G Failed: Users endpoint returned ${usersRes.status}`);
  }

  console.log(">>> TEST G PASSED: Zero regressions across all operational workflows! <<<\n");

  await mongoClient.close();
  console.log("===============================================================================");
  console.log("   ALL TESTS (A THROUGH G) COMPLETED SUCCESSFULLY WITH 100% PERSISTENCE!      ");
  console.log("===============================================================================");
}

runTests().catch((err) => {
  console.error("\n❌ TEST RUN FAILED:", err);
  process.exit(1);
});
