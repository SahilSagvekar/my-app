export const dynamic = "force-dynamic";
// POST   /api/dev-portal/tickets/[id]/attachments — upload one screenshot (multipart "file")
// DELETE /api/dev-portal/tickets/[id]/attachments?attachmentId=… — remove one
//
// Workers-compatible: buffers the upload in memory (no filesystem), same
// pattern as /api/tasks/[id]/feedback/attachments.

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { devTicket, devTicketAttachment } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { deleteFromS3, generateSignedUrl, uploadBufferToS3 } from "@/lib/s3";
import { MAX_SCREENSHOT_BYTES, getDevPortalAuth } from "@/lib/dev-portal";

const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getDevPortalAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDbHttp();
  const [ticket] = await db.select().from(devTicket).where(eq(devTicket.id, id)).limit(1);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Portal users can attach to anything; a client only to a ticket they filed.
  if (!auth.hasPortal && ticket.reporterId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image screenshots are supported (use a Loom link for video)" }, { status: 400 });
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    return NextResponse.json({ error: `Image exceeds ${MAX_SCREENSHOT_BYTES / (1024 * 1024)}MB limit` }, { status: 413 });
  }

  const upload = await uploadBufferToS3({
    buffer: Buffer.from(await file.arrayBuffer()),
    folderPrefix: `dev-portal/${id}/`,
    filename: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitize(file.name || "screenshot.png")}`,
    mimeType: file.type,
  });

  const [row] = await db
    .insert(devTicketAttachment)
    .values({
      id: createId(),
      ticketId: id,
      r2Key: upload.key,
      fileName: file.name || "screenshot.png",
      mimeType: file.type,
      size: file.size,
      uploadedById: auth.userId,
    })
    .returning();

  return NextResponse.json({
    ok: true,
    attachment: {
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt,
      url: await generateSignedUrl(row.r2Key, 3600),
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getDevPortalAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.hasPortal) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const attachmentId = new URL(req.url).searchParams.get("attachmentId");
  if (!attachmentId) return NextResponse.json({ error: "Missing attachmentId" }, { status: 400 });

  const db = getDbHttp();
  const [row] = await db
    .select()
    .from(devTicketAttachment)
    .where(and(eq(devTicketAttachment.id, attachmentId), eq(devTicketAttachment.ticketId, id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!auth.canTriage && row.uploadedById !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(devTicketAttachment).where(eq(devTicketAttachment.id, attachmentId));
  await deleteFromS3(row.r2Key).catch(() => {});
  return NextResponse.json({ ok: true });
}
