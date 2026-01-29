// src/lib/notify.ts
import { prisma } from "@/lib/prisma";
import { broadcastNotification } from "@/lib/notifications-bus";

export type NotifyOpts = {
  userId: string | number | null;    // recipient userId (null => broadcast)
  type: string;                      // e.g. "task_assigned"
  title: string;
  body?: string;
  payload?: Record<string, any>;
  channels?: string[];               // default ["in-app"]
};

/**
 * Creates notification in DB and broadcasts to SSE clients.
 * Use this from server-side logic (not the client).
 */
export async function notifyUser(opts: NotifyOpts) {
  const { userId, type, title, body, payload, channels = ["in-app"] } = opts;

  // Normalise userId to Number (Prisma schema expects Int)
  const userIdValue = userId === null ? null : Number(userId);

  const notification = await prisma.notification.create({
    data: {
      userId: userIdValue,
      type,
      title,
      body: body ?? null,
      payload: (payload as any) ?? null,
      channel: channels
    },
  });

  // Broadcast to SSE (per-user bus checks userId)
  try {
    broadcastNotification(notification);
  } catch (err) {
    console.warn("SSE broadcast failed:", err);
  }

  // NOTE: External channel delivery (Slack/email) can be added here
  // or via a background job if bullmq is added later.

  return notification;
}
