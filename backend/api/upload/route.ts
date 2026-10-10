import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireUser } from "@/lib/auth";
import { DATA_DIR } from "@/lib/db";

// Stored under DATA_DIR (not public/) so files added at runtime persist on a
// mounted volume and are served by /api/uploads/[name].
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

// Allow common image and document evidence types (PDF, Word, Excel, text)
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/octet-stream",
]);

const ALLOWED_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".gif",
  ".svg",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
]);

const MAX_BYTES = 20 * 1024 * 1024;

function safeFileName(originalName: string): string {
  const rawExt = path.extname(originalName).toLowerCase();
  const ext = ALLOWED_EXTS.has(rawExt) ? rawExt : ".jpg";
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `Skyline_${stamp}_${random}${ext}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "File information is missing." },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name || "").toLowerCase();
    const isAllowedType = ALLOWED_TYPES.has(file.type);
    const isAllowedExt = ALLOWED_EXTS.has(ext);

    if (!isAllowedType && !isAllowedExt) {
      return NextResponse.json(
        { success: false, message: "Unsupported file type. Please upload an image (JPG, PNG, WEBP) or document (PDF, DOC, XLS)." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, message: "File is too large (20 MB maximum)." },
        { status: 400 }
      );
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const fileName = safeFileName(file.name || "photo.jpg");
    const filePath = path.join(UPLOAD_DIR, fileName);
    const bytes = Buffer.from(await file.arrayBuffer());

    await fs.writeFile(filePath, bytes);

    return NextResponse.json({
      success: true,
      fileName,
      fileUrl: `/api/uploads/${fileName}`,
      message: "Photo uploaded successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Photo upload failed: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    );
  }
}
