import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Returns reference data (machines and users) for auto-fill functionality across forms.
 * Accessible to any authenticated staff user.
 */
export const GET = safe(async () => {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const db = await readDb();

  const machines = (db.machines || []).map((m) => ({
    assetId: m["Asset ID"] || "",
    machineName: m["Machine Name"] || "",
    category: m["Category"] || "",
    department: m["Department"] || "",
    location: m["Location"] || "",
    responsiblePerson: m["Responsible Person"] || "",
    status: m["Status"] || "",
  }));

  const users = (db.users || []).map((u) => ({
    userId: u["User ID"] || "",
    name: u["Name"] || "",
    email: u["Login Email"] || "",
    role: u["Role"] || "",
    departmentMachine: u["Department / Machine"] || "",
  }));

  return NextResponse.json({
    success: true,
    machines,
    users,
    currentUser: {
      userId: session.userId || "",
      name: session.name || "",
      email: session.email || "",
      role: session.role || "",
      departmentMachine: session.departmentMachine || "",
    },
  });
});
