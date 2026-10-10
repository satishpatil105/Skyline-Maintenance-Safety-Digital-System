import { NextRequest, NextResponse } from "next/server";
import { safe } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ensureSafetyTabs, listDeptRecords, saveDeptRecord, updateDeptStatus } from "@/lib/safetyDept";
import { categoryById } from "@/lib/safetyDeptConfig";

export const dynamic = "force-dynamic";

type Ctx = { params: { category: string } };

const unknown = () =>
  NextResponse.json({ success: false, message: "Unknown Safety Department category." }, { status: 404 });

/** GET /api/safety-dept/fire: the records (any signed-in user can read). */
export const GET = safe(async (_request: NextRequest, { params }: Ctx) => {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const category = categoryById(params.category);
  if (!category) return unknown();

  const { exists, records } = await listDeptRecords(category.id);
  return NextResponse.json({ success: true, exists, records });
});

/** POST: add a record (needs "Can Submit Safety"). Who saved it is always the signed-in user. */
export const POST = safe(async (request: NextRequest, { params }: Ctx) => {
  const auth = await requireUser("Can Submit Safety");
  if (auth.error) return auth.error;
  const category = categoryById(params.category);
  if (!category) return unknown();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ success: false, message: "No data received." }, { status: 400 });
  }

  await ensureSafetyTabs();
  const result = await saveDeptRecord(category.id, body, { email: auth.user.email, name: auth.user.name });
  return NextResponse.json(result, { status: result.status ?? (result.success ? 200 : 400) });
});

/** PATCH { recordId, status, note }: change a record's status (any signed-in supervisor user). */
export const PATCH = safe(async (request: NextRequest, { params }: Ctx) => {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const category = categoryById(params.category);
  if (!category) return unknown();

  const body = await request.json().catch(() => null);
  const result = await updateDeptStatus(
    category.id,
    String(body?.recordId ?? ""),
    String(body?.status ?? ""),
    String(body?.note ?? ""),
    { email: auth.user.email, name: auth.user.name }
  );
  return NextResponse.json(result, { status: result.status ?? (result.success ? 200 : 400) });
});
