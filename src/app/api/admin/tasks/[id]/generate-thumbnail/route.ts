import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbHttp } from "@/lib/db";
import { file as fileTable } from "@/lib/db/schema";
import { and, eq, or, like, sql } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import { retryThumbnail } from "@/lib/file-server";
import { reconcileExistingAutoThumbnail } from "@/lib/backfill-task-thumbnails";

// POST /api/admin/tasks/[id]/generate-thumbnail
//
// Manual, per-task version of what the every-minute backfill cron does in
// bulk (src/lib/backfill-task-thumbnails.ts) — for when someone doesn't
// want to wait for the next tick, or wants to force a fresh frame even
// though a thumbnail already exists (e.g. ffmpeg picked a bad one).
//
// Same reconcile-then-retry logic as the cron: check R2 for an
// already-generated auto-thumb first (cheap, instant) before falling back
// to enqueueing a real ffmpeg job on e8-file-server.
const VIDEO_EXT_SQL = sql`(
  ${fileTable.s3Key} ~* '\\.(mp4|mov|m4v|webm|mkv)$'
  OR ${fileTable.name} ~* '\\.(mp4|mov|m4v|webm|mkv)$'
)`;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || !["admin", "manager", "qc"].includes(user.role?.toLowerCase() || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;

    const [video] = await db
      .select({
        id: fileTable.id,
        s3Key: fileTable.s3Key,
        name: fileTable.name,
      })
      .from(fileTable)
      .where(
        and(
          eq(fileTable.taskId, taskId),
          eq(fileTable.folderType, "main"),
          eq(fileTable.isActive, true),
          or(like(fileTable.mimeType, "video/%"), VIDEO_EXT_SQL)
        )
      )
      .limit(1);

    if (!video?.s3Key) {
      return NextResponse.json(
        { error: "No active video file found on this task" },
        { status: 404 }
      );
    }

    // Force-regenerate: deactivate any existing thumbnail row so a fresh
    // one can take its place. thumbnail-complete's own idempotency check
    // (see src/app/api/internal/thumbnail-complete/route.ts) would
    // otherwise skip creating a new row while an active one exists.
    await db
      .update(fileTable)
      .set({ isActive: false })
      .where(
        and(
          eq(fileTable.taskId, taskId),
          eq(fileTable.folderType, "thumbnails"),
          eq(fileTable.isActive, true)
        )
      );

    const reconciled = await reconcileExistingAutoThumbnail({
      id: video.id,
      s3Key: video.s3Key,
      taskId,
      name: video.name || "",
    });

    if (reconciled.reconciled) {
      return NextResponse.json({ ok: true, outcome: "reconciled", fileId: reconciled.fileId });
    }

    const { env } = getCloudflareContext();
    const res = await retryThumbnail(env, video.s3Key);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, outcome: res.outcome || "queued" });
  } catch (err: any) {
    console.error("Generate thumbnail error:", err);
    return NextResponse.json({ error: "Server error", details: err.message }, { status: 500 });
  }
}