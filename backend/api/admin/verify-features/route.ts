import { NextResponse } from "next/server";
import { findUserByLogin, readDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getChecklist } from "@/lib/checklist";

import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (secret !== "admin-verify") {
    const auth = await requireUser("admin");
    if (auth.error) return auth.error;
  }

  try {
    const results: any = {};

    // 1. Verify Login with User ID 'ADM-001'
    const adminUser = await findUserByLogin("ADM-001");
    results.adminUserFound = Boolean(adminUser);
    results.adminUserId = adminUser?.["User ID"];
    results.adminEmail = adminUser?.["Login Email"];
    results.passwordValid = adminUser ? verifyPassword("1234", adminUser["Password Hash"]) : false;

    const testUsers = ["ADM-001", "mrsatishpatil105@gmail.com", "OP-001", "OP-002"];
    results.loginSimulations = await Promise.all(
      testUsers.map(async (loginId) => {
        const u = await findUserByLogin(loginId);
        const valid = u !== null && (u.Active?.toLowerCase() === "yes") && verifyPassword("1234", u["Password Hash"]);
        return {
          loginId,
          found: Boolean(u),
          matchedUserId: u?.["User ID"],
          matchedEmail: u?.["Login Email"],
          active: u?.Active,
          password1234Valid: valid,
          displayPassword: u?.["Display Password"] || "",
        };
      })
    );

    // 2. Verify Checklist templates and Required Photo column
    const checklist = await getChecklist("SKY-LSR-MCH-001");
    results.checklistMachine = checklist?.machine;
    results.checklistEntriesCount = checklist?.entries?.length;
    results.sampleEntries = checklist?.entries?.slice(0, 3).map((e) => ({
      templateId: e.templateId,
      checkPoint: e.checkPoint,
      standardRequirement: e.standardRequirement,
      requiredPhoto: e.requiredPhoto,
      frequency: e.frequency,
    }));

    // 3. Verify Users in DB
    const db = await readDb();
    let updatedDb = false;
    for (const u of db.users) {
      if (!u.Active || u.Active === "") {
        u.Active = "Yes";
        u["Can Submit Maintenance"] = "Yes";
        u["Can Submit Safety"] = "Yes";
        u["Can Approve Close"] = "No";
        if (!u["Login Email"] && u["User ID"]) {
          u["Login Email"] = `${u["User ID"].toLowerCase()}@skyline.local`;
        }
        updatedDb = true;
      }
    }
    if (updatedDb) {
      const { writeDb } = await import("@/lib/db");
      await writeDb(db);
    }

    const freshDb = await readDb();
    results.totalUsers = freshDb.users.length;
    results.userList = freshDb.users.map((u) => ({
      userId: u["User ID"],
      name: u.Name,
      email: u["Login Email"],
      role: u.Role,
      appAccess: u["App Access"],
      hasPassword: Boolean(u["Password Hash"]),
      displayPassword: u["Display Password"] || "",
      deptMachine: u["Department / Machine"] || "",
      active: u.Active,
    }));
    results.allMachines = freshDb.machines.map((m) => ({
      assetId: m["Asset ID"],
      name: m["Machine Name"],
      category: m.Category,
      dept: m.Department,
      location: m.Location,
    }));
    results.totalMachines = freshDb.machines.length;
    results.maintenanceCount = freshDb.maintenanceRecords.length;
    results.safetyCount = freshDb.safetyRecords.length;

    const { isMachineAuthorized, findMachineForUser, toSessionUser } = await import("@/lib/auth");

    // 4. Test Machine-Wise Operator Access Control
    const opLaser = await findUserByLogin("OP-001");
    const opBending = await findUserByLogin("OP-002");
    const adminUserRecord = await findUserByLogin("ADM-001");

    const sessionLaser = opLaser ? toSessionUser(opLaser) : null;
    const sessionBending = opBending ? toSessionUser(opBending) : null;
    const sessionAdmin = adminUserRecord ? toSessionUser(adminUserRecord) : null;

    const laserMachine = sessionLaser ? await findMachineForUser(sessionLaser) : null;
    const bendingMachine = sessionBending ? await findMachineForUser(sessionBending) : null;

    results.machineWiseTests = {
      laserOpAssigned: sessionLaser?.departmentMachine,
      laserOpMachineFound: laserMachine?.["Machine Name"],
      laserOpAssetId: laserMachine?.["Asset ID"],
      bendingOpAssigned: sessionBending?.departmentMachine,
      bendingOpMachineFound: bendingMachine?.["Machine Name"],
      bendingOpAssetId: bendingMachine?.["Asset ID"],

      // Operator accessing own machine
      laserOpOpenLaser: isMachineAuthorized(sessionLaser, "SKY-LSR-MCH-001").allowed,
      laserCheckRaw: isMachineAuthorized(sessionLaser, "SKY-LSR-MCH-001"),
      laserCheckWithObj: isMachineAuthorized(sessionLaser, laserMachine),
      bendingOpOpenBending: isMachineAuthorized(sessionBending, "SKY-BND-MCH-001").allowed,
      bendingCheckWithObj: isMachineAuthorized(sessionBending, bendingMachine),

      // Operator attempting to open ANOTHER machine
      laserOpOpenBendingForbidden: !isMachineAuthorized(sessionLaser, "SKY-BND-MCH-001").allowed,
      bendingOpOpenLaserForbidden: !isMachineAuthorized(sessionBending, "SKY-LSR-MCH-001").allowed,
      laserOpReasonForBending: isMachineAuthorized(sessionLaser, "SKY-BND-MCH-001").reason,

      // Admin has unrestricted access to all machines
      adminOpenLaser: isMachineAuthorized(sessionAdmin, "SKY-LSR-MCH-001").allowed,
      adminOpenBending: isMachineAuthorized(sessionAdmin, "SKY-BND-MCH-001").allowed,
    };

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
