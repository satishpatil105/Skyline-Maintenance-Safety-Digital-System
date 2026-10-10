import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safe } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/auth — who is logged in right now (or null). */
export const GET = safe(async () => {
  const user = await getSessionUser();
  return NextResponse.json({ success: true, user });
});
