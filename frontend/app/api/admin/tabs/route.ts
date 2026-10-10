import { NextRequest, NextResponse } from "next/server";
import {
  createTabRow,
  deleteTabRow,
  getTab,
  listTabs,
  updateTabRow,
  type AdminResult,
} from "@/lib/adminTabs";
import { requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";

export const dynamic = "force-dynamic";

const reply = (r: AdminResult) =>
  NextResponse.json(
    { success: r.success, message: r.message },
    { status: r.status ?? (r.success ? 200 : 400) }
  );

const nameOf = (request: NextRequest) => request.nextUrl.searchParams.get("name") || "";

export const GET = safe(async (request: NextRequest) => {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  const name = nameOf(request);

  if (!name) return NextResponse.json({ success: true, ...(await listTabs(fresh)) });

  const result = await getTab(name, fresh);
  if (result.error) return reply(result.error);
  return NextResponse.json({ success: true, ...result.tab });
});

export const POST = safe(async (request: NextRequest) => {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  return reply(await createTabRow(nameOf(request), body?.cells));
});

export const PUT = safe(async (request: NextRequest) => {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  return reply(await updateTabRow(nameOf(request), Number(body?.row), body?.expected, body?.cells));
});

export const DELETE = safe(async (request: NextRequest) => {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  return reply(await deleteTabRow(nameOf(request), Number(body?.row), body?.expected, body?.identifier));
});
