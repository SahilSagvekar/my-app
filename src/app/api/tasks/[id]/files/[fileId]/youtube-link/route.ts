import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { file as fileTable, task as taskTable } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import { extractYoutubeVideoId, assertYoutubeEmbeddable, YoutubeLinkInvalidError } from "@/lib/youtube-link";

// POST /api/tasks/[id]/files/[fileId]/youtube-link
// DELETE /api/tasks/[id]/files/[fileId]/youtube-link
//
// Lets the editor assigned to a task attach an existing YouTube video to
// one of their uploaded files, so QC/client review plays it via YouTube's
// IFrame Player instead of our own stream — same playback path as the
// automatic review-mirror upload (see review-mirror.ts / youtube-mirror.ts),
// just skipping our own upload since the video already exists on YouTube.
//
// Gated the same way the editor-dashboard UI is: only the assigned editor,
// and only on tasks actually headed to client review. requiresClientReview
// is recomputed here rather than trusted off the Task row for the same
// reason GET /api/tasks and /api/tasks/[id]/status do — see the comment
// in app/api/tasks/route.ts ("Recompute requiresClientReview per-task").
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

function computeRequiresClientReview(task: {
  deliverableType?: string | null;
  monthlyDeliverable?: { type?: string | null } | null;
  oneOffDeliverable?: { type?: string | null } | null;
  client?: { requiresClientReview?: boolean | null; clientReviewDeliverableTypes?: string[] | null } | null;
}): boolean {
  if (!task.client?.requiresClientReview) return false;
  const allowedTypes = task.client.clientReviewDeliverableTypes ?? [];
  if (allowedTypes.length === 0) return true;
  const rawDeliverableType = task.monthlyDeliverable?.type || task.oneOffDeliverable?.type || "";
  const fallbackShortCode = DELIVERABLE_SHORT_CODES[rawDeliverableType.toLowerCase().trim()] || rawDeliverableType;
  const taskType = task.deliverableType || fallbackShortCode || "";
  return allowedTypes.includes(taskType);
}

async function loadAndAuthorize(req: NextRequest, taskId: string, fileId: string) {
  const db = getDbHttp();
  const user = await getCurrentUser2(req);
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const task = await db.query.task.findFirst({
    where: eq(taskTable.id, taskId),
    columns: { id: true, assignedTo: true, deliverableType: true },
    with: {
      client: { columns: { requiresClientReview: true, clientReviewDeliverableTypes: true } },
      monthlyDeliverable: { columns: { type: true } },
      oneOffDeliverable: { columns: { type: true } },
    },
  });
  if (!task) {
    return { error: NextResponse.json({ error: "Task not found" }, { status: 404 }) };
  }

  const isAssignedEditor = task.assignedTo === user.id;
  const isAdmin = ["admin", "manager"].includes((user.role || "").toLowerCase());
  if (!isAssignedEditor && !isAdmin) {
    return { error: NextResponse.json({ error: "Only the assigned editor can link a YouTube video for this task" }, { status: 403 }) };
  }

  if (!computeRequiresClientReview(task)) {
    return { error: NextResponse.json({ error: "This task isn't going to client review — YouTube linking isn't available" }, { status: 403 }) };
  }

  const file = await db.query.file.findFirst({
    where: and(eq(fileTable.id, fileId), eq(fileTable.taskId, taskId)),
    columns: { id: true, mimeType: true, isActive: true },
  });
  if (!file) {
    return { error: NextResponse.json({ error: "File not found on this task" }, { status: 404 }) };
  }
  if (!file.mimeType?.startsWith("video/")) {
    return { error: NextResponse.json({ error: "Only video files can be linked to YouTube" }, { status: 400 }) };
  }

  return { db, user, file };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id: taskId, fileId } = await params;
  const authResult = await loadAndAuthorize(req, taskId, fileId);
  if (authResult.error) return authResult.error;
  const { db, user } = authResult;

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const videoId = extractYoutubeVideoId(body.url || "");
  if (!videoId) {
    return NextResponse.json({ error: "That doesn't look like a YouTube link" }, { status: 400 });
  }

  try {
    await assertYoutubeEmbeddable(videoId);
  } catch (err) {
    if (err instanceof YoutubeLinkInvalidError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  await db.update(fileTable)
    .set({
      youtubeVideoId: videoId,
      youtubeUploadedAt: new Date().toISOString(),
      youtubeLinkedBy: user.id,
    })
    .where(eq(fileTable.id, fileId));

  return NextResponse.json({ youtubeVideoId: videoId });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id: taskId, fileId } = await params;
  const authResult = await loadAndAuthorize(req, taskId, fileId);
  if (authResult.error) return authResult.error;
  const { db } = authResult;

  await db.update(fileTable)
    .set({ youtubeVideoId: null, youtubeUploadedAt: null, youtubeLinkedBy: null })
    .where(eq(fileTable.id, fileId));

  return NextResponse.json({ ok: true });
}