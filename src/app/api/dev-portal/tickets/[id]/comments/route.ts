export const dynamic = "force-dynamic";
// POST /api/dev-portal/tickets/[id]/comments

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { devTicket, devTicketComment } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { notifyUser } from "@/lib/notify";
import { getDevPortalAuth } from "@/lib/dev-portal";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getDevPortalAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.hasPortal) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const message = String(body?.message || "").trim();
  if (!message) return NextResponse.json({ error: "Comment is empty" }, { status: 400 });

  const db = getDbHttp();
  const [ticket] = await db.select().from(devTicket).where(eq(devTicket.id, id)).limit(1);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [comment] = await db
    .insert(devTicketComment)
    .values({ id: createId(), ticketId: id, authorId: auth.userId, message: message.slice(0, 5000) })
    .returning();

  // Let the assignee and the reporter know (minus the commenter).
  const targets = new Set([ticket.assigneeId, ticket.reporterId].filter((u): u is number => !!u && u !== auth.userId));
  await Promise.allSettled(
    [...targets].map((userId) =>
      notifyUser({
        userId,
        type: "dev_ticket_comment",
        title: "New comment on a dev ticket",
        body: `${ticket.title}: ${message.slice(0, 140)}`,
        payload: { ticketId: id },
      })
    )
  );

  return NextResponse.json({ ok: true, comment });
}
