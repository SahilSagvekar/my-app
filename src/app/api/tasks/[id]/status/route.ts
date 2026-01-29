// src/app/api/tasks/[id]/status/route.ts
// 
// UPDATED VERSION - Add titling trigger on QC approval
// Replace your existing route.ts with this

import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { createAuditLog, AuditAction } from '@/lib/audit-logger';
import { startTitlingJob } from '@/lib/titling-service';
import jwt from "jsonwebtoken";

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

    const updateData: any = {};

    if (feedback !== undefined) updateData.feedback = feedback;
    if (qcNotes !== undefined) updateData.qcNotes = qcNotes;
    if (route !== undefined) updateData.route = route;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        client: true,
        files: {
          where: { isActive: true },
        },
      },
    });

    if (!task)
      return NextResponse.json({ message: "Task not found" }, { status: 404 });

    // Handle client review requirement
    if (
      role.toLowerCase() === "qc" &&
      status === "COMPLETED" &&
      task.client?.requiresClientReview === true
    ) {
      finalStatus = "CLIENT_REVIEW";
    }

    if (role.toLowerCase() === "client") {
      if (status === "COMPLETED") {
        finalStatus = "COMPLETED";
      } else if (status === "REJECTED") {
        finalStatus = "REJECTED";
      }
    }

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...updateData,
        status: finalStatus,
        updatedAt: new Date(),
      },
    });

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
    // NEW: Email Notifications
    // ============================================
    try {
      if (finalStatus === "IN_PROGRESS" && task.status !== "IN_PROGRESS") {
        // Only trigger if role is editor or admin/manager starting it
        const { sendEditorStartedEmail } = await import("@/lib/email-notifications");
        sendEditorStartedEmail(id, user?.name || "An editor");
      } else if (finalStatus === "CLIENT_REVIEW" && task.status !== "CLIENT_REVIEW") {
        const { sendTaskReadyForReviewEmail } = await import("@/lib/email-notifications");
        sendTaskReadyForReviewEmail(id);
      }
    } catch (emailErr) {
      console.error("[StatusUpdate] Notification error:", emailErr);
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

    return NextResponse.json({
      ...updatedTask,
      titlingTriggered: shouldTriggerTitling,
    }, { status: 200 });

  } catch (err: any) {
    console.error("❌ Task status update error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
