// src/app/api/editor/request-raws/route.ts
// Editor hits this to request raw footage for a specific client.
// Sends a Slack message to the client's channel (or e8app fallback).
// Tags Eric's Slack ID in every message.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { sendSlackWebhook, sendToChannel } from "@/lib/slack";

// Eric's Slack user ID — hardcoded same as qc_ready pattern in slack.ts
const ERIC_SLACK_ID = "U06CNSASUUX";

export async function POST(req: NextRequest) {
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

    // Fetch client + check editor has permission for this client
    const [client, permission] = await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          name: true,
          companyName: true,
          slackEnabled: true,
          slackWebhookUrl: true,
        },
      }),
      (prisma as any).editorClientPermission.findFirst({
        where: { editorId: user.id, clientId },
      }),
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

    // Try client channel first
    if (client.slackEnabled && client.slackWebhookUrl) {
      sentToClientChannel = await sendSlackWebhook(notification, client.slackWebhookUrl);
    }

    // Fallback: send to e8app channel if client has no channel configured
    if (!sentToClientChannel) {
      console.log(
        `[request-raws] Client "${clientDisplayName}" has no Slack channel — falling back to e8app channel`
      );
      await sendToChannel("e8app", notification);
    }

    console.log(
      `[request-raws] ✅ ${editorName} requested raws for "${clientDisplayName}" | clientChannel=${sentToClientChannel}`
    );

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