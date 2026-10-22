import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isMachineAuthorized, requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { addMachine, findMachineByAssetId, updateMachine } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Machine lookup. Protected by operator machine-assignment restrictions. */
export const GET = safe(async (request: NextRequest) => {
  const assetId =
    request.nextUrl.searchParams.get("assetId") ||
    request.nextUrl.searchParams.get("id") ||
    request.nextUrl.searchParams.get("machineId") ||
    request.nextUrl.searchParams.get("machineCode") ||
    "";
  const result = await findMachineByAssetId(assetId);
  if (!result.success || !result.machine) return NextResponse.json(result);

  const user = await getSessionUser();
  if (user && user.role !== "Admin" && user.departmentMachine) {
    const auth = isMachineAuthorized(user, result.machine);
    if (!auth.allowed) {
      return NextResponse.json(
        {
          success: false,
          unauthorizedMachine: true,
          message: auth.reason || `Access Restricted: You are assigned strictly to ${user.departmentMachine}. Another machine cannot be opened.`,
        },
        { status: 403 }
      );
    }
  }

  return NextResponse.json(result);
});

/** Add a new machine. Requires "Can Add Machine" (admins always can). */
export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser("Can Add Machine");
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, message: "No machine data received." },
      { status: 400 }
    );
  }

  const result = await addMachine(body);
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
});

/** Edit an existing machine. Requires "Can Edit Machine" (admins always can). */
export const PUT = safe(async (request: NextRequest) => {
  const auth = await requireUser("Can Edit Machine");
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !body["Asset ID"]) {
    return NextResponse.json(
      { success: false, message: "No machine data received." },
      { status: 400 }
    );
  }

  const result = await updateMachine(String(body["Asset ID"]), body);
  return NextResponse.json(result, {
    status: result.success ? 200 : result.message.startsWith("Machine not found") ? 404 : 400,
  });
});
