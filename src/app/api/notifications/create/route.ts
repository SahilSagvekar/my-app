import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";


const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL || "";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || !user.userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { type, title, body: msg, payload, channels = ["in-app"] } = body;

    if (!type || !title)
      return NextResponse.json({ error: "type & title required" }, { status: 400 });

    const notification = await prisma.notification.create({
      data: {
        userId: user.userId,    // 🔥 IMPORTANT
        type,
        title,
        body: msg ?? "",
        payload: payload ?? null,
        channel: channels,
      }
    });

    // Broadcast to the user's SSE listener
    const { broadcastNotification } = await import("@/lib/notifications-bus");
    broadcastNotification(notification);

    return NextResponse.json({ notification }, { status: 201 });
  } catch (err) {
    console.error("Create notif error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
