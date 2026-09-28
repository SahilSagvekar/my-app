export const dynamic = 'force-dynamic';

// src/app/api/client/general-comments/route.ts
//
// "Send a note" on the client's Content Review page — a freeform comment
// that isn't tied to any specific video/task (unlike the per-video feedback
// in FullScreenReviewModalFrameIO, which writes to TaskFeedback). Saved for
// an audit trail, then posted to the client's own Slack channel with the
// scheduler @mentioned — see the client_general_comment case in
// deliverSlackNotification (src/lib/slack.ts). Slack-only: no in-app bell
// notification and nothing is shown back to the client (fire-and-confirm).

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbHttp } from "@/lib/db";
import { user as userTable, clientGeneralComment as clientGeneralCommentTable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq } from "drizzle-orm";
import { deliverSlackNotification } from "@/lib/slack";

const MAX_COMMENT_LENGTH = 4000;

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

function getUserIdFromToken(token: string): number | null {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
  return decoded?.userId != null ? Number(decoded.userId) : null;
}

export async function POST(req: Request) {
  const db = getDbHttp();
  const token = getTokenFromCookies(req);
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const userId = getUserIdFromToken(token);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { body } = await req.json();
    const cleanBody = typeof body === "string" ? body.trim() : "";
    if (!cleanBody) {
      return NextResponse.json({ message: "Comment can't be empty" }, { status: 400 });
    }
    if (cleanBody.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json({ message: `Comment is too long (max ${MAX_COMMENT_LENGTH} characters)` }, { status: 413 });
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
      columns: { id: true, name: true },
      // "client" is the drizzle relation name for User.linkedClientId -> Client.id
      with: { client: { columns: { id: true, name: true, companyName: true } } },
    });

    if (!user?.client) {
      // Only client-portal users (linkedClientId set) can send these.
      return NextResponse.json({ message: "No client account linked to this user" }, { status: 403 });
    }

    const id = createId();
    await db.insert(clientGeneralCommentTable).values({
      id,
      clientId: user.client.id,
      createdBy: userId,
      body: cleanBody,
    });

    try {
      await deliverSlackNotification({
        type: "client_general_comment",
        userId,
        payload: {
          clientId: user.client.id,
          clientName: user.client.companyName || user.client.name,
          submitterName: user.name || "A client contact",
          commentBody: cleanBody,
        },
      });
      await db
        .update(clientGeneralCommentTable)
        .set({ slackDeliveredAt: new Date().toISOString() })
        .where(eq(clientGeneralCommentTable.id, id));
    } catch (slackErr) {
      // The note is already saved — a Slack hiccup shouldn't fail the request.
      console.error("[POST /api/client/general-comments] Slack delivery failed:", slackErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/client/general-comments]", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}