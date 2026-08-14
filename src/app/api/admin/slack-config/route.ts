// src/app/api/admin/slack-config/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { slackConfig as slackConfigTable } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createId } from "@/lib/db/id";
import { getCurrentUser2 } from "@/lib/auth";
import { sendSlackTestMessage } from "@/lib/slack";

export const dynamic = "force-dynamic";

// GET — fetch current Slack webhook config
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const [configRow] = await db.select().from(slackConfigTable)
      .orderBy(desc(slackConfigTable.updatedAt))
      .limit(1);
    const config = configRow ?? null;

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("[Slack Config] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

// POST — create or update Slack webhook config
export async function POST(req: NextRequest) {
  const db = getDbHttp();
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
    const [existing] = await db.select().from(slackConfigTable).limit(1);

    let config;
    if (existing) {
      [config] = await db.update(slackConfigTable).set({
        webhookUrl,
        channelName: channelName || null,
        isActive: isActive ?? true,
        updatedAt: new Date().toISOString(),
      }).where(eq(slackConfigTable.id, existing.id)).returning();
    } else {
      [config] = await db.insert(slackConfigTable).values({
        id: createId(),
        webhookUrl,
        channelName: channelName || null,
        isActive: isActive ?? true,
        updatedAt: new Date().toISOString(),
      }).returning();
    }

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("[Slack Config] POST error:", error);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
