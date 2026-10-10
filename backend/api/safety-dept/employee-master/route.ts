import { NextRequest, NextResponse } from "next/server";
import { safe } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { readDb, withDbLock } from "@/lib/db";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** GET: List all employees from User Master */
export const GET = safe(async () => {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const db = await readDb();
  const employees = (db.users || []).map((u) => ({
    userId: u["User ID"] || "",
    name: u["Name"] || "",
    role: u["Role"] || "",
    departmentMachine: u["Department / Machine"] || "",
    mobile: u["Mobile"] || "",
    active: u["Active"] || "Yes",
    email: u["Login Email"] || "",
  }));

  return NextResponse.json({ success: true, employees });
});

/** POST: Create or update an employee in User Master */
export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser("Can Submit Safety");
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const userId = String(body?.userId ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const role = String(body?.role ?? "Operator").trim();
  const department = String(body?.departmentMachine ?? body?.department ?? "").trim();
  const mobile = String(body?.mobile ?? "").trim();
  const active = String(body?.active ?? "Yes").trim();
  const email = String(body?.email ?? "").trim() || `${userId.toLowerCase()}@skyline.local`;

  if (!userId || !name) {
    return NextResponse.json({ success: false, message: "Employee ID and Employee Name are required." }, { status: 400 });
  }

  return withDbLock(async () => {
    const store = getStore();
    const tabs = await store.readAll({ fresh: true });
    const userTab = tabs.find((t) => t.name.toLowerCase().includes("user"));
    if (!userTab) {
      return NextResponse.json({ success: false, message: "User Master tab not found in spreadsheet." }, { status: 404 });
    }

    const colIndex = (label: string) =>
      userTab.headers.findIndex((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === label.toLowerCase().replace(/[^a-z0-9]/g, ""));

    const idCol = colIndex("User ID");
    const nameCol = colIndex("Name");
    const roleCol = colIndex("Role");
    const deptCol = colIndex("Department / Machine");
    const mobCol = colIndex("Mobile");
    const actCol = colIndex("Active");
    const emailCol = colIndex("login Email");

    const existingRow = userTab.rows.find((r) => String(r.cells[idCol] ?? "").trim().toLowerCase() === userId.toLowerCase());

    if (existingRow) {
      // Update existing employee
      const cells = [...existingRow.cells];
      while (cells.length < userTab.headers.length) cells.push("");
      if (nameCol >= 0) cells[nameCol] = name;
      if (roleCol >= 0) cells[roleCol] = role;
      if (deptCol >= 0) cells[deptCol] = department;
      if (mobCol >= 0) cells[mobCol] = mobile;
      if (actCol >= 0) cells[actCol] = active;
      if (emailCol >= 0 && email) cells[emailCol] = email;

      await store.apply([{ type: "update", tab: userTab.name, row: existingRow.row, expected: existingRow.cells, cells }]);
      return NextResponse.json({ success: true, message: `Employee ${name} (${userId}) updated successfully.` });
    } else {
      // Append new employee
      const cells = userTab.headers.map(() => "");
      if (idCol >= 0) cells[idCol] = userId;
      if (nameCol >= 0) cells[nameCol] = name;
      if (roleCol >= 0) cells[roleCol] = role;
      if (deptCol >= 0) cells[deptCol] = department;
      if (mobCol >= 0) cells[mobCol] = mobile;
      if (actCol >= 0) cells[actCol] = active;
      if (emailCol >= 0) cells[emailCol] = email;

      await store.apply([{ type: "append", tab: userTab.name, cells }]);
      return NextResponse.json({ success: true, message: `Employee ${name} (${userId}) added to Employee Master.` });
    }
  });
});
