export const dynamic = 'force-dynamic';
// src/app/api/tasks/[id]/status/route.ts
// 
// UPDATED VERSION - Add titling trigger on QC approval
// Replace your existing route.ts with this

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import {
  task as taskTable,
  file as fileTable,
  taskFeedback,
  user as userTable,
} from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, eq, ne, isNotNull, sql as drizzleSql } from "drizzle-orm";
import { createAuditLog, AuditAction } from '@/lib/audit-logger';
import { startTitlingJob } from '@/lib/titling-service';
import { notifyUser } from "@/lib/notify";
import { keepAlive } from "@/lib/keep-alive";
import { triggerReviewMirror } from "@/lib/review-mirror";
import { deleteYoutubeVideo } from "@/lib/youtube-mirror";
import { getCurrentUser2 } from "@/lib/auth";
import {
  isRejectedStatus,
  normalizeIncomingTaskStatus,
  REJECTED_BY_CLIENT,
  REJECTED_BY_QC,
} from "@/lib/task-status";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDbHttp();
  try {
    const { id } = await params;

    // Resolve the user from DB (authToken JWT *or* NextAuth session).
    // Previously this route only trusted JWT payload.role — new editors who
    // signed in via Google/Slack (NextAuth only) or who got their role
    // assigned after login (stale JWT with role:null) could list tasks but
    // got 401 on every status change.
    const currentUser = await getCurrentUser2(req);
    if (!currentUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (
      currentUser.employeeStatus !== 'ACTIVE' &&
      currentUser.email !== 'sahilsagvekar230@gmail.com'
    ) {
      return NextResponse.json({ message: "Account deactivated" }, { status: 403 });
    }

    const userId = Number(currentUser.id);
    const role: string = (
      currentUser.role ||
      (Array.isArray(currentUser.roles) && currentUser.roles[0]) ||
      ''
    ).toLowerCase();

    if (!role) {
      return NextResponse.json(
        { message: 'Unauthorized — no role assigned yet. Ask an admin to set your role, then refresh.' },
        { status: 401 }
      );
    }

    // 🔥 Role-switch support: any multi-role account viewing as QC (see
    // ViewAsRoleContext — e.g. Daena: editor + scheduler + qc) must be
    // treated as QC/admin for QC-gated behavior below — same pattern
    // already used in /api/tasks (GET) and /api/tasks/qc-completed.
    // Previously this only special-cased role === 'scheduler', so anyone
    // whose primary role was editor (or anything else) viewing as QC fell
    // through to their raw base role instead, which is what broke QC
    // actions for multi-role users whose primary role isn't "scheduler".
    const viewingAs = (req.headers.get('x-viewing-as') || '').toLowerCase();
    const currentUserRoles = Array.isArray((currentUser as any).roles)
      ? (currentUser as any).roles.map((r: string) => r.toLowerCase())
      : [];
    const LEGACY_ROLE_SWITCH_EMAILS = new Set([
      'eric@e8productions.com',
      'sahilsagvekar230@gmail.com',
    ]);
    const DEFAULT_ADMIN_SWITCH_ROLES = ['qc', 'sales', 'sales_manager', 'scheduler'];
    const authorizedSwitchRoles = new Set<string>([
      ...currentUserRoles,
      ...(currentUser.email && LEGACY_ROLE_SWITCH_EMAILS.has(currentUser.email.toLowerCase())
        ? DEFAULT_ADMIN_SWITCH_ROLES
        : []),
      ...(role === 'admin' ? DEFAULT_ADMIN_SWITCH_ROLES : []),
    ]);
    const effectiveRole =
      viewingAs && viewingAs !== role && authorizedSwitchRoles.has(viewingAs)
        ? (viewingAs === 'qc' ? 'admin' : viewingAs)
        : role;

    const body = await req.json();
    const { status, feedback, qcNotes, route, schedulerFeedback, title: qcTitle, postingTitle, titleSetByQC, titleSetByClient, postingTitles, postingDescriptions, postingTags, forceClientReview } = body;

    if (!status)
      return NextResponse.json({ message: "Status is required" }, { status: 400 });

    // Split legacy REJECTED → REJECTED_BY_QC / REJECTED_BY_CLIENT by actor role
    let finalStatus = normalizeIncomingTaskStatus(status, role);

    console.log(`\n[StatusUpdate] User ${userId} (${role}) is updating task ${id} to status: ${finalStatus} (requested: ${status})`);
    const updateData: any = {};

    if (feedback !== undefined) updateData.feedback = feedback;
    if (qcNotes !== undefined) updateData.qcNotes = qcNotes;
    const schedulerFeedbackText =
      typeof schedulerFeedback === "string" ? schedulerFeedback.trim() : "";
    if (schedulerFeedback !== undefined) updateData.feedback = schedulerFeedbackText;
    if (route !== undefined) updateData.route = route;

    // ── Legacy single-title fields (kept for backward compat, not written by new UI) ──
    const incomingPostingTitle = postingTitle ?? qcTitle;
    if (incomingPostingTitle?.trim() && titleSetByQC) {
      updateData.postingTitle = incomingPostingTitle.trim();
      updateData.titleSetByQc = true; // drizzle schema property is titleSetByQc (lowercase c)
    }
    if (qcTitle?.trim() && titleSetByQC) {
      updateData.title = qcTitle.trim();
      updateData.titleSetByQc = true;
    }
    if (role === "client" && postingTitle?.trim() && titleSetByClient) {
      updateData.postingTitle = postingTitle.trim();
      updateData.titleSetByClient = true;
    }

    // 🔥 New multi-item posting content — composed in the review sidebar,
    // sent as a single batch when the user clicks approve.
    // Each is an array of { id: string, text: string } or null/undefined to skip.
    if (Array.isArray(postingTitles)) {
      updateData.postingTitles = postingTitles
        .filter((t: any) => t?.text?.trim())
        .map((t: any) => ({ id: t.id, text: t.text.trim() }));
    }
    if (Array.isArray(postingDescriptions)) {
      updateData.postingDescriptions = postingDescriptions
        .filter((d: any) => d?.text?.trim())
        .map((d: any) => ({ id: d.id, text: d.text.trim() }));
    }
    if (Array.isArray(postingTags)) {
      updateData.postingTags = postingTags
        .filter((t: any) => t?.text?.trim())
        .map((t: any) => ({ id: t.id, text: t.text.trim() }));
    }

    let task: any;
    try {
      task = await db.query.task.findFirst({
        where: eq(taskTable.id, id),
        with: {
          client: true,
          files: {
            where: (f, { eq }) => eq(f.isActive, true),
          },
          monthlyDeliverable: { columns: { type: true } },
          oneOffDeliverable: { columns: { type: true } },
        },
      });
    } catch (readErr: any) {
      // Older tasks may have a stale status value not present in the current TaskStatus enum.
      // Drizzle/Postgres reject an out-of-enum value on read too, so fall back to raw SQL.
      console.warn("⚠️ Structured task read failed. Using raw SQL fallback for initial fetch...", readErr.message);
      const rawResult: any = await db.execute(drizzleSql`
        SELECT t.*, row_to_json(c.*) AS client
        FROM "Task" t
        LEFT JOIN "Client" c ON t."clientId" = c.id
        WHERE t.id = ${id}
      `);
      const rawRows = rawResult.rows as any[];
      if (!rawRows || rawRows.length === 0) {
        return NextResponse.json({ message: "Task not found" }, { status: 404 });
      }
      const raw = rawRows[0];
      const filesResult: any = await db.execute(drizzleSql`
        SELECT * FROM "File" WHERE "taskId" = ${id} AND "isActive" = true
      `);
      task = {
        ...raw,
        client: raw.client,
        files: filesResult.rows,
        // raw SQL returns the actual DB column name; normalize to match the
        // camelCase property the ORM path (and rest of this handler) uses
        qcSpecialist: raw.qc_specialist,
      };
    }

    if (!task)
      return NextResponse.json({ message: "Task not found" }, { status: 404 });

    console.log("ROLE" + role);
    // Handle client review requirement
    // 🔥 QC manual override: force a specific video into client review,
    // regardless of the client's global requiresClientReview setting or
    // deliverable-type whitelist. Works both at approval time
    // (status === "COMPLETED") and as an after-the-fact push on an
    // already-approved task (status === "CLIENT_REVIEW" sent directly).
    if (
      (effectiveRole === "qc" || effectiveRole === "admin") &&
      (status === "COMPLETED" || status === "CLIENT_REVIEW") &&
      (task.client?.requiresClientReview === true || forceClientReview === true)
    ) {
      const allowedTypes: string[] = task.client?.clientReviewDeliverableTypes ?? [];

      // Resolve the short code: prefer task.deliverableType (set on new tasks),
      // fall back to converting the deliverable type name for older tasks.
      const DELIVERABLE_SHORT_CODES: Record<string, string> = {
        "short form videos": "SF",
        "long form videos": "LF",
        "square form videos": "SQF",
        "thumbnails": "THUMB",
        "tiles": "T",
        "hard posts / graphic images": "HP",
        "snapchat episodes": "SEP",
        "beta short form": "BSF",
        "stories": "ST",
        "text post": "TP",
      };
      const rawDeliverableType: string =
        task.monthlyDeliverable?.type ||
        task.oneOffDeliverable?.type ||
        "";
      const fallbackShortCode = DELIVERABLE_SHORT_CODES[rawDeliverableType.toLowerCase().trim()] || rawDeliverableType;
      const taskType: string = task.deliverableType || fallbackShortCode || "";

      console.log(`[ClientReview] taskType="${taskType}", allowedTypes=${JSON.stringify(allowedTypes)}, deliverableType=${task.deliverableType}, rawType="${rawDeliverableType}"`);

      // If no types configured → all tasks go to review (backwards compatible).
      // If types configured → only matching deliverable types go to review.
      const shouldReview = forceClientReview === true || allowedTypes.length === 0 || allowedTypes.includes(taskType);
      if (shouldReview) {
        finalStatus = "CLIENT_REVIEW";
      }
    }

    if (role === "client") {
      if (status === "COMPLETED") {
        finalStatus = "COMPLETED";
      } else if (isRejectedStatus(status)) {
        finalStatus = REJECTED_BY_CLIENT;
      } else if (status === "POSTED") {
        finalStatus = "POSTED";
      }
    }

    // Update task
    // 🔥 Track QC reviewer when QC approves/rejects
    const isQCAction = (effectiveRole === "qc" || effectiveRole === "admin") &&
      (finalStatus === "COMPLETED" || finalStatus === "CLIENT_REVIEW" || finalStatus === REJECTED_BY_QC);

    if (isQCAction) {
      updateData.qcReviewedBy = userId;
      updateData.qcReviewedAt = new Date();
    }

    let updatedTask: any;
    try {
      const dbUpdateData: any = { ...updateData };
      if ('qcReviewedAt' in dbUpdateData) dbUpdateData.qcReviewedAt = dbUpdateData.qcReviewedAt.toISOString();

      // Client Review Status & Reminder System — stamp the moment this task
      // enters review so "days in review" and the 5-day auto-reminder rule
      // have something reliable to measure against. Overwritten each time
      // the task re-enters review (not just the first time).
      if (finalStatus === "CLIENT_REVIEW" && task.status !== "CLIENT_REVIEW") {
        dbUpdateData.clientReviewStartedAt = new Date().toISOString();
      }

      const [row] = await db.update(taskTable).set({
        ...dbUpdateData,
        status: finalStatus,
        updatedAt: new Date().toISOString(),
      }).where(eq(taskTable.id, id)).returning();
      updatedTask = row;
    } catch (e: any) {
      // If the write fails due to an enum mismatch (a status value not in the
      // current TaskStatus enum), fall back to raw SQL to force the update
      // and bypass the enum type check.
      console.warn("⚠️ Structured status update failed. Using raw SQL fallback...", e.message);

      await db.execute(drizzleSql`
        UPDATE "Task" SET "status" = ${finalStatus}, "updatedAt" = ${new Date().toISOString()} WHERE "id" = ${id}
      `);

      // Try to fetch the updated record.
      // If the structured read also fails because it can't parse the new enum value, return raw data.
      try {
        updatedTask = await db.query.task.findFirst({ where: eq(taskTable.id, id) });
      } catch (readErr) {
        const rawResult: any = await db.execute(drizzleSql`SELECT * FROM "Task" WHERE "id" = ${id}`);
        updatedTask = rawResult.rows?.[0] || { id, status: finalStatus };
      }
    }

    const isSchedulerSendBack =
      role === "scheduler" &&
      finalStatus === REJECTED_BY_QC &&
      schedulerFeedbackText.length > 0;

    if (isSchedulerSendBack) {
      const [existingSchedulerFeedback] = await db.select({ id: taskFeedback.id }).from(taskFeedback).where(and(
        eq(taskFeedback.taskId, id),
        eq(taskFeedback.folderType, "scheduler"),
        eq(taskFeedback.feedback, schedulerFeedbackText),
        ne(taskFeedback.status, "resolved"),
      )).limit(1);

      if (!existingSchedulerFeedback) {
        await db.insert(taskFeedback).values({
          id: createId(),
          taskId: id,
          folderType: "scheduler",
          feedback: schedulerFeedbackText,
          category: "scheduler_sendback",
          status: "needs_revision",
          createdBy: Number(userId),
        });
      }
    }

    // ============================================
    // NEW: Trigger AI titling on QC approval
    // ============================================
    const shouldTriggerTitling =
      (effectiveRole === "qc" || effectiveRole === "admin") &&
      (finalStatus === "COMPLETED" || finalStatus === "CLIENT_REVIEW") &&
      task.titlingStatus !== 'COMPLETED' && // Don't re-trigger if already done
      task.titlingStatus !== 'PROCESSING'; // Don't re-trigger if in progress

    if (shouldTriggerTitling) {
      // Check if task has a video file
      const hasVideoFile = task.files.some((f: any) => f.mimeType?.startsWith('video/'));

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
            db.update(taskTable).set({
              titlingStatus: 'FAILED',
              titlingError: err.message,
              updatedAt: new Date().toISOString(),
            }).where(eq(taskTable.id, id)).catch(console.error);
          });
      } else {
        console.log(`   ℹ️ Task ${id} has no video file - skipping titling`);
      }
    }
    // ============================================

    // Audit log
    const [user] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);

    // ============================================
    // NEW: In-app & Email Notifications
    // ============================================
    try {
      if (finalStatus === "READY_FOR_QC" && task.status !== "READY_FOR_QC") {
        // Notify QC specialist
        if (task.qcSpecialist) {
          await notifyUser({
            userId: task.qcSpecialist,
            type: "qc_ready",
            title: "Content Ready for Quality Control",
            body: `Your content "${task.title}" is ready for review.`,
            payload: {
              taskId: task.id,
              clientId: task.clientId,
              qcId: task.qcSpecialist,
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
      else if (isRejectedStatus(finalStatus) && !isRejectedStatus(task.status)) {
        // Notify Editor
        await notifyUser({
          userId: task.assignedTo,
          type: "task_rejected",
          title: effectiveRole === "scheduler" ? "Content Sent Back by Scheduler" : "Content Needs Revisions",
          body: effectiveRole === "scheduler"
            ? `Task "${task.title}" was sent back to you by the scheduler: ${schedulerFeedback || feedback || qcNotes || "Please check the feedback."}`
            : `Task "${task.title}" has been rejected: ${qcNotes || feedback || "Please check QC notes / feedback."}`,
          payload: {
            taskId: task.id,
            clientId: task.clientId,
            editorId: task.assignedTo,
            taskTitle: task.title,
            // 🔥 Who actually rejected it — lets the Slack dispatcher tell
            // a client rejection apart from a QC one and react differently
            // (see slack.ts task_rejected handler).
            rejectedByRole: role,
            rejectedStatus: finalStatus,
            schedulerId: task.scheduler ?? null,
            // Only carry the comment text through for client rejections —
            // QC-rejection Slack messages stay exactly as they are today.
            revisionComment: role === "client" ? (feedback || null) : null,
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
        keepAlive(
          sendTaskReadyForReviewEmail(id).catch((err) =>
            console.error("[TaskReadyForReview] email send failed:", err)
          )
        );

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

        // 🔥 Mirror review videos to YouTube (falls back to Drive) so the
        // review screen can play them — fire-and-forget, don't block the
        // status update response. See review-mirror.ts.
        triggerReviewMirror({
          taskId: task.id,
          taskTitle: task.title,
          clientName: task.client?.companyName || task.client?.name || null,
          driveFolderId: task.driveFolderId || null,
          userId,
          userRole: role,
        }).catch((err: any) =>
          console.error(`⚠️ Review mirror failed to start for task ${id}:`, err.message)
        );
      // } else if (finalStatus === "COMPLETED" && task.status !== "COMPLETED") {
      //   // Notify Editor that it's approved
      //   await notifyUser({
      //     userId: task.assignedTo,
      //     type: "qc_approval",
      //     title: "Task Approved",
      //     body: `Your task "${task.title}" has been approved.`,
      //     payload: { taskId: task.id, clientId: task.clientId },
      //   });

      } else if (finalStatus === "COMPLETED" && task.status !== "COMPLETED") {
  // Notify Editor that it's approved
  await notifyUser({
    userId: task.assignedTo,
    type: "qc_approval",
    title: "Task Approved",
    body: `Your task "${task.title}" has been approved.`,
    payload: { taskId: task.id, clientId: task.clientId },
  });

  // 🔥 If client approved, delete Drive mirror files (no longer needed)
  if (role === "client") {
    const filesWithDrive = await db.select({ id: fileTable.id, reviewDriveUrl: fileTable.reviewDriveUrl })
      .from(fileTable).where(and(eq(fileTable.taskId, id), isNotNull(fileTable.reviewDriveUrl)));

    if (filesWithDrive.length > 0) {
      const { deleteFileFromDrive, extractGoogleDriveFileId } = await import("@/lib/googleDrive");
      for (const file of filesWithDrive) {
        if (file.reviewDriveUrl) {
          const driveFileId = extractGoogleDriveFileId(file.reviewDriveUrl);
          if (driveFileId) {
            // Fire-and-forget — don't block the response
            deleteFileFromDrive(driveFileId).catch(err =>
              console.error(`⚠️ Drive cleanup failed for file ${file.id}:`, err)
            );
          }
          // Clear the reviewDriveUrl from DB
          await db.update(fileTable).set({ reviewDriveUrl: null }).where(eq(fileTable.id, file.id));
        }
      }
      console.log(`🗑️ Queued Drive cleanup for ${filesWithDrive.length} file(s) on task ${id}`);
    }

    // 🔥 Same cleanup for YouTube mirror uploads (no longer needed once approved)
    const filesWithYoutube = await db.select({ id: fileTable.id, youtubeVideoId: fileTable.youtubeVideoId })
      .from(fileTable).where(and(eq(fileTable.taskId, id), isNotNull(fileTable.youtubeVideoId)));

    if (filesWithYoutube.length > 0) {
      for (const file of filesWithYoutube) {
        if (file.youtubeVideoId) {
          // Fire-and-forget — don't block the response
          deleteYoutubeVideo(file.youtubeVideoId).catch(err =>
            console.error(`⚠️ YouTube cleanup failed for file ${file.id}:`, err)
          );
        }
        await db.update(fileTable).set({ youtubeVideoId: null, youtubeUploadedAt: null }).where(eq(fileTable.id, file.id));
      }
      console.log(`🗑️ Queued YouTube cleanup for ${filesWithYoutube.length} file(s) on task ${id}`);
    }
  }

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