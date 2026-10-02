export const dynamic = "force-dynamic";
// GET    /api/dev-portal/tickets/[id] — detail + comments + signed screenshot URLs
// PATCH  /api/dev-portal/tickets/[id] — edit. Triagers: priority/status/assignee/anything.
//        The reporter may edit their own title/description/type/loom while OPEN.
// DELETE /api/dev-portal/tickets/[id] — triagers only

import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDbHttp } from "@/lib/db";
import { devTicket, devTicketAttachment, devTicketComment, user as userTable } from "@/lib/db/schema";
import { notifyUser } from "@/lib/notify";
import { generateSignedUrl, deleteFromS3 } from "@/lib/s3";
import {
  LOOM_URL_RE,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  getDevPortalAuth,
} from "@/lib/dev-portal";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getDevPortalAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.hasPortal) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = getDbHttp();
  const reporter = alias(userTable as any, "reporter") as any;
  const assignee = alias(userTable as any, "assignee") as any;

  const [ticket] = await db
    .select({
      id: devTicket.id,
      title: devTicket.title,
      description: devTicket.description,
      type: devTicket.type,
      source: devTicket.source,
      clientId: devTicket.clientId,
      clientName: devTicket.clientName,
      priority: devTicket.priority,
      status: devTicket.status,
      loomUrl: devTicket.loomUrl,
      reporterId: devTicket.reporterId,
      reporterName: reporter.name,
      assigneeId: devTicket.assigneeId,
      assigneeName: assignee.name,
      resolvedAt: devTicket.resolvedAt,
      createdAt: devTicket.createdAt,
      updatedAt: devTicket.updatedAt,
    })
    .from(devTicket)
    .leftJoin(reporter, eq(reporter.id, devTicket.reporterId))
    .leftJoin(assignee, eq(assignee.id, devTicket.assigneeId))
    .where(eq(devTicket.id, id))
    .limit(1);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [attachmentRows, comments] = await Promise.all([
    db.select().from(devTicketAttachment).where(eq(devTicketAttachment.ticketId, id)).orderBy(asc(devTicketAttachment.createdAt)),
    db
      .select({
        id: devTicketComment.id,
        message: devTicketComment.message,
        createdAt: devTicketComment.createdAt,
        authorId: devTicketComment.authorId,
        authorName: userTable.name,
      })
      .from(devTicketComment)
      .leftJoin(userTable, eq(userTable.id, devTicketComment.authorId))
      .where(eq(devTicketComment.ticketId, id))
      .orderBy(asc(devTicketComment.createdAt)),
  ]);

  // Bucket is private — hand the browser short-lived signed URLs.
  const attachments = await Promise.all(
    attachmentRows.map(async (a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
      url: await generateSignedUrl(a.r2Key, 3600),
    }))
  );

  return NextResponse.json({ ticket, attachments, comments, me: { userId: auth.userId, canTriage: auth.canTriage } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getDevPortalAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.hasPortal) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getDbHttp();
  const [existing] = await db.select().from(devTicket).where(eq(devTicket.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isReporter = existing.reporterId === auth.userId;
  const triageFields = ["priority", "status", "assigneeId"];
  const touchesTriage = triageFields.some((f) => f in body);
  if (touchesTriage && !auth.canTriage) {
    return NextResponse.json({ error: "Only admins can set priority, status or assignee" }, { status: 403 });
  }
  if (!auth.canTriage && !(isReporter && existing.status === "OPEN")) {
    return NextResponse.json({ error: "You can only edit your own open tickets" }, { status: 403 });
  }

  const patch: Record<string, any> = { updatedAt: new Date().toISOString() };

  if ("title" in body) {
    const t = String(body.title || "").trim();
    if (!t || t.length > 200) return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    patch.title = t;
  }
  if ("description" in body) patch.description = body.description ? String(body.description).trim().slice(0, 10000) : null;
  if ("type" in body) {
    if (!TICKET_TYPES.includes(body.type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    patch.type = body.type;
  }
  if ("loomUrl" in body) {
    const l = body.loomUrl ? String(body.loomUrl).trim() : null;
    if (l && !LOOM_URL_RE.test(l)) return NextResponse.json({ error: "Invalid Loom link" }, { status: 400 });
    patch.loomUrl = l;
  }
  if ("priority" in body) {
    if (!TICKET_PRIORITIES.includes(body.priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    patch.priority = body.priority;
  }
  if ("status" in body) {
    if (!TICKET_STATUSES.includes(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    patch.status = body.status;
    patch.resolvedAt = body.status === "DONE" || body.status === "WONT_FIX" ? new Date().toISOString() : null;
  }
  let newAssignee: number | null | undefined;
  if ("assigneeId" in body) {
    newAssignee = body.assigneeId === null || body.assigneeId === "" ? null : Number(body.assigneeId);
    if (newAssignee !== null) {
      const [u] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.id, newAssignee)).limit(1);
      if (!u) return NextResponse.json({ error: "Assignee not found" }, { status: 400 });
    }
    patch.assigneeId = newAssignee;
  }

  const [updated] = await db.update(devTicket).set(patch).where(eq(devTicket.id, id)).returning();

  // Tell a newly assigned person (not if they assigned it to themselves).
  if (newAssignee && newAssignee !== existing.assigneeId && newAssignee !== auth.userId) {
    await notifyUser({
      userId: newAssignee,
      type: "dev_ticket_assigned",
      title: "Dev ticket assigned to you",
      body: updated.title,
      payload: { ticketId: id },
    }).catch((err) => console.warn("[DevPortal] assign notify failed:", err));
  }

  return NextResponse.json({ ok: true, ticket: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getDevPortalAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.canTriage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = getDbHttp();
  const files = await db.select({ r2Key: devTicketAttachment.r2Key }).from(devTicketAttachment).where(eq(devTicketAttachment.ticketId, id));
  await db.delete(devTicket).where(eq(devTicket.id, id)); // comments + attachment rows cascade
  await Promise.allSettled(files.map((f) => deleteFromS3(f.r2Key)));
  return NextResponse.json({ ok: true });
}
