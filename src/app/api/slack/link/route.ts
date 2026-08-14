// src/app/api/slack/link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { getDbHttp } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST — link user's Slack account by looking up their email
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.SLACK_BOT_TOKEN) {
      return NextResponse.json(
        { error: "Slack bot is not configured. Contact your admin." },
        { status: 503 }
      );
    }

    const client = new WebClient(process.env.SLACK_BOT_TOKEN);

    // Look up the user's Slack member ID by their email
    let slackUser;
    try {
      const result = await client.users.lookupByEmail({ email: user.email });
      slackUser = result.user;
    } catch (err: any) {
      if (err?.data?.error === "users_not_found") {
        return NextResponse.json(
          {
            error: `No Slack account found for ${user.email}. Make sure you use the same email in Slack.`,
          },
          { status: 404 }
        );
      }
      throw err;
    }

    if (!slackUser?.id) {
      return NextResponse.json({ error: "Could not resolve Slack user ID" }, { status: 404 });
    }

    // Save the Slack user ID to the database.
    // User.updatedAt is @updatedAt in Prisma (client-managed) — set
    // explicitly, matching that behavior.
    await db.update(userTable).set({
      slackUserId: slackUser.id,
      slackNotifications: true, // Auto-enable on link
      updatedAt: new Date().toISOString(),
    }).where(eq(userTable.id, user.id));

    return NextResponse.json({
      success: true,
      slackUserId: slackUser.id,
      slackName: slackUser.real_name || slackUser.name,
    });
  } catch (error) {
    console.error("[Slack Link] Error:", error);
    return NextResponse.json({ error: "Failed to link Slack account" }, { status: 500 });
  }
}

// DELETE — unlink Slack account
export async function DELETE(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.update(userTable).set({
      slackUserId: null,
      slackNotifications: false,
      updatedAt: new Date().toISOString(),
    }).where(eq(userTable.id, user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Slack Unlink] Error:", error);
    return NextResponse.json({ error: "Failed to unlink Slack account" }, { status: 500 });
  }
}
