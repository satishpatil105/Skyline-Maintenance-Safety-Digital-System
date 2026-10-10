import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { syncNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/notifications
 * Check every sheet for due dates right now and update the Notifications sheet.
 * (The same check also runs automatically; see lib/notifyBoot.ts.)
 */
export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  // A pretend "today", only outside production (for trying the alerts out).
  const today = process.env.NODE_ENV !== "production" && typeof body?.today === "string" ? body.today : undefined;

  const result = await syncNotifications({ today });
  return NextResponse.json({ success: true, ...result });
});
