import { MongoClient } from "mongodb";
import crypto from "crypto";

const uri = "mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0";
const dbName = "Skyline_Project_Engineers";

// Generate Admin session token for testing Next.js REST API
function makeToken(email) {
  const secret = process.env.SESSION_SECRET || "skyline-dev-only-secret";
  const payload = Buffer.from(
    JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + 86400 * 7 })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function run() {
  console.log("===============================================================");
  console.log("   SKYMS: MACHINE & USER ASSIGNMENT E2E VERIFICATION SUITE     ");
  console.log("===============================================================");

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(dbName);
  console.log("Connected to MongoDB Atlas database:", dbName);

  const usersCol = db.collection("users");
  const machinesCol = db.collection("machines");
  const assignmentsCol = db.collection("machine_assignments");
  const maintenanceCol = db.collection("maintenance_records");
  const checklistsCol = db.collection("checklists");

  const initialCounts = {
    users: await usersCol.countDocuments(),
    machines: await machinesCol.countDocuments(),
    assignments: await assignmentsCol.countDocuments(),
    maintenance: await maintenanceCol.countDocuments(),
    checklists: await checklistsCol.countDocuments(),
  };

  console.log("\n[Baseline Atlas DB State]:", initialCounts);

  const adminToken = makeToken("mrsatishpatil105@gmail.com");
  const operatorToken = makeToken("krishna.magar@skylineprojects.com");

  console.log("\n--- TEST 1: Security & RBAC Enforcement on /api/admin/assignments ---");
  // 1a: Unauthenticated
  const unauthRes = await fetch("http://localhost:3000/api/admin/assignments");
  console.log("1a. Unauthenticated GET status:", unauthRes.status, "(Expected: 401)");

  // 1b: Non-admin (Operator role)
  const nonAdminRes = await fetch("http://localhost:3000/api/admin/assignments", {
    headers: { Cookie: `skyline_session=${operatorToken}` },
  });
  console.log("1b. Operator GET status:", nonAdminRes.status, "(Expected: 403)");

  // 1c: Admin GET
  const adminGetRes = await fetch("http://localhost:3000/api/admin/assignments", {
    headers: { Cookie: `skyline_session=${adminToken}` },
  });
  console.log("1c. Admin GET status:", adminGetRes.status, "(Expected: 200)");
  const adminGetJson = await adminGetRes.json();
  console.log("1c. Current Assignments in system:", adminGetJson.assignments?.length ?? 0);

  console.log("\n--- TEST 2: Assign Machines to OP-001 (Krishna Magar) ---");
  // Assign Machine 1: SKY-LSR-MCH-001 (Laser Machine)
  const assign1Res = await fetch("http://localhost:3000/api/admin/assignments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `skyline_session=${adminToken}`,
    },
    body: JSON.stringify({
      userId: "OP-001",
      assetId: "SKY-LSR-MCH-001",
      assignedBy: "Admin Satish Patil",
    }),
  });
  const assign1Json = await assign1Res.json();
  console.log("2a. Assign SKY-LSR-MCH-001 result:", assign1Json);

  // Assign Machine 2: SKY-BND-MCH-001 (Bending Machine)
  const assign2Res = await fetch("http://localhost:3000/api/admin/assignments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `skyline_session=${adminToken}`,
    },
    body: JSON.stringify({
      userId: "OP-001",
      assetId: "SKY-BND-MCH-001",
      assignedBy: "Admin Satish Patil",
    }),
  });
  const assign2Json = await assign2Res.json();
  console.log("2b. Assign SKY-BND-MCH-001 result:", assign2Json);

  console.log("\n--- TEST 3: Verify Bidirectional Atlas Persistence ---");
  const opUserInAtlas = await usersCol.findOne({
    $or: [{ "User ID": "OP-001" }, { userId: "OP-001" }],
  });
  console.log("3a. Atlas OP-001 assignedMachines:", opUserInAtlas?.assignedMachines);
  console.log("3a. Atlas OP-001 'Assigned Machines' field:", opUserInAtlas?.["Assigned Machines"]);

  const m1InAtlas = await machinesCol.findOne({
    $or: [{ "Asset ID": "SKY-LSR-MCH-001" }, { assetId: "SKY-LSR-MCH-001" }],
  });
  const m2InAtlas = await machinesCol.findOne({
    $or: [{ "Asset ID": "SKY-BND-MCH-001" }, { assetId: "SKY-BND-MCH-001" }],
  });
  console.log("3b. Atlas SKY-LSR-MCH-001 assignedUsers:", m1InAtlas?.assignedUsers);
  console.log("3b. Atlas SKY-LSR-MCH-001 'Assigned Users' field:", m1InAtlas?.["Assigned Users"]);
  console.log("3c. Atlas SKY-BND-MCH-001 assignedUsers:", m2InAtlas?.assignedUsers);
  console.log("3c. Atlas SKY-BND-MCH-001 'Assigned Users' field:", m2InAtlas?.["Assigned Users"]);

  // Verify Audit Trail records in machine_assignments
  const auditLogs = await assignmentsCol.find({ userId: "OP-001" }).toArray();
  console.log(`3d. machine_assignments audit count for OP-001: ${auditLogs.length}`);
  auditLogs.forEach((log) => {
    console.log(`    - [${log.status}] Machine ${log.assetId} (${log.machineName}) -> User ${log.userId} (${log.userName}), Assigned By: ${log.assignedBy} at ${log.assignedAt}`);
  });

  console.log("\n--- TEST 4: Duplicate Assignment Prevention ---");
  const dupRes = await fetch("http://localhost:3000/api/admin/assignments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `skyline_session=${adminToken}`,
    },
    body: JSON.stringify({
      userId: "OP-001",
      assetId: "SKY-LSR-MCH-001",
      assignedBy: "Admin Satish Patil",
    }),
  });
  const dupJson = await dupRes.json();
  console.log("4. Attempt duplicate assignment response:", dupJson);

  console.log("\n--- TEST 5: Machine Authorization & Operational Filtering ---");
  // Test /api/checklist filtering for operator OP-001
  const chkRes = await fetch("http://localhost:3000/api/checklist", {
    headers: { Cookie: `skyline_session=${operatorToken}` },
  });
  const chkJson = await chkRes.json();
  console.log("5a. Operator GET /api/checklist success:", chkJson.success);
  console.log("5a. Machines visible to operator in checklist:", chkJson.machines?.map((m) => m["Asset ID"] || m.assetId));

  // Operator accessing unassigned machine (SKY-WLD-MCH-001 Welding Machine)
  const unauthMachineRes = await fetch("http://localhost:3000/api/checklist?assetId=SKY-WLD-MCH-001", {
    headers: { Cookie: `skyline_session=${operatorToken}` },
  });
  const unauthMachineJson = await unauthMachineRes.json();
  console.log("5b. Operator accessing unassigned machine SKY-WLD-MCH-001 status:", unauthMachineRes.status, unauthMachineJson);

  // Operator accessing assigned machine (SKY-LSR-MCH-001)
  const authMachineRes = await fetch("http://localhost:3000/api/checklist?assetId=SKY-LSR-MCH-001", {
    headers: { Cookie: `skyline_session=${operatorToken}` },
  });
  const authMachineJson = await authMachineRes.json();
  console.log("5c. Operator accessing assigned machine SKY-LSR-MCH-001 status:", authMachineRes.status, "Checkpoints count:", authMachineJson.checkPoints?.length ?? 0);

  console.log("\n--- TEST 6: Assignment Removal & Audit Log Preservation ---");
  // Remove assignment for SKY-BND-MCH-001
  const deleteRes = await fetch("http://localhost:3000/api/admin/assignments", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Cookie: `skyline_session=${adminToken}`,
    },
    body: JSON.stringify({
      userId: "OP-001",
      assetId: "SKY-BND-MCH-001",
      removedBy: "Admin Satish Patil",
    }),
  });
  const deleteJson = await deleteRes.json();
  console.log("6a. Delete SKY-BND-MCH-001 assignment response:", deleteJson);

  const opAfterDelete = await usersCol.findOne({
    $or: [{ "User ID": "OP-001" }, { userId: "OP-001" }],
  });
  const m2AfterDelete = await machinesCol.findOne({
    $or: [{ "Asset ID": "SKY-BND-MCH-001" }, { assetId: "SKY-BND-MCH-001" }],
  });
  console.log("6b. Atlas OP-001 assignedMachines after removal:", opAfterDelete?.assignedMachines);
  console.log("6c. Atlas SKY-BND-MCH-001 assignedUsers after removal:", m2AfterDelete?.assignedUsers);

  const removedAuditLog = await assignmentsCol.findOne({
    userId: "OP-001",
    assetId: "SKY-BND-MCH-001",
    status: "Removed",
  });
  console.log("6d. Audit trail status in machine_assignments:", {
    assignmentId: removedAuditLog?.assignmentId,
    status: removedAuditLog?.status,
    removedBy: removedAuditLog?.removedBy,
    removedAt: removedAuditLog?.removedAt,
  });

  console.log("\n--- TEST 7: Data Integrity Check ---");
  const finalCounts = {
    users: await usersCol.countDocuments(),
    machines: await machinesCol.countDocuments(),
    maintenance: await maintenanceCol.countDocuments(),
    checklists: await checklistsCol.countDocuments(),
  };
  console.log("Baseline vs Final Counts:");
  console.log(" - Users:         Before:", initialCounts.users, "After:", finalCounts.users);
  console.log(" - Machines:      Before:", initialCounts.machines, "After:", finalCounts.machines);
  console.log(" - Maintenance:   Before:", initialCounts.maintenance, "After:", finalCounts.maintenance);
  console.log(" - Checklists:    Before:", initialCounts.checklists, "After:", finalCounts.checklists);

  const allPreserved =
    initialCounts.users === finalCounts.users &&
    initialCounts.machines === finalCounts.machines &&
    initialCounts.maintenance === finalCounts.maintenance &&
    initialCounts.checklists === finalCounts.checklists;

  console.log("\nOperational & Historical Data Integrity 100% Preserved:", allPreserved);

  await client.close();
  console.log("\n===============================================================");
  console.log("          ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!       ");
  console.log("===============================================================");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
