import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { uploadVideoToYoutube, QuotaExceededError } from "@/lib/youtube-mirror";
import { triggerDriveMirror } from "@/lib/drive-mirror";

// POST /api/admin/tasks/[id]/youtube-mirror
//
// Manually re-uploads every active video file on a task to YouTube
// (Unlisted) so the client review screen can play it via the real
// IFrame Player (see src/components/review/YoutubePlayer.tsx and
// src/lib/youtube-mirror.ts). This is the same upload
// triggerReviewMirror runs automatically when a task first enters
// CLIENT_REVIEW — this route exists for re-running it by hand: quota
// was exhausted the first time, the file was replaced/re-uploaded
// after review started, etc.
//
// Falls back to Drive mirroring on quota exhaustion, same as the
// automatic flow. Files that already have a youtubeVideoId are
// skipped — use "Trigger Drive Mirror" instead if you specifically
// need to force a Drive copy.
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
          where: {
            isActive: true,
            mimeType: { startsWith: "video/" },
            youtubeVideoId: null,
          },
          select: { id: true, name: true, mimeType: true, s3Key: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const results: {
      fileId: string;
      fileName: string;
      dispatched: boolean;
      youtubeVideoId?: string;
      reason?: string;
    }[] = [];

    for (const file of task.files) {
      if (!file.s3Key) {
        results.push({ fileId: file.id, fileName: file.name, dispatched: false, reason: "No S3 key on file" });
        continue;
      }

      try {
        const { videoId } = await uploadVideoToYoutube({
          s3Key: file.s3Key,
          title: `${task.title} — ${file.name}`.slice(0, 100),
        });

        await prisma.file.update({
          where: { id: file.id },
          data: { youtubeVideoId: videoId, youtubeUploadedAt: new Date() },
        });

        results.push({ fileId: file.id, fileName: file.name, dispatched: true, youtubeVideoId: videoId });
      } catch (err: any) {
        if (err instanceof QuotaExceededError) {
          // Same fallback the automatic mirror uses.
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
          results.push({
            fileId: file.id,
            fileName: file.name,
            dispatched: true,
            reason: "YouTube quota exhausted — routed to Drive instead",
          });
        } else {
          results.push({ fileId: file.id, fileName: file.name, dispatched: false, reason: err.message });
        }
      }
    }

    const dispatched = results.filter((r) => r.dispatched).length;

    if (task.files.length === 0) {
      return NextResponse.json({
        dispatched: 0,
        total: 0,
        results: [{ reason: "No active video files without a YouTube video already found" }],
      });
    }

    return NextResponse.json({ dispatched, total: task.files.length, results });
  } catch (err: any) {
    console.error("YouTube mirror trigger error:", err);
    return NextResponse.json({ error: "Server error", details: err.message }, { status: 500 });
  }
}