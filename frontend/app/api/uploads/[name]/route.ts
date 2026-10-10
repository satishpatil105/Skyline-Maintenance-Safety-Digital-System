import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireUser } from "@/lib/auth";
import { DATA_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
};

/** Serves photos saved by /api/upload. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { name: string } }
) {
  // Evidence photos are only for logged-in staff.
  const auth = await requireUser();
  if (auth.error) return auth.error;

  // Reject anything that isn't a bare file name (blocks ../ traversal).
  const name = params.name;
  if (name !== path.basename(name)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(name).toLowerCase()];
  if (!contentType) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const bytes = await fs.readFile(path.join(UPLOAD_DIR, name));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
