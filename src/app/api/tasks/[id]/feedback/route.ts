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
    const { feedbackItems, createdBy } = await req.json();

    if (!Array.isArray(feedbackItems) || !createdBy) {
      return NextResponse.json(
        { error: "Missing feedbackItems array or createdBy" },
        { status: 400 }
      );
    }

    // Start a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete old unresolved feedback for this task (optional - or keep history)
      // Uncomment if you want to replace old feedback instead of appending
      // await tx.taskFeedback.deleteMany({
      //   where: {
      //     taskId: id,
      //     resolvedAt: null
      //   }
      // });

      // Create new feedback items
      const created = await tx.taskFeedback.createMany({
        data: feedbackItems.map((item: any) => ({
          taskId: id,
          folderType: item.folderType || 'main',
          fileId: item.fileId || null,
          feedback: item.feedback,
          timestamp: item.timestamp || null,
          category: item.category || null,
          status: "needs_revision",
          createdBy,
        }))
      });

      return created;
    });

    console.log(`✅ Created ${result.count} feedback items for task ${id}`);

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