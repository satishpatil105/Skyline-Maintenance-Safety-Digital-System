import { NextRequest, NextResponse } from "next/server";
import { safe } from "@/lib/api";
import { getMongoDb } from "@/lib/mongodb";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = safe(async (request: NextRequest) => {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const isEhsOrAdmin = user.role === "Admin" || user.role === "Supervisor" || user.permissions?.includes("Can Approve Close");
  if (!isEhsOrAdmin) {
    return NextResponse.json({ success: false, message: "Only EHS In-Charge or Admin can validate the HIRA register." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { status = "Validated by EHS", reviewNotes = "On-site review completed." } = body;

  const db = await getMongoDb();
  const metaCol = db.collection("hira_metadata");
  const hiraCol = db.collection("hira");

  const signoff = {
    validationStatus: status,
    validatedBy: `${user.name} (${user.userId || user.email})`,
    validatedAt: new Date().toISOString(),
    reviewNotes,
  };

  await metaCol.updateOne(
    { docId: "SKY-QA-HIRA-01" },
    {
      $set: {
        ...signoff,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  await hiraCol.updateMany(
    { sourceFile: "Skyline_HIRA_Register 1.xlsx" },
    {
      $set: {
        validationStatus: status,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  return NextResponse.json({
    success: true,
    message: `HIRA Register successfully updated to "${status}".`,
    signoff,
  });
});
