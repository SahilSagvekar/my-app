// src/lib/notify.ts
import { prisma } from "@/lib/prisma";
// import { broadcastNotification } from "@/lib/notifications-bus";
import { deliverSlackNotification } from "@/lib/slack";

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
 * Also delivers to Slack (webhook + DM) if configured.
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
  // try {
  //   broadcastNotification(notification);
  // } catch (err) {
  //   console.warn("SSE broadcast failed:", err);
  // }

  // Deliver to Slack (webhook + DM) — fire-and-forget
  deliverSlackNotification({
    type,
    title,
    body,
    payload,
    userId: userIdValue,
  }).catch((err) => console.warn("[Slack] delivery error:", err));

  return notification;
}

/**
 * Notify an editor that they've been assigned one or more tasks (new
 * assignment or reassignment onto them). Creates a single in-app
 * notification and a single grouped Slack message to the #editors
 * channel — e.g. "You've been assigned 3 tasks: A, B, C" — rather than
 * one message per task, even when the tasks were assigned in bulk.
 *
 * Call this only when the assignedTo editor actually changed (or was
 * newly set), not on unrelated edits to an already-assigned task.
 */
export async function notifyEditorTaskAssignment(
  editorId: number,
  taskIds: string[],
) {
  if (!editorId || !taskIds || taskIds.length === 0) return null;

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, title: true },
  });

  if (tasks.length === 0) return null;

  const taskTitles = tasks.map((t) => t.title || "Untitled");
  const count = tasks.length;
  const title =
    count === 1 ? "New Task Assigned" : `${count} New Tasks Assigned`;
  const body =
    count === 1
      ? `You have been assigned a new task: ${taskTitles[0]}`
      : `You have been assigned ${count} tasks: ${taskTitles.join(", ")}`;

  const notification = await prisma.notification.create({
    data: {
      userId: editorId,
      type: "task_assigned",
      title,
      body,
      payload: { taskIds: tasks.map((t) => t.id), taskTitles } as any,
      channel: ["in-app"],
    },
  });

  deliverSlackNotification({
    type: "task_assigned",
    title,
    body,
    payload: { taskIds: tasks.map((t) => t.id), taskTitles },
    userId: editorId,
  }).catch((err) => console.warn("[Slack] delivery error:", err));

  return notification;
}