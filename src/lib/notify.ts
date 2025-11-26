// src/lib/notify.ts
import { prisma } from "@/lib/prisma";
import { redisConnection } from "@/lib/redis";
import { Queue } from "bullmq";
import { broadcastNotification } from "@/lib/notifications-bus";

const notifQueue = new Queue("notifications", { connection: redisConnection });

export type NotifyOpts = {
  userId: string | number | null;    // recipient userId (null => broadcast)
  type: string;                      // e.g. "task_assigned"
  title: string;
  body?: string;
  payload?: Record<string, any>;
  channels?: string[];               // default ["in-app","slack"] or ["in-app"]
};

/**
 * Creates notification in DB, broadcasts to SSE clients, and enqueues delivery job.
 * Use this from server-side logic (not the client).
 */
export async function notifyUser(opts: NotifyOpts) {
  const { userId, type, title, body, payload, channels = ["in-app", "slack"] } = opts;

  // Normalise userId to string (Prisma type depends on your schema — adjust as needed)
  const userIdValue = userId === null ? null : String(userId);

  const notification = await prisma.notification.create({
    data: {
      userId: userIdValue,
      type,
      title,
      body: body ?? null,
      payload: payload ?? null,
      channel: channels
    },
  });

  // Broadcast to SSE (per-user bus checks userId)
  try {
    broadcastNotification(notification);
  } catch (err) {
    console.warn("SSE broadcast failed:", err);
  }

  // Enqueue a job for channel delivery (Slack/email) - worker will handle retries
  await notifQueue.add(
    "deliver",
    { notificationId: notification.id, channels },
    { attempts: 5, backoff: { type: "exponential", delay: 1000 } }
  );

  return notification;
}
