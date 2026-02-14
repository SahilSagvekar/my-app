// src/app/api/admin/slack-config/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { sendSlackTestMessage } from "@/lib/slack";

export const dynamic = "force-dynamic";

// GET — fetch current Slack webhook config
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const config = await prisma.slackConfig.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("[Slack Config] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

// POST — create or update Slack webhook config
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { webhookUrl, channelName, isActive, test } = body;

    // If test=true, just send a test message to the provided URL
    if (test && webhookUrl) {
      const success = await sendSlackTestMessage(webhookUrl);
      return NextResponse.json({ success, message: success ? "Test message sent!" : "Failed to send test message" });
    }

    if (!webhookUrl) {
      return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
    }

    // Upsert — find existing config or create new one
    const existing = await prisma.slackConfig.findFirst();

    let config;
    if (existing) {
      config = await prisma.slackConfig.update({
        where: { id: existing.id },
        data: {
          webhookUrl,
          channelName: channelName || null,
          isActive: isActive ?? true,
        },
      });
    } else {
      config = await prisma.slackConfig.create({
        data: {
          webhookUrl,
          channelName: channelName || null,
          isActive: isActive ?? true,
        },
      });
    }

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("[Slack Config] POST error:", error);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
