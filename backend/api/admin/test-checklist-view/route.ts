import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";
import { loadTemplates, getChecklist } from "@/lib/checklist";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  try {
    const db = await readDb();
    const all = await loadTemplates();

    const machineResults = await Promise.all(
      db.machines.map(async (m, idx) => {
        const cl = await getChecklist(m["Asset ID"]);
        return {
          index: idx + 1,
          assetId: m["Asset ID"],
          name: m["Machine Name"],
          category: m.Category,
          matchedCount: cl?.entries?.length ?? 0,
          categoriesMatched: Array.from(new Set(cl?.entries?.map((e) => e.category) ?? [])),
          sampleCheckpoints: cl?.entries?.slice(0, 3).map((e) => e.checkPoint) ?? [],
        };
      })
    );

    return NextResponse.json({
      success: true,
      machinesCount: db.machines.length,
      templatesCount: all.length,
      machines: machineResults,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

