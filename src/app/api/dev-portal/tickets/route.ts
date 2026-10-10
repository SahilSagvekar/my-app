export const dynamic = "force-dynamic";
// GET  /api/dev-portal/tickets — list (portal users only)
// POST /api/dev-portal/tickets — create. Portal users file INTERNAL tickets;
//   a signed-in client files a CLIENT ticket (these jump the queue and ping
//   the portal admins). Any other role is rejected.

import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { client as clientTable, devTicket, devTicketAttachment, user as userTable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { notifyUser } from "@/lib/notify";
import { sendToChannel } from "@/lib/slack";
import { keepAlive } from "@/lib/keep-alive";
import {
  DEV_PORTAL_EMAILS,
  LOOM_URL_RE,
  PRIORITY_RANK,
  TICKET_TYPES,
  getDevPortalAuth,
} from "@/lib/dev-portal";
import { alias } from "drizzle-orm/pg-core";

export async function GET(req: NextRequest) {
  const auth = getDevPortalAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.hasPortal) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const priority = sp.get("priority");
  const source = sp.get("source");
  const assignee = sp.get("assignee"); // user id | "none" | "me"

  const db = getDbHttp();
  const reporter = alias(userTable as any, "reporter") as any;
  const assigneeUser = alias(userTable as any, "assignee") as any;

  const conds = [];
  if (status && status !== "all") conds.push(eq(devTicket.status, status));
  if (priority && priority !== "all") conds.push(eq(devTicket.priority, priority));
  if (source && source !== "all") conds.push(eq(devTicket.source, source));
  if (assignee === "me") conds.push(eq(devTicket.assigneeId, auth.userId));
  else if (assignee === "none") conds.push(sql`${devTicket.assigneeId} is null`);
  else if (assignee && Number(assignee)) conds.push(eq(devTicket.assigneeId, Number(assignee)));

  const rows = await db
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
      assigneeName: assigneeUser.name,
      resolvedAt: devTicket.resolvedAt,
      createdAt: devTicket.createdAt,
      updatedAt: devTicket.updatedAt,
    })
    .from(devTicket)
    .leftJoin(reporter, eq(reporter.id, devTicket.reporterId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, devTicket.assigneeId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(devTicket.createdAt))
    .limit(500);

  // Screenshot counts in one query rather than N.
  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db
        .select({ ticketId: devTicketAttachment.ticketId, n: count() })
        .from(devTicketAttachment)
        .where(inArray(devTicketAttachment.ticketId, ids))
        .groupBy(devTicketAttachment.ticketId)
    : [];
  const countMap = new Map(counts.map((c) => [c.ticketId, Number(c.n)]));

  const open = (s: string) => s === "OPEN" || s === "IN_PROGRESS";
  const tickets = rows
    .map((r) => ({ ...r, attachmentCount: countMap.get(r.id) ?? 0 }))
    .sort((a, b) => {
      // Finished work sinks; then client reports first; then priority; then newest.
      if (open(a.status) !== open(b.status)) return open(a.status) ? -1 : 1;
      if ((a.source === "CLIENT") !== (b.source === "CLIENT")) return a.source === "CLIENT" ? -1 : 1;
      const p = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
      if (p) return p;
      return b.createdAt.localeCompare(a.createdAt);
    });

  return NextResponse.json({ tickets, me: { userId: auth.userId, canTriage: auth.canTriage } });
}

export async function POST(req: NextRequest) {
  const auth = getDevPortalAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isClient = auth.role === "client";
  if (!auth.hasPortal && !isClient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body?.title || "").trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: "Title is too long" }, { status: 400 });

  const type = TICKET_TYPES.includes(body?.type) ? body.type : "BUG";
  const description = body?.description ? String(body.description).trim().slice(0, 10000) : null;
  const loomUrl = body?.loomUrl ? String(body.loomUrl).trim() : null;
  if (loomUrl && !LOOM_URL_RE.test(loomUrl)) {
    return NextResponse.json({ error: "Loom link must look like https://www.loom.com/share/…" }, { status: 400 });
  }

  const db = getDbHttp();

  // For a client reporter, stamp which client it came from (resolved
  // server-side — never trusted from the body).
  let clientId: string | null = null;
  let clientName: string | null = null;
  if (isClient) {
    const [c] = await db
      .select({ id: clientTable.id, companyName: clientTable.companyName, name: clientTable.name })
      .from(clientTable)
      .where(eq(clientTable.userId, auth.userId))
      .limit(1);
    clientId = c?.id ?? null;
    clientName = c?.companyName || c?.name || null;
  }

  const nowIso = new Date().toISOString();
  const [ticket] = await db
    .insert(devTicket)
    .values({
      id: createId(),
      title,
      description,
      type,
      source: isClient ? "CLIENT" : "INTERNAL",
      clientId,
      clientName,
      // Only triagers set priority; client reports start UNSET but are pinned
      // to the top by source, so they can't be missed.
      priority: "UNSET",
      status: "OPEN",
      loomUrl,
      reporterId: auth.userId,
      updatedAt: nowIso,
    })
    .returning();

  // Ping the portal admins for client-reported problems.
  if (isClient) {
    const recipients = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(or(...DEV_PORTAL_EMAILS.map((e) => eq(userTable.email, e))));
    await Promise.allSettled(
      recipients.map((r) =>
        notifyUser({
          userId: r.id,
          type: "dev_ticket_client",
          title: "Client reported a problem",
          body: `${clientName || "A client"}: ${title}`,
          payload: { ticketId: ticket.id },
        })
      )
    );
  }

  // Post every new ticket (internal or client) to #e8app-dev. Fire-and-forget
  // so a Slack hiccup never fails ticket creation.
  keepAlive(
    notifyDevChannelOfTicket({
      ticketId: ticket.id,
      title,
      type,
      description,
      loomUrl,
      source: isClient ? "CLIENT" : "INTERNAL",
      clientName,
      reporterId: auth.userId,
    }).catch((err) => console.warn("[DevPortal] #e8app-dev Slack post failed:", err))
  );

  return NextResponse.json({ ok: true, ticket });
}

async function notifyDevChannelOfTicket(t: {
  ticketId: string;
  title: string;
  type: string;
  description: string | null;
  loomUrl: string | null;
  source: "CLIENT" | "INTERNAL";
  clientName: string | null;
  reporterId: number;
}) {
  const db = getDbHttp();
  const [reporter] = await db
    .select({ name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, t.reporterId))
    .limit(1);
  const reporterName = reporter?.name || reporter?.email || `User #${t.reporterId}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://e8productions.com";

  const from = t.source === "CLIENT" ? `Client: ${t.clientName || reporterName}` : `Reported by ${reporterName}`;
  const excerpt = t.description ? `\n>${t.description.slice(0, 300).replace(/\n/g, "\n>")}${t.description.length > 300 ? "…" : ""}` : "";
  const message =
    `🎫 *New Dev Ticket* — ${t.type}${t.source === "CLIENT" ? " 🚨 (client-reported)" : ""}\n` +
    `*${t.title}*\n${from}${excerpt}` +
    `${t.loomUrl ? `\n<${t.loomUrl}|Loom recording>` : ""}` +
    `\n<${appUrl}|Open E8 App>`;

  await sendToChannel("e8app_dev", { type: "dev_ticket_created", message, payload: { ticketId: t.ticketId } });
}
