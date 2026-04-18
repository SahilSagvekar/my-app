export const dynamic = 'force-dynamic';
// app/api/tasks/[taskId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addSignedUrlsToFiles, deleteFromS3 } from "@/lib/s3";
import { getCurrentUser2 } from "@/lib/auth";
import { createAuditLog, AuditAction } from "@/lib/audit-logger";

// Only this admin email can delete tasks
const SUPER_ADMIN_EMAIL = "sahilsagvekar230@gmail.com";

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        files: {
          select: {
            id: true,
            name: true,
            url: true,
            mimeType: true,
            size: true,
            uploadedAt: true,
            version: true,
            isActive: true,
            codec: true,
            proxyUrl: true,
          },
          orderBy: {
            uploadedAt: "desc",
          },
        },
        assignedToUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Add signed URLs to files for secure access
    const filesWithSignedUrls = await addSignedUrlsToFiles(task.files);

    return NextResponse.json({
      ...task,
      files: filesWithSignedUrls,
    });
  } catch (error: any) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task", message: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Only super admin can delete tasks
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    // Auth check
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Super admin check - only this specific email can delete
    if (user.email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Forbidden: Only super admin can delete tasks" },
        { status: 403 }
      );
    }

    // Fetch task with files to delete from S3
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        files: {
          select: {
            id: true,
            s3Key: true,
            name: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Delete files from S3
    for (const file of task.files) {
      if (file.s3Key) {
        try {
          await deleteFromS3(file.s3Key);
          console.log(`✅ Deleted S3 file: ${file.s3Key}`);
        } catch (err) {
          console.error(`⚠️ Failed to delete S3 file ${file.s3Key}:`, err);
          // Continue with deletion even if S3 delete fails
        }
      }
    }

    // Delete task (cascade will handle files, feedback, etc.)
    await prisma.task.delete({
      where: { id: taskId },
    });

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: AuditAction.TASK_DELETED,
      entity: "Task",
      entityId: taskId,
      details: `Deleted task: ${task.title || taskId}`,
      metadata: {
        taskId,
        taskTitle: task.title,
        deletedBy: user.email,
        fileCount: task.files.length,
      },
    });

    console.log(`🗑️ Task ${taskId} deleted by ${user.email}`);

    return NextResponse.json({ 
      success: true, 
      message: "Task deleted successfully",
      deletedTaskId: taskId,
    });
  } catch (error: any) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task", message: error.message },
      { status: 500 }
    );
  }
}