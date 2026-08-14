// src/app/api/editor/request-raws/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { client as clientTable, editorClientPermission } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import { sendSlackWebhook, sendToChannel } from "@/lib/slack";

const ERIC_SLACK_ID = "U047GKLSCBD";

export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);

    if (!user || user.role !== "editor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { clientId } = body;

    if (!clientId || typeof clientId !== "string") {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const [[client], [permission]] = await Promise.all([
      db.select({
        id: clientTable.id,
        name: clientTable.name,
        companyName: clientTable.companyName,
        slackEnabled: clientTable.slackEnabled,
        slackWebhookUrl: clientTable.slackWebhookUrl,
      }).from(clientTable).where(eq(clientTable.id, clientId)).limit(1),
      db.select().from(editorClientPermission)
        .where(and(eq(editorClientPermission.editorId, user.id), eq(editorClientPermission.clientId, clientId)))
        .limit(1),
    ]);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!permission) {
      return NextResponse.json({ error: "No permission for this client" }, { status: 403 });
    }

    const clientDisplayName = client.companyName || client.name;
    const editorName = user.name || `Editor #${user.id}`;

    const message =
      `📦 *Raw Footage Request*\n` +
      `<@${ERIC_SLACK_ID}> — *${editorName}* has requested raw footage for client *${clientDisplayName}*.\n` +
      `Please upload the raws to the client folder as soon as possible.`;

    const notification = {
      type: "raw_footage_request",
      message,
    };

    let sentToClientChannel = false;

    if (client.slackEnabled && client.slackWebhookUrl) {
      sentToClientChannel = await sendSlackWebhook(notification, client.slackWebhookUrl);
    }

    if (!sentToClientChannel) {
      console.log(
        `[request-raws] Client "${clientDisplayName}" has no Slack channel — falling back to e8app channel`
      );
      await sendToChannel("e8app", notification);
    }

    return NextResponse.json({
      ok: true,
      sentToClientChannel,
      clientName: clientDisplayName,
    });
  } catch (err) {
    console.error("[request-raws] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}