export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { createAuditLog, AuditAction } from "@/lib/audit-logger";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/authToken=([^;]+)/);
  return m ? m[1] : null;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;
    if (
      !["scheduler", "manager", "admin"].includes((role || "").toLowerCase())
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { postedAt, notes } = await req.json().catch(() => ({}));

    const { id } = await context.params;

    // Get previous status before update (also pulls what's needed to backfill PostedContent below)
    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        monthlyDeliverable: { select: { type: true } },
        oneOffDeliverable: { select: { type: true } },
      },
    });

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        // scheduledAt: postedAt ? new Date(postedAt) : new Date(),
        // scheduledNotes: notes || null,
        updatedAt: new Date(),
      },
    });

    // Backfill PostedContent for links already on this task.
    // /api/tasks/[id]/social-media-link only creates a PostedContent row when the task is
    // ALREADY SCHEDULED/POSTED at add-link time (so client-facing "posted content" doesn't show
    // in-progress work). The normal flow adds links first, then marks the task SCHEDULED here —
    // so without this backfill, those links never get logged at all.
    if (existingTask?.clientId) {
      const links = Array.isArray(existingTask.socialMediaLinks)
        ? (existingTask.socialMediaLinks as Array<{ platform?: string; url?: string; postedAt?: string }>)
        : [];

      if (links.length > 0) {
        const alreadyLogged = await prisma.postedContent.findMany({
          where: { taskId: id },
          select: { platform: true, url: true },
        });
        const loggedKeys = new Set(alreadyLogged.map(p => `${p.platform.toLowerCase()}::${p.url}`));

        const deliverableType =
          existingTask.deliverableType ||
          existingTask.monthlyDeliverable?.type ||
          existingTask.oneOffDeliverable?.type ||
          null;

        const toCreate = links.filter(
          (l): l is { platform: string; url: string; postedAt?: string } =>
            !!l.platform && !!l.url && !loggedKeys.has(`${l.platform.toLowerCase()}::${l.url}`)
        );

        if (toCreate.length > 0) {
          await prisma.postedContent.createMany({
            data: toCreate.map(l => ({
              clientId: existingTask.clientId!,
              title: existingTask.title || existingTask.description || null,
              platform: l.platform.toLowerCase(),
              url: l.url,
              postedAt: l.postedAt ? new Date(l.postedAt) : new Date(),
              deliverableType,
              taskId: id,
            })),
          });
        }
      }
    }

    // 📝 Audit log for scheduling
    await createAuditLog({
      userId: userId,
      action: AuditAction.TASK_STATUS_CHANGED,
      entity: "Task",
      entityId: id,
      details: `Task scheduled/posted by ${role}`,
      metadata: {
        taskId: id,
        taskTitle: updated.title || updated.description,
        previousStatus: existingTask?.status,
        newStatus: "SCHEDULED",
        role: role,
        postedAt: postedAt || new Date().toISOString(),
        notes: notes || null,
      },
    });

    // 🔔 Notify editor and client
    try {
      // Notify Editor
      await notifyUser({
        userId: updated.assignedTo,
        type: "task_scheduled",
        title: "Content Scheduled/Posted",
        body: `Your task "${updated.title}" has been marked as scheduled.`,
        payload: {
          taskId: updated.id,
          clientId: updated.clientId,
          taskTitle: updated.title,
          schedulerId: updated.scheduler,
          notificationStage: "scheduled",
        },
      });

      // Notify Client User
      if (updated.clientUserId) {
        await notifyUser({
          userId: updated.clientUserId,
          type: "task_scheduled_client",
          title: "Content Live",
          body: `Content "${updated.title}" is now live/scheduled.`,
          payload: {
            taskId: updated.id,
            clientId: updated.clientId,
            taskTitle: updated.title,
            schedulerId: updated.scheduler,
            notificationStage: "scheduled",
          },
        });
      }
    } catch (notifErr) {
      console.error("Failed to send scheduled notification:", notifErr);
    }

    return NextResponse.json({ task: updated }, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/tasks/:id/mark-scheduled error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}