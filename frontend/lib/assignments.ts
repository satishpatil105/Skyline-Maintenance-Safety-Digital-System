import { getMongoDb } from "./mongodb";
import { readDb, withDbLock, writeDb } from "./db";
import type { Database, Machine, MachineAssignment, UserRecord } from "./types";

/**
 * Normalizes an identifier string (case-insensitive, trimmed).
 */
function norm(val: unknown): string {
  return String(val ?? "").trim().toLowerCase();
}

/**
 * Retrieve all assignments with active or audit status from MongoDB Atlas and in-memory DB.
 */
export async function getAllAssignments(filter?: {
  userId?: string;
  assetId?: string;
  status?: "Active" | "Removed";
}): Promise<MachineAssignment[]> {
  const mongoDb = await getMongoDb().catch(() => null);
  if (mongoDb) {
    const query: Record<string, any> = {};
    if (filter?.userId) query.userId = filter.userId;
    if (filter?.assetId) query.assetId = filter.assetId;
    if (filter?.status) query.status = filter.status;

    try {
      const records = await mongoDb.collection("machine_assignments").find(query).toArray();
      if (records && records.length > 0) {
        return records.map((r) => {
          const { _id, ...rest } = r;
          return rest as unknown as MachineAssignment;
        });
      }
    } catch (err) {
      console.warn("Could not query machine_assignments collection, falling back to DB sync:", err);
    }
  }

  // Derive from users and machines if machine_assignments collection is empty
  const db = await readDb();
  const assignments: MachineAssignment[] = [];

  for (const user of db.users || []) {
    const uId = user["User ID"] || user.userId || "";
    if (!uId) continue;
    if (filter?.userId && norm(uId) !== norm(filter.userId)) continue;

    const assignedMachines = user.assignedMachines || (
      user["Assigned Machines"] ? String(user["Assigned Machines"]).split(",").map((s) => s.trim()).filter(Boolean) : []
    );

    for (const assetId of assignedMachines) {
      if (filter?.assetId && norm(assetId) !== norm(filter.assetId)) continue;
      const machine = (db.machines || []).find(
        (m) => norm(m["Asset ID"]) === norm(assetId) || norm(m["Machine Name"]) === norm(assetId)
      );

      assignments.push({
        assignmentId: `ASN-${norm(uId).replace(/[^a-z0-9]/g, "")}-${norm(assetId).replace(/[^a-z0-9]/g, "")}`,
        userId: uId,
        userName: user.Name || user["Login Email"],
        userRole: user.Role || "Operator",
        userEmail: user["Login Email"],
        assetId: machine ? machine["Asset ID"] : assetId,
        machineName: machine ? machine["Machine Name"] : assetId,
        department: machine?.Department || user["Department / Machine"] || "Production",
        status: "Active",
        assignedAt: new Date().toISOString(),
        assignedBy: "System",
      });
    }
  }

  return assignments;
}

/**
 * Validate that a User ID and Machine Asset ID both exist.
 */
export async function validateAssignmentIds(
  userId: string,
  assetId: string
): Promise<{
  valid: boolean;
  message?: string;
  user?: UserRecord;
  machine?: Machine;
}> {
  const db = await readDb();
  const cleanUserId = String(userId || "").trim();
  const cleanAssetId = String(assetId || "").trim();

  if (!cleanUserId) {
    return { valid: false, message: "User ID is required." };
  }
  if (!cleanAssetId) {
    return { valid: false, message: "Machine Asset ID is required." };
  }

  const user = (db.users || []).find(
    (u) =>
      norm(u["User ID"]) === norm(cleanUserId) ||
      norm(u["Login Email"]) === norm(cleanUserId) ||
      norm(u.userId) === norm(cleanUserId)
  );
  if (!user) {
    return { valid: false, message: `User with ID "${cleanUserId}" does not exist in User Management.` };
  }

  const machine = (db.machines || []).find(
    (m) =>
      norm(m["Asset ID"]) === norm(cleanAssetId) ||
      norm(m["Machine Name"]) === norm(cleanAssetId)
  );
  if (!machine) {
    return { valid: false, message: `Machine with Asset ID "${cleanAssetId}" does not exist in Machine Master.` };
  }

  return { valid: true, user, machine };
}

/**
 * Assign a machine to a user and synchronize bidirectional links and audit trail.
 */
export async function assignMachineToUser(
  userId: string,
  assetId: string,
  actorEmail: string
): Promise<{ success: boolean; message: string; assignment?: MachineAssignment }> {
  const validation = await validateAssignmentIds(userId, assetId);
  if (!validation.valid || !validation.user || !validation.machine) {
    return { success: false, message: validation.message || "Invalid assignment data." };
  }

  const user = validation.user;
  const machine = validation.machine;
  const canonicalUserId = user["User ID"] || user.userId || user["Login Email"];
  const canonicalAssetId = machine["Asset ID"];
  const now = new Date().toISOString();

  return withDbLock(async () => {
    const db = await readDb();

    // 1. Update user assignedMachines
    const userIdx = (db.users || []).findIndex(
      (u) => norm(u["User ID"]) === norm(canonicalUserId) || norm(u["Login Email"]) === norm(canonicalUserId)
    );
    if (userIdx !== -1) {
      const currentMachines = new Set<string>(db.users[userIdx].assignedMachines || []);
      if (db.users[userIdx]["Assigned Machines"]) {
        String(db.users[userIdx]["Assigned Machines"])
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((m) => currentMachines.add(m));
      }

      if (currentMachines.has(canonicalAssetId)) {
        return {
          success: false,
          message: `Machine "${canonicalAssetId}" is already assigned to user "${canonicalUserId}". Duplicate assignments are not permitted.`,
        };
      }

      currentMachines.add(canonicalAssetId);
      const arr = Array.from(currentMachines);
      db.users[userIdx].assignedMachines = arr;
      db.users[userIdx]["Assigned Machines"] = arr.join(", ");
    }

    // 2. Update machine assignedUsers
    const machineIdx = (db.machines || []).findIndex(
      (m) => norm(m["Asset ID"]) === norm(canonicalAssetId)
    );
    if (machineIdx !== -1) {
      const currentUsers = new Set<string>(db.machines[machineIdx].assignedUsers || []);
      if (db.machines[machineIdx]["Assigned Users"]) {
        String(db.machines[machineIdx]["Assigned Users"])
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((u) => currentUsers.add(u));
      }
      currentUsers.add(canonicalUserId);
      const arr = Array.from(currentUsers);
      db.machines[machineIdx].assignedUsers = arr;
      db.machines[machineIdx]["Assigned Users"] = arr.join(", ");
    }

    // Write synchronized state to storage
    await writeDb(db);

    // 3. Upsert audit log in MongoDB Atlas `machine_assignments`
    const assignmentDoc: MachineAssignment = {
      assignmentId: `ASN-${canonicalUserId.replace(/[^A-Za-z0-9]/g, "")}-${canonicalAssetId.replace(/[^A-Za-z0-9]/g, "")}`,
      userId: canonicalUserId,
      userName: user.Name || user["Login Email"],
      userRole: user.Role || "Operator",
      userEmail: user["Login Email"],
      assetId: canonicalAssetId,
      machineName: machine["Machine Name"],
      department: machine.Department || "Production",
      status: "Active",
      assignedAt: now,
      assignedBy: actorEmail || "System Administrator",
    };

    try {
      const mongoDb = await getMongoDb().catch(() => null);
      if (mongoDb) {
        await mongoDb.collection("machine_assignments").updateOne(
          { userId: canonicalUserId, assetId: canonicalAssetId },
          { $set: assignmentDoc },
          { upsert: true }
        ).catch(() => {});

        // Direct update machine in Atlas
        if (machineIdx !== -1) {
          const freshUsers = db.machines[machineIdx].assignedUsers || [];
          await mongoDb.collection("machines").updateOne(
            {
              $or: [
                { "Asset ID": canonicalAssetId },
                { assetId: canonicalAssetId },
                { "Machine ID": canonicalAssetId },
              ],
            },
            {
              $set: {
                assignedUsers: freshUsers,
                "Assigned Users": freshUsers.join(", "),
                "Last Updated": now,
              },
            }
          ).catch(() => {});
        }

        // Direct update user in Atlas
        if (userIdx !== -1) {
          const freshMachines = db.users[userIdx].assignedMachines || [];
          await mongoDb.collection("users").updateOne(
            {
              $or: [
                { "User ID": canonicalUserId },
                { "Login Email": canonicalUserId },
              ],
            },
            {
              $set: {
                assignedMachines: freshMachines,
                "Assigned Machines": freshMachines.join(", "),
              },
            }
          ).catch(() => {});
        }
      }
    } catch (auditErr) {
      console.warn("Could not write assignment audit trail to Atlas:", auditErr);
    }

    return {
      success: true,
      message: `Machine "${canonicalAssetId} — ${machine["Machine Name"]}" successfully assigned to ${user.Name} (${canonicalUserId}).`,
      assignment: assignmentDoc,
    };
  });
}

/**
 * Remove an assignment between a user and a machine while strictly preserving all historical
 * maintenance records, checklists, audit logs, and master records.
 */
export async function removeMachineAssignment(
  userId: string,
  assetId: string,
  actorEmail: string
): Promise<{ success: boolean; message: string }> {
  const cleanUserId = String(userId || "").trim();
  const cleanAssetId = String(assetId || "").trim();
  const now = new Date().toISOString();

  return withDbLock(async () => {
    const db = await readDb();

    // 1. Remove from User
    const userIdx = (db.users || []).findIndex(
      (u) =>
        norm(u["User ID"]) === norm(cleanUserId) ||
        norm(u["Login Email"]) === norm(cleanUserId)
    );
    if (userIdx !== -1) {
      const current = (db.users[userIdx].assignedMachines || []).filter(
        (m) => norm(m) !== norm(cleanAssetId)
      );
      db.users[userIdx].assignedMachines = current;
      db.users[userIdx]["Assigned Machines"] = current.join(", ");
    }

    // 2. Remove from Machine
    const machineIdx = (db.machines || []).findIndex(
      (m) => norm(m["Asset ID"]) === norm(cleanAssetId)
    );
    if (machineIdx !== -1) {
      const currentUsers = (db.machines[machineIdx].assignedUsers || []).filter(
        (u) => norm(u) !== norm(cleanUserId)
      );
      db.machines[machineIdx].assignedUsers = currentUsers;
      db.machines[machineIdx]["Assigned Users"] = currentUsers.join(", ");
    }

    await writeDb(db);

    // 3. Mark as Removed in MongoDB Atlas machine_assignments audit collection and sync machines & users
    try {
      const mongoDb = await getMongoDb().catch(() => null);
      if (mongoDb) {
        await mongoDb.collection("machine_assignments").updateOne(
          {
            $or: [
              { userId: cleanUserId, assetId: cleanAssetId },
              {
                userId: { $regex: new RegExp(`^${cleanUserId}$`, "i") },
                assetId: { $regex: new RegExp(`^${cleanAssetId}$`, "i") },
              },
            ],
          },
          {
            $set: {
              status: "Removed",
              removedAt: now,
              removedBy: actorEmail || "System Administrator",
            },
          }
        ).catch(() => {});

        // Direct update machine in Atlas
        if (machineIdx !== -1) {
          const freshUsers = db.machines[machineIdx].assignedUsers || [];
          await mongoDb.collection("machines").updateOne(
            {
              $or: [
                { "Asset ID": cleanAssetId },
                { assetId: cleanAssetId },
                { "Machine ID": cleanAssetId },
              ],
            },
            {
              $set: {
                assignedUsers: freshUsers,
                "Assigned Users": freshUsers.join(", "),
                "Last Updated": now,
              },
            }
          ).catch(() => {});
        }

        // Direct update user in Atlas
        if (userIdx !== -1) {
          const freshMachines = db.users[userIdx].assignedMachines || [];
          await mongoDb.collection("users").updateOne(
            {
              $or: [
                { "User ID": cleanUserId },
                { "Login Email": cleanUserId },
              ],
            },
            {
              $set: {
                assignedMachines: freshMachines,
                "Assigned Machines": freshMachines.join(", "),
              },
            }
          ).catch(() => {});
        }
      }
    } catch (auditErr) {
      console.warn("Could not update machine_assignments audit in Atlas:", auditErr);
    }

    return {
      success: true,
      message: `Machine assignment "${cleanAssetId}" successfully removed for user "${cleanUserId}". Historical maintenance and checklist records remain intact.`,
    };
  });
}

/**
 * Synchronize full list of assigned machines for a user from Add/Edit User modal.
 */
export async function syncUserAssignedMachines(
  userId: string,
  targetMachineIds: string[],
  actorEmail: string
): Promise<{ success: boolean; message: string }> {
  const db = await readDb();
  const cleanUserId = String(userId || "").trim();
  const user = (db.users || []).find(
    (u) =>
      norm(u["User ID"]) === norm(cleanUserId) ||
      norm(u["Login Email"]) === norm(cleanUserId)
  );
  if (!user) {
    return { success: false, message: `User "${cleanUserId}" not found.` };
  }

  // Deduplicate and validate target machines
  const uniqueMachineIds = Array.from(
    new Set(targetMachineIds.map((id) => String(id).trim()).filter(Boolean))
  );

  for (const mId of uniqueMachineIds) {
    const exists = (db.machines || []).some(
      (m) => norm(m["Asset ID"]) === norm(mId) || norm(m["Machine Name"]) === norm(mId)
    );
    if (!exists) {
      return { success: false, message: `Machine with ID "${mId}" does not exist in Machine Master.` };
    }
  }

  // Current assigned machines
  const currentMachines = new Set<string>(user.assignedMachines || []);
  if (user["Assigned Machines"]) {
    String(user["Assigned Machines"])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((m) => currentMachines.add(m));
  }

  const targetSet = new Set<string>(uniqueMachineIds);

  // Add new assignments
  for (const newM of targetSet) {
    if (!currentMachines.has(newM)) {
      await assignMachineToUser(cleanUserId, newM, actorEmail);
    }
  }

  // Remove de-selected assignments
  for (const oldM of currentMachines) {
    if (!targetSet.has(oldM)) {
      await removeMachineAssignment(cleanUserId, oldM, actorEmail);
    }
  }

  return { success: true, message: `Assigned machines updated for user ${cleanUserId}.` };
}

/**
 * Synchronize full list of assigned users for a machine from Machine Master details.
 */
export async function syncMachineAssignedUsers(
  assetId: string,
  targetUserIds: string[],
  actorEmail: string
): Promise<{ success: boolean; message: string }> {
  const db = await readDb();
  const cleanAssetId = String(assetId || "").trim();
  const machine = (db.machines || []).find(
    (m) => norm(m["Asset ID"]) === norm(cleanAssetId)
  );
  if (!machine) {
    return { success: false, message: `Machine "${cleanAssetId}" not found.` };
  }

  // Deduplicate and validate target users
  const uniqueUserIds = Array.from(
    new Set(targetUserIds.map((id) => String(id).trim()).filter(Boolean))
  );

  for (const uId of uniqueUserIds) {
    const exists = (db.users || []).some(
      (u) =>
        norm(u["User ID"]) === norm(uId) ||
        norm(u["Login Email"]) === norm(uId) ||
        norm(u.userId) === norm(uId)
    );
    if (!exists) {
      return { success: false, message: `User with ID "${uId}" does not exist in User Management.` };
    }
  }

  const currentUsers = new Set<string>(machine.assignedUsers || []);
  if (machine["Assigned Users"]) {
    String(machine["Assigned Users"])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((u) => currentUsers.add(u));
  }

  const targetSet = new Set<string>(uniqueUserIds);

  for (const newU of targetSet) {
    if (!currentUsers.has(newU)) {
      await assignMachineToUser(newU, cleanAssetId, actorEmail);
    }
  }

  for (const oldU of currentUsers) {
    if (!targetSet.has(oldU)) {
      await removeMachineAssignment(oldU, cleanAssetId, actorEmail);
    }
  }

  return { success: true, message: `Assigned users updated for machine ${cleanAssetId}.` };
}
