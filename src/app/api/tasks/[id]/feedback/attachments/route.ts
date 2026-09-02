export const dynamic = 'force-dynamic';
// app/api/tasks/[id]/feedback/attachments/route.ts
//
// Uploads a single attachment for a review comment — a recorded voice
// note, a general file/image, or a captured/drawn-on screenshot — to R2
// and returns its URL. The comment itself (with these URLs attached) is
// then created/saved via the existing POST/PATCH handlers in
// /api/tasks/[id]/feedback/route.ts. Kept as a separate endpoint so the
// upload can happen as soon as the user records/picks a file, rather than
// blocking comment submission on it.
//
// Workers-compatible: reads the upload into an in-memory Buffer via
// arrayBuffer() (no filesystem access), same pattern as
// /api/upload/brand-asset/route.ts.

import { NextRequest, NextResponse } from "next/server";
import { uploadBufferToS3 } from "@/lib/s3";

// Comment attachments are small (voice clips, screenshots, the occasional
// reference file) — cap well below R2/Workers request-body limits.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!taskId) {
      return NextResponse.json({ error: "Missing task id" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: `File exceeds ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB limit` },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeName = sanitizeFilename(file.name || "attachment");
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const upload = await uploadBufferToS3({
      buffer,
      folderPrefix: `comments/${taskId}/`,
      filename,
      mimeType: file.type || "application/octet-stream",
    });

    return NextResponse.json({
      url: upload.url,
      name: file.name || safeName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    });
  } catch (error: any) {
    console.error("Error uploading comment attachment:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}