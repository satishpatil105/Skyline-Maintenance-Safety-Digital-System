import { NextRequest, NextResponse } from "next/server";
import { createRow, deleteRow, listTable, updateRow } from "@/lib/adminData";
import { requireUser } from "@/lib/auth";
import { safe } from "@/lib/api";
import { isTableId } from "@/lib/tables";
import type { TableId } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { table: string } };

/** Admin-only. Resolves the table and confirms the caller is an admin. */
async function guard(ctx: Ctx) {
  const auth = await requireUser("admin");
  if (auth.error) return { error: auth.error };

  if (!isTableId(ctx.params.table)) {
    return {
      error: NextResponse.json(
        { success: false, message: "Unknown table." },
        { status: 404 }
      ),
    };
  }
  return { user: auth.user, table: ctx.params.table as TableId };
}

function asRow(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    row[k] = String(v ?? "");
  }
  return row;
}

const badRequest = (message: string) =>
  NextResponse.json({ success: false, message }, { status: 400 });

/** Read: all rows of a table. */
export const GET = safe(async (_request: NextRequest, ctx: Ctx) => {
  const g = await guard(ctx);
  if (g.error) return g.error;
  return NextResponse.json({ success: true, ...(await listTable(g.table)) });
});

/** Create: body { row }. */
export const POST = safe(async (request: NextRequest, ctx: Ctx) => {
  const g = await guard(ctx);
  if (g.error) return g.error;

  const body = await request.json().catch(() => null);
  const row = asRow(body?.row);
  if (!row) return badRequest("No data received.");

  const result = await createRow(g.table, row);
  return NextResponse.json(
    { success: result.success, message: result.message },
    { status: result.status ?? (result.success ? 200 : 400) }
  );
});

/** Update: body { id, row }. The ID column itself can't change. */
export const PUT = safe(async (request: NextRequest, ctx: Ctx) => {
  const g = await guard(ctx);
  if (g.error) return g.error;

  const body = await request.json().catch(() => null);
  const row = asRow(body?.row);
  const id = String(body?.id ?? "");
  if (!row || !id) return badRequest("No data received.");

  const result = await updateRow(g.table, id, row, g.user.email);
  return NextResponse.json(
    { success: result.success, message: result.message },
    { status: result.status ?? (result.success ? 200 : 400) }
  );
});

/** Delete: /api/admin/<table>?id=<row id>. */
export const DELETE = safe(async (request: NextRequest, ctx: Ctx) => {
  const g = await guard(ctx);
  if (g.error) return g.error;

  const id = request.nextUrl.searchParams.get("id") || "";
  if (!id) return badRequest("No row selected.");

  const result = await deleteRow(g.table, id, g.user.email);
  return NextResponse.json(
    { success: result.success, message: result.message },
    { status: result.status ?? (result.success ? 200 : 400) }
  );
});
