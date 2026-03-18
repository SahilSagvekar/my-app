export const dynamic = 'force-dynamic';
// app/api/tasks/[id]/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Fetch all feedback for a task
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    const feedback = await prisma.taskFeedback.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: { id: true, name: true, role: true }
        },
        file: {
          select: { id: true, name: true, version: true, folderType: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

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
}

// POST - Add new feedback
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
      status = "needs_revision"
    } = body;

    if (!folderType || !feedback || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields: folderType, feedback, createdBy" },
        { status: 400 }
      );
    }

    const newFeedback = await prisma.taskFeedback.create({
      data: {
        taskId: id,
        folderType,
        fileId: fileId || null,
        feedback,
        timestamp: timestamp || null,
        category: category || null,
        status,
        createdBy,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true }
        },
        file: {
          select: { id: true, name: true, version: true }
        }
      }
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
}

// PATCH - Bulk save feedback (for QC sending back to editor)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { feedbackItems, createdBy, shareToken } = body;

    let finalCreatedBy = createdBy;

    // Verify guest if using shareToken
    if (!createdBy || createdBy === 0) {
      if (shareToken) {
        const shareableReview = await (prisma as any).shareableReview.findUnique({
          where: { shareToken },
        });

        if (shareableReview && shareableReview.isActive && (!shareableReview.expiresAt || shareableReview.expiresAt > new Date())) {
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
    const existingFeedback = await prisma.taskFeedback.findMany({
      where: {
        taskId: id,
        status: { not: 'resolved' },
      },
      select: {
        feedback: true,
        timestamp: true,
        folderType: true,
        createdBy: true,
      }
    });

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

    // Start a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create new feedback items (only the ones that don't exist)
      const created = await tx.taskFeedback.createMany({
        data: newItems.map((item: any) => ({
          taskId: id,
          folderType: item.folderType || 'main',
          fileId: item.fileId || null,
          feedback: item.feedback,
          timestamp: item.timestamp || null,
          category: item.category || null,
          status: "needs_revision",
          createdBy: finalCreatedBy,
        }))
      });

      return created;
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
}

// DELETE - Resolve or delete feedback
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    if (action === 'resolve') {
      // Mark feedback as resolved
      const updated = await prisma.taskFeedback.update({
        where: { id: feedbackId },
        data: {
          resolvedAt: new Date(),
          status: 'resolved'
        }
      });

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
      await prisma.taskFeedback.delete({
        where: { id: feedbackId }
      });

      return NextResponse.json({
        success: true,
        deleted: feedbackId
      });
    }
  } catch (error: any) {
    console.error("Error deleting/resolving feedback:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update feedback content
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const updated = await prisma.taskFeedback.update({
      where: { id: feedbackId },
      data: {
        feedback,
        category: category || undefined,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, role: true }
        },
        file: {
          select: { id: true, name: true, version: true }
        }
      }
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
}