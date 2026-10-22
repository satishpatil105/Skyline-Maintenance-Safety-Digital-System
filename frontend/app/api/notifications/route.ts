import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { closeAlert, getCategorizedAlerts, listAlerts, syncNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

let lastSync = 0;
const SYNC_INTERVAL_MS = 15_000; // auto-sync across all sectors at most every 15s

/**
 * GET /api/notifications[?assetId=...]
 * The open alerts, most urgent first. Any logged-in user can read them.
 */
export const GET = safe(async (request: NextRequest) => {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const assetId = request.nextUrl.searchParams.get("assetId") || undefined;
  const forceSync = request.nextUrl.searchParams.get("sync") === "true";

  if (forceSync) {
    await syncNotifications().catch((err) => console.error("Notification sync error:", err));
  }

  const { alerts, due, pending, upcoming, counts } = await getCategorizedAlerts({ assetId });

  const category = request.nextUrl.searchParams.get("category");
  let filtered = alerts;
  if (category === "due") filtered = due;
  else if (category === "pending") filtered = pending;
  else if (category === "upcoming") filtered = upcoming;

  return NextResponse.json({
    success: true,
    alerts: filtered,
    allAlerts: alerts,
    due,
    pending,
    upcoming,
    counts,
  });
});

/** POST /api/notifications  { action: "close", id } or { action: "clear" / "clearAll" } */
export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const isAuthorized =
    auth.user.role === "Admin" ||
    auth.user.role === "Supervisor" ||
    auth.user.permissions?.includes("Can Approve Close");

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, message: "You are not authorized. Supervisor or Admin privileges required." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);

  if (body?.action === "clear" || body?.action === "clearAll") {
    const { clearAllNotifications } = await import("@/lib/notifications");
    const result = await clearAllNotifications();
    return NextResponse.json(result);
  }

  if (body?.action !== "close" || !body?.id) {
    return NextResponse.json({ success: false, message: "Nothing to do." }, { status: 400 });
  }

  const result = await closeAlert(String(body.id), auth.user.email);
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
});
