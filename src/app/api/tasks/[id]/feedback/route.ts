export const dynamic = 'force-dynamic';
// app/api/tasks/[id]/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { taskFeedback, shareableReview as shareableReviewTable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, eq, ne, desc } from "drizzle-orm";

// GET - Fetch all feedback for a task
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { db, closeDb } = getDbPool();
  try {
  try {
    const { id } = await params;

    const rawFeedback = await db.query.taskFeedback.findMany({
      where: eq(taskFeedback.taskId, id),
      with: {
        user: {
          columns: { id: true, name: true, role: true }
        },
        file: {
          columns: { id: true, name: true, version: true, folderType: true }
        }
      },
      orderBy: desc(taskFeedback.createdAt)
    });
    const feedback = rawFeedback;

    // Group by folderType
    const groupedFeedback: Record<string, typeof feedback> = {};
    feedback.forEach((fb) => {
      const key = fb.folderType || 'general';
      if (!groupedFeedback[key]) {
        groupedFeedback[key] = [];
      }
      groupedFeedback[key].push(fb);
    });

    return NextResponse.json({
      feedback,
      groupedFeedback
    });
  } catch (error: any) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}

// POST - Add new feedback
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { db, closeDb } = getDbPool();
  try {
  try {
    const { id } = await params;
    const body = await req.json();

    const {
      folderType,
      fileId,
      feedback,
      timestamp,
      category,
      createdBy,
      status = "needs_revision",
      // 🔥 NEW: voice notes, general file/image attachments, and a
      // captured/drawn-on screenshot — all uploaded beforehand via
      // POST /api/tasks/[id]/feedback/attachments, URLs passed here.
      screenshotUrl,
      annotations,
      voiceUrl,
      voiceDurationSec,
      attachments,
    } = body;

    if (!folderType || !feedback || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields: folderType, feedback, createdBy" },
        { status: 400 }
      );
    }

    const [createdFeedback] = await db.insert(taskFeedback).values({
      id: createId(),
      taskId: id,
      folderType,
      fileId: fileId || null,
      feedback,
      timestamp: timestamp || null,
      category: category || null,
      status,
      createdBy,
      screenshotUrl: screenshotUrl || null,
      annotations: annotations || null,
      voiceUrl: voiceUrl || null,
      voiceDurationSec: voiceDurationSec ?? null,
      attachments: attachments || null,
    }).returning();

    const newFeedback = await db.query.taskFeedback.findFirst({
      where: eq(taskFeedback.id, createdFeedback.id),
      with: {
        user: { columns: { id: true, name: true, role: true } },
        file: { columns: { id: true, name: true, version: true } },
      },
    });

    const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
    await createAuditLog({
      userId: createdBy,
      action: AuditAction.TASK_UPDATED,
      entity: "TaskFeedback",
      entityId: newFeedback.id,
      details: `Added new feedback to task ${id}`,
      metadata: {
        taskId: id,
        folderType,
        category,
        status
      }
    });

    return NextResponse.json({ feedback: newFeedback });
  } catch (error: any) {
    console.error("Error creating feedback:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}

// PATCH - Bulk save feedback (for QC sending back to editor)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { db, closeDb } = getDbPool();
  try {
  try {
    const { id } = await params;
    const body = await req.json();
    const { feedbackItems, createdBy, shareToken } = body;

    let finalCreatedBy = createdBy;

    // Verify guest if using shareToken
    if (!createdBy || createdBy === 0) {
      if (shareToken) {
        const [shareableReview] = await db.select().from(shareableReviewTable)
          .where(eq(shareableReviewTable.shareToken, shareToken)).limit(1);

        if (shareableReview && shareableReview.isActive && (!shareableReview.expiresAt || new Date(shareableReview.expiresAt) > new Date())) {
          if (shareableReview.taskId !== id) {
            return NextResponse.json({ error: "Invalid share token for this task" }, { status: 403 });
          }
          finalCreatedBy = shareableReview.createdBy; // Attribute to person who shared it
        } else {
          return NextResponse.json({ error: "Invalid or expired share token" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!Array.isArray(feedbackItems) || !finalCreatedBy) {
      return NextResponse.json(
        { error: "Missing feedbackItems array or createdBy" },
        { status: 400 }
      );
    }

    // Get existing unresolved feedback to avoid duplicates
    const existingFeedback = await db.select({
      feedback: taskFeedback.feedback,
      timestamp: taskFeedback.timestamp,
      folderType: taskFeedback.folderType,
      createdBy: taskFeedback.createdBy,
    }).from(taskFeedback).where(and(
      eq(taskFeedback.taskId, id),
      ne(taskFeedback.status, 'resolved'),
    ));

    // Create a Set of existing feedback signatures for fast lookup
    // Include createdBy to allow same comment from different users
    // But also create a content-only signature to prevent exact duplicates
    const existingSignatures = new Set(
      existingFeedback.map(fb => 
        `${fb.folderType || 'main'}:${fb.timestamp || ''}:${fb.feedback}:${fb.createdBy}`
      )
    );
    
    // Also track content-only signatures to prevent duplicates regardless of user
    const contentSignatures = new Set(
      existingFeedback.map(fb => 
        `${fb.folderType || 'main'}:${fb.timestamp || ''}:${fb.feedback}`
      )
    );

    // Filter out items that already exist
    const newItems = feedbackItems.filter((item: any) => {
      // Check if exact same feedback (same user, same content) already exists
      const fullSignature = `${item.folderType || 'main'}:${item.timestamp || ''}:${item.feedback}:${finalCreatedBy}`;
      if (existingSignatures.has(fullSignature)) {
        return false;
      }
      
      // Also check if the exact same content exists from ANY user (prevent cross-user duplication)
      const contentSignature = `${item.folderType || 'main'}:${item.timestamp || ''}:${item.feedback}`;
      if (contentSignatures.has(contentSignature)) {
        console.log(`⚠️ Skipping duplicate content: "${item.feedback.slice(0, 50)}..." (already exists from another user)`);
        return false;
      }
      
      return true;
    });

    if (newItems.length === 0) {
      console.log(`⚠️ All ${feedbackItems.length} feedback items already exist for task ${id}, skipping`);
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'All feedback items already exist'
      });
    }

    // Start a transaction — interactive (db.transaction), matches original
    // prisma.$transaction(async (tx) => {...}) form. Atomicity preserved:
    // single insert of all new rows, all-or-nothing.
    const result = await db.transaction(async (tx) => {
      // Create new feedback items (only the ones that don't exist)
      const created = await tx.insert(taskFeedback).values(
        newItems.map((item: any) => ({
          id: createId(),
          taskId: id,
          folderType: item.folderType || 'main',
          fileId: item.fileId || null,
          feedback: item.feedback,
          timestamp: item.timestamp || null,
          category: item.category || null,
          status: "needs_revision",
          createdBy: finalCreatedBy,
          // 🔥 NEW: carried over from the in-session ReviewComment object
          // (already-uploaded R2 URLs — see CommentInput's handleSubmit)
          screenshotUrl: item.screenshotUrl || null,
          annotations: item.annotations || null,
          voiceUrl: item.voiceUrl || null,
          voiceDurationSec: item.voiceDurationSec ?? null,
          attachments: item.attachments || null,
        }))
      ).returning();

      return { count: created.length };
    });

    console.log(`✅ Created ${result.count} feedback items for task ${id} (${feedbackItems.length - newItems.length} duplicates skipped)`);

    const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
    await createAuditLog({
      userId: finalCreatedBy,
      action: AuditAction.TASK_UPDATED,
      entity: "Task",
      entityId: id,
      details: `Bulk added ${result.count} feedback items to task ${id}`,
      metadata: {
        taskId: id,
        feedbackCount: result.count
      }
    });

    return NextResponse.json({
      success: true,
      count: result.count
    });
  } catch (error: any) {
    console.error("Error saving feedback:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}

// DELETE - Resolve or delete feedback
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { db, closeDb } = getDbPool();
  try {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const feedbackId = searchParams.get('feedbackId');
    const action = searchParams.get('action') || 'delete';

    if (!feedbackId) {
      return NextResponse.json(
        { error: "Missing feedbackId parameter" },
        { status: 400 }
      );
    }

    if (action === 'acknowledge') {
      const body = await req.json().catch(() => ({}));
      const { acknowledgedBy } = body;

      if (!acknowledgedBy) {
        return NextResponse.json({ error: 'Missing acknowledgedBy' }, { status: 400 });
      }

      const [updated] = await db.update(taskFeedback).set({
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy,
        status: 'acknowledged',
      }).where(eq(taskFeedback.id, feedbackId)).returning();

      const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
      await createAuditLog({
        userId: acknowledgedBy,
        action: AuditAction.TASK_UPDATED,
        entity: 'TaskFeedback',
        entityId: feedbackId,
        details: `Editor acknowledged feedback on task ${id}`,
        metadata: { taskId: id, feedbackId, acknowledgedBy }
      });

      return NextResponse.json({ success: true, feedback: updated });
    }

    if (action === 'resolve') {
      // Mark feedback as resolved
      const [updated] = await db.update(taskFeedback).set({
        resolvedAt: new Date().toISOString(),
        status: 'resolved'
      }).where(eq(taskFeedback.id, feedbackId)).returning();

      const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
      await createAuditLog({
        userId: 0, // System/Context dependent
        action: AuditAction.TASK_UPDATED,
        entity: "TaskFeedback",
        entityId: feedbackId,
        details: `Resolved feedback on task ${id}`,
        metadata: { taskId: id, feedbackId }
      });

      return NextResponse.json({
        success: true,
        feedback: updated
      });
    } else {
      // Delete feedback
      await db.delete(taskFeedback).where(eq(taskFeedback.id, feedbackId));

      return NextResponse.json({
        success: true,
        deleted: feedbackId
      });
    }
  } catch (error: any) {
    console.error("Error deleting/resolving feedback:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}

// PUT - Update feedback content
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { db, closeDb } = getDbPool();
  try {
  try {
    const { id } = await params;
    const body = await req.json();
    const { feedbackId, feedback, category } = body;

    if (!feedbackId || !feedback) {
      return NextResponse.json(
        { error: "Missing required fields: feedbackId, feedback" },
        { status: 400 }
      );
    }

    // NOTE: TaskFeedback has no updatedAt column (schema.prisma confirms it
    // was never a real field) — dropped rather than mapped to a nonexistent column.
    const [updatedRow] = await db.update(taskFeedback).set({
      feedback,
      category: category || undefined,
    }).where(eq(taskFeedback.id, feedbackId)).returning();

    const updated = await db.query.taskFeedback.findFirst({
      where: eq(taskFeedback.id, updatedRow.id),
      with: {
        user: { columns: { id: true, name: true, role: true } },
        file: { columns: { id: true, name: true, version: true } },
      },
    });

    const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
    await createAuditLog({
      userId: updated.createdBy,
      action: AuditAction.TASK_UPDATED,
      entity: "TaskFeedback",
      entityId: feedbackId,
      details: `Updated feedback on task ${id}`,
      metadata: { taskId: id, feedbackId }
    });

    return NextResponse.json({ feedback: updated });
  } catch (error: any) {
    console.error("Error updating feedback:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}