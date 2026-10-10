import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { closeAlert, listAlerts, syncNotifications } from "@/lib/notifications";

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

  const now = Date.now();
  if (forceSync || now - lastSync > SYNC_INTERVAL_MS) {
    lastSync = now;
    await syncNotifications().catch((err) => console.error("Notification auto-sync error:", err));
  }

  const alerts = await listAlerts({ assetId });

  return NextResponse.json({
    success: true,
    alerts,
    counts: {
      total: alerts.length,
      overdue: alerts.filter((a) => a.daysLeft !== null && a.daysLeft <= 0).length,
    },
  });
});

/** POST /api/notifications  { action: "close", id }  (needs "Can Approve Close") */
export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser("Can Approve Close");
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (body?.action !== "close" || !body?.id) {
    return NextResponse.json({ success: false, message: "Nothing to do." }, { status: 400 });
  }

  const result = await closeAlert(String(body.id), auth.user.email);
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
});
