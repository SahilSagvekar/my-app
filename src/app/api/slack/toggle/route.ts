// src/app/api/slack/toggle/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH — toggle slackNotifications on/off
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { enabled } = await req.json();

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
    }

    // Can only enable if Slack is linked
    if (enabled && !user.slackUserId) {
      return NextResponse.json(
        { error: "Link your Slack account first before enabling notifications" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { slackNotifications: enabled },
    });

    return NextResponse.json({ success: true, slackNotifications: enabled });
  } catch (error) {
    console.error("[Slack Toggle] Error:", error);
    return NextResponse.json({ error: "Failed to update Slack preference" }, { status: 500 });
  }
}
