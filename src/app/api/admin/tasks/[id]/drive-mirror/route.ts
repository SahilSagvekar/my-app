import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { triggerDriveMirror } from "@/lib/drive-mirror";

// POST /api/admin/tasks/[id]/drive-mirror
//
// Manually re-dispatches every active video file on a task to the file
// server for Drive mirroring. See src/lib/drive-mirror.ts for what the
// dispatch actually does and how the result lands (30s cron poll).
//
// Response shape matches what TaskManagementTab.tsx's handleDriveMirror
// expects: { dispatched, total, results }.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !["admin", "manager"].includes(user.role?.toLowerCase() || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        driveFolderId: true,
        client: { select: { name: true, companyName: true } },
        files: {
          where: { isActive: true, mimeType: { startsWith: "video/" } },
          select: { id: true, name: true, mimeType: true, s3Key: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const results: { fileId: string; fileName: string; dispatched: boolean; reason?: string }[] = [];

    for (const file of task.files) {
      if (!file.s3Key) {
        results.push({ fileId: file.id, fileName: file.name, dispatched: false, reason: "No S3 key on file" });
        continue;
      }

      await triggerDriveMirror({
        key: file.s3Key,
        fileName: file.name || "review-video",
        mimeType: file.mimeType || "video/mp4",
        fileRecordId: file.id,
        clientName: task.client?.companyName || task.client?.name || null,
        driveFolderId: task.driveFolderId || null,
        userId: user.id,
        userRole: user.role,
      });
      results.push({ fileId: file.id, fileName: file.name, dispatched: true });
    }

    const dispatched = results.filter((r) => r.dispatched).length;

    if (task.files.length === 0) {
      return NextResponse.json({
        dispatched: 0,
        total: 0,
        results: [{ reason: "No active video files with S3 keys found" }],
      });
    }

    return NextResponse.json({ dispatched, total: task.files.length, results });
  } catch (err: any) {
    console.error("Drive mirror trigger error:", err);
    return NextResponse.json({ error: "Server error", details: err.message }, { status: 500 });
  }
}