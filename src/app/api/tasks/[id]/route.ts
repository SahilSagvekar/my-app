export const dynamic = 'force-dynamic';
// app/api/tasks/[taskId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { task, file as fileTable } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { addSignedUrlsToFiles, deleteFromS3 } from "@/lib/s3";
import { getCurrentUser2 } from "@/lib/auth";
import { createAuditLog, AuditAction } from "@/lib/audit-logger";

// Only this admin email can delete tasks
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const { id: taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    const found = await db.query.task.findFirst({
      where: eq(task.id, taskId),
      with: {
        files: {
          columns: {
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
            reviewDriveUrl: true,
            youtubeVideoId: true,
            folderType: true,
          },
          orderBy: desc(fileTable.uploadedAt),
        },
        user_assignedTo: {
          columns: {
            id: true,
            name: true,
            role: true,
          },
        },
        client: {
          columns: {
            id: true,
            name: true,
            requiresCoverImage: true,
          },
        },
        tagToTasks: { with: { tag: true } },
      },
    });

    if (!found) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const { user_assignedTo, tagToTasks, ...rest } = found as any;
    const foundTask = { ...rest, assignedToUser: user_assignedTo, tags: (tagToTasks ?? []).map((tt: any) => tt.tag) };

    // Add signed URLs to files for secure access
    const filesWithSignedUrls = await addSignedUrlsToFiles(foundTask.files);

    return NextResponse.json({
      ...foundTask,
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
  const db = getDbHttp();
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
    const foundTask = await db.query.task.findFirst({
      where: eq(task.id, taskId),
      with: {
        files: {
          columns: {
            id: true,
            s3Key: true,
            name: true,
          },
        },
      },
    });

    if (!foundTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Delete files from S3
    for (const file of foundTask.files) {
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
    await db.delete(task).where(eq(task.id, taskId));

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: AuditAction.TASK_DELETED,
      entity: "Task",
      entityId: taskId,
      details: `Deleted task: ${foundTask.title || taskId}`,
      metadata: {
        taskId,
        taskTitle: foundTask.title,
        deletedBy: user.email,
        fileCount: foundTask.files.length,
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