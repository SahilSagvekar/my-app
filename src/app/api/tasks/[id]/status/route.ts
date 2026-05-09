export const dynamic = 'force-dynamic';
// src/app/api/tasks/[id]/status/route.ts
// 
// UPDATED VERSION - Add titling trigger on QC approval
// Replace your existing route.ts with this

import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { createAuditLog, AuditAction } from '@/lib/audit-logger';
import { startTitlingJob } from '@/lib/titling-service';
import { notifyUser } from "@/lib/notify";
import jwt from "jsonwebtoken";

function sanitizeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeBigInt);
  if (typeof obj === "object") {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = sanitizeBigInt(obj[key]);
    }
    return newObj;
  }
  return obj;
}

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    const body = await req.json();
    const { status, feedback, qcNotes, route } = body;

    let finalStatus = status;

    if (!status)
      return NextResponse.json({ message: "Status is required" }, { status: 400 });

    console.log(`\n[StatusUpdate] User ${userId} (${role}) is updating task ${id} to status: ${status}`);
    const updateData: any = {};

    if (feedback !== undefined) updateData.feedback = feedback;
    if (qcNotes !== undefined) updateData.qcNotes = qcNotes;
    if (route !== undefined) updateData.route = route;

    let task: any;
    try {
      task = await prisma.task.findUnique({
        where: { id },
        include: {
          client: true,
          files: {
            where: { isActive: true },
          },
        },
      });
    } catch (readErr: any) {
      // Older tasks may have a stale status value not present in the current TaskStatus enum.
      // Prisma throws P2009 / "Expected TaskStatus" on read too, so fall back to raw SQL.
      if (
        readErr.message?.includes("Expected TaskStatus") ||
        readErr.message?.includes("validation") ||
        readErr.code === "P2009"
      ) {
        console.warn("⚠️ Prisma Enum Validation failed on task read. Using raw SQL fallback for initial fetch...");
        const rawRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT t.*, row_to_json(c.*) AS client
           FROM "Task" t
           LEFT JOIN "Client" c ON t."clientId" = c.id
           WHERE t.id = $1`,
          id
        );
        if (!rawRows || rawRows.length === 0) {
          return NextResponse.json({ message: "Task not found" }, { status: 404 });
        }
        const raw = rawRows[0];
        task = {
          ...raw,
          client: raw.client,
          files: await prisma.$queryRawUnsafe(
            `SELECT * FROM "File" WHERE "taskId" = $1 AND "isActive" = true`,
            id
          ),
        };
      } else {
        throw readErr;
      }
    }

    if (!task)
      return NextResponse.json({ message: "Task not found" }, { status: 404 });

    console.log("ROLE" + role);
    // Handle client review requirement
    if (
      (role.toLowerCase() === "qc" || role.toLowerCase() === "admin") &&
      status === "COMPLETED" &&
      task.client?.requiresClientReview === true
    ) {
      const allowedTypes: string[] = task.client?.clientReviewDeliverableTypes ?? [];
      const taskType: string = task.deliverableType ?? "";
      // If no types configured → all tasks go to review (backwards compatible).
      // If types configured → only matching deliverable types go to review.
      const shouldReview = allowedTypes.length === 0 || allowedTypes.includes(taskType);
      if (shouldReview) {
        finalStatus = "CLIENT_REVIEW";
      }
    }

    if (role.toLowerCase() === "client") {
      if (status === "COMPLETED") {
        finalStatus = "COMPLETED";
      } else if (status === "REJECTED") {
        finalStatus = "REJECTED";
      } else if (status === "POSTED") {
        finalStatus = "POSTED";
      }
    }

    // Update task
    // 🔥 Track QC reviewer when QC approves/rejects
    const isQCAction = (role.toLowerCase() === "qc" || role.toLowerCase() === "admin") &&
      (finalStatus === "COMPLETED" || finalStatus === "CLIENT_REVIEW" || finalStatus === "REJECTED");

    if (isQCAction) {
      updateData.qcReviewedBy = userId;
      updateData.qcReviewedAt = new Date();
    }

    let updatedTask: any;
    try {
      updatedTask = await (prisma.task as any).update({
        where: { id },
        data: {
          ...updateData,
          status: finalStatus,
          updatedAt: new Date(),
        },
      });
    } catch (e: any) {
      // If Prisma fails due to the enum mismatch (P2009 or specific error message), 
      // we use Raw SQL to force the update and bypass runtime enum checks.
      if (e.message?.includes("Expected TaskStatus") || e.message?.includes("validation") || e.code === "P2009") {
        console.warn("⚠️ Prisma Enum Validation failed for status. Using raw SQL fallback...");

        // Construct raw update
        // Note: We use executeRawUnsafe for maximum flexibility with the enum string
        await prisma.$executeRawUnsafe(
          `UPDATE "Task" SET "status" = $1, "updatedAt" = $2 WHERE "id" = $3`,
          finalStatus,
          new Date(),
          id
        );

        // Try to fetch the updated record. 
        // If findUnique also fails because it can't parse the new enum value, return raw data.
        try {
          updatedTask = await (prisma.task as any).findUnique({
            where: { id }
          });
        } catch (readErr) {
          const rawResult: any = await prisma.$queryRawUnsafe(
            `SELECT * FROM "Task" WHERE "id" = $1`,
            id
          );
          updatedTask = rawResult && Array.isArray(rawResult) ? rawResult[0] : { id, status: finalStatus };
        }
      } else {
        throw e;
      }
    }

    // ============================================
    // NEW: Trigger AI titling on QC approval
    // ============================================
    const shouldTriggerTitling =
      role.toLowerCase() === "qc" &&
      (finalStatus === "COMPLETED" || finalStatus === "CLIENT_REVIEW") &&
      task.titlingStatus !== 'COMPLETED' && // Don't re-trigger if already done
      task.titlingStatus !== 'PROCESSING'; // Don't re-trigger if in progress

    if (shouldTriggerTitling) {
      // Check if task has a video file
      const hasVideoFile = task.files.some(f => f.mimeType?.startsWith('video/'));

      if (hasVideoFile) {
        console.log(`\n🎬 QC approved task ${id} - triggering AI titling`);

        // Start titling in background (don't await - let it run async)
        startTitlingJob(id)
          .then(({ jobId, transcriptId }) => {
            console.log(`   ✅ Titling job started: ${jobId}`);
          })
          .catch((err) => {
            console.error(`   ❌ Failed to start titling job:`, err.message);
            // Update task to show titling failed
            prisma.task.update({
              where: { id },
              data: {
                titlingStatus: 'FAILED',
                titlingError: err.message,
              },
            }).catch(console.error);
          });
      } else {
        console.log(`   ℹ️ Task ${id} has no video file - skipping titling`);
      }
    }
    // ============================================

    // Audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // ============================================
    // NEW: In-app & Email Notifications
    // ============================================
    try {
      if (finalStatus === "READY_FOR_QC" && task.status !== "READY_FOR_QC") {
        // Notify QC specialist
        if (task.qc_specialist) {
          await notifyUser({
            userId: task.qc_specialist,
            type: "qc_ready",
            title: "Content Ready for QC Review",
            body: `Your content "${task.title}" is ready for review.`,
            payload: {
              taskId: task.id,
              clientId: task.clientId,
              qcId: task.qc_specialist,
              taskTitle: task.title,
            },
          });
        }
      }

      // else if (finalStatus === "REJECTED" && task.status !== "REJECTED") {
      //   // Notify Editor
      //   await notifyUser({
      //     userId: task.assignedTo,
      //     type: "task_rejected",
      //     title: "Task Needs Revision",
      //     body: `Task "${task.title}" has been rejected: ${qcNotes || feedback || "Please check QC notes / feedback."}`,
      //     payload: { taskId: task.id, clientId: task.clientId }
      //   });
      // }
      else if (finalStatus === "REJECTED" && task.status !== "REJECTED") {
        // Notify Editor
        await notifyUser({
          userId: task.assignedTo,
          type: "task_rejected",
          title: "Content Needs Revisions",
          body: `Task "${task.title}" has been rejected: ${qcNotes || feedback || "Please check QC notes / feedback."}`,
          payload: {
            taskId: task.id,
            clientId: task.clientId,
            editorId: task.assignedTo,
            taskTitle: task.title, // ← add this
          },
        });
      } else if (
        finalStatus === "CLIENT_REVIEW" &&
        task.status !== "CLIENT_REVIEW"
      ) {
        // Email
        console.log(`\n📧 sending email notification`);
        const { sendTaskReadyForReviewEmail } =
          await import("@/lib/email-notifications");
        sendTaskReadyForReviewEmail(id);

        // Notify Client User
        if (task.clientUserId) {
          await notifyUser({
            userId: task.clientUserId,
            type: "review_queue",
            title: "Content Ready for Review",
            body: `Your content "${task.title}" is ready for review.`,
            payload: { taskId: task.id, clientId: task.clientId },
          });
        }
      } else if (finalStatus === "COMPLETED" && task.status !== "COMPLETED") {
        // Notify Editor that it's approved
        await notifyUser({
          userId: task.assignedTo,
          type: "qc_approval",
          title: "Task Approved",
          body: `Your task "${task.title}" has been approved.`,
          payload: { taskId: task.id, clientId: task.clientId },
        });

        // Notify Scheduler
        if (task.scheduler) {
          await notifyUser({
            userId: task.scheduler,
            type: "approved_content",
            title: "New Content to Schedule",
            body: `Task "${task.title}" is approved and ready for scheduling.`,
            payload: { taskId: task.id, clientId: task.clientId },
          });

          await notifyUser({
            userId: task.scheduler,
            type: "task_scheduled",
            title: "Task Ready for Scheduling",
            body: `Task "${task.title}" is ready for scheduling.`,
            payload: {
              taskId: task.id,
              clientId: task.clientId,
              taskTitle: task.title,
              schedulerId: task.scheduler,
              notificationStage: "ready_for_scheduling",
            },
          });
        }
      } else if (
        finalStatus === "SCHEDULED" &&
        task.status !== "SCHEDULED"
      ) {
        await notifyUser({
          userId: task.scheduler || userId,
          type: "task_scheduled",
          title: "Content Scheduled",
          body: `Task "${task.title}" has been scheduled.`,
          payload: {
            taskId: task.id,
            clientId: task.clientId,
            taskTitle: task.title,
            schedulerId: task.scheduler,
            notificationStage: "scheduled",
          },
        });
      } else if (finalStatus === "POSTED" && task.status !== "POSTED") {
        // Notify Team that content is Live/Posted
        await notifyUser({
          userId: task.assignedTo,
          type: "task_posted",
          title: "Content Posted! 🚀",
          body: `Content for "${task.title}" has been successfully posted.`,
          payload: { taskId: task.id, clientId: task.clientId },
        });

        await notifyUser({
          userId: task.scheduler || userId,
          type: "task_scheduled",
          title: "Content Posted",
          body: `Task "${task.title}" has been posted.`,
          payload: {
            taskId: task.id,
            clientId: task.clientId,
            taskTitle: task.title,
            schedulerId: task.scheduler,
            notificationStage: "posted",
          },
        });
      }
    } catch (notifErr) {
      console.error("[StatusUpdate] Notification error:", notifErr);
    }
    // ============================================

    await createAuditLog({
      userId: userId,
      action: AuditAction.TASK_UPDATED,
      entity: "Task",
      entityId: id,
      details: `Task status updated to: ${finalStatus}`,
      metadata: {
        taskId: id,
        previousStatus: task.status,
        newStatus: finalStatus,
        updatedBy: user?.name,
        role: role,
      },
    });

    return NextResponse.json(sanitizeBigInt({
      ...updatedTask,
      titlingTriggered: shouldTriggerTitling,
    }), { status: 200 });

  } catch (err: any) {
    console.error("❌ Task status update error:", err.message);
    return NextResponse.json(
      {
        message: "Server error",
        error: err.message,
        stack: err.stack,
        details: err.code === 'P2009' ? 'Query validation error (likely status enum mismatch)' : 'Internal error'
      },
      { status: 500 }
    );
  }
}