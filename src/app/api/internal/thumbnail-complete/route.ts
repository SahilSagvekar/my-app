// POST /api/internal/thumbnail-complete
// Called by e8-file-server once it finishes ffmpeg-generating a thumbnail
// for a task-output video that had no real thumbnail image. Creates a
// normal `file` row (folderType: 'thumbnails') for the result — this is
// deliberately a REAL file record, indistinguishable in structure from one
// a human uploaded, so ClientTaskCard.tsx / QCDashboard.tsx's existing
// thumbnail lookup (files.find(f => f.folderType === 'thumbnails')) picks
// it up automatically. No frontend changes needed for this to show up.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createId } from '@/lib/db/id';
import { getFileUrl } from '@/lib/s3';

function isAuthorizedCallback(req: NextRequest): boolean {
  const secret = req.headers.get('x-internal-secret');
  return !!(secret && process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCallback(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDbHttp();

  try {
    const { videoS3Key, thumbnailS3Key, sizeBytes } = await req.json();

    if (!videoS3Key || !thumbnailS3Key || typeof sizeBytes !== 'number') {
      return NextResponse.json({ error: 'videoS3Key, thumbnailS3Key, and sizeBytes (number) are required' }, { status: 400 });
    }

    // Idempotency — if this webhook fires twice (retry, duplicate delivery),
    // don't create a second row for the same thumbnail key.
    const [existingThumb] = await db.select({ id: fileTable.id })
      .from(fileTable).where(eq(fileTable.s3Key, thumbnailS3Key)).limit(1);
    if (existingThumb) {
      return NextResponse.json({ ok: true, alreadyExists: true, fileId: existingThumb.id });
    }

    // Resolve the task via the original video's own file record.
    const [videoFile] = await db.select({ taskId: fileTable.taskId })
      .from(fileTable).where(eq(fileTable.s3Key, videoS3Key)).limit(1);

    if (!videoFile) {
      console.error(`[Thumbnail Complete] No file record found for video key: ${videoS3Key}`);
      return NextResponse.json({ error: 'Video file record not found' }, { status: 404 });
    }

    const id = createId();
    await db.insert(fileTable).values({
      id,
      taskId: videoFile.taskId,
      name: 'auto-thumbnail.jpg',
      url: getFileUrl(thumbnailS3Key),
      mimeType: 'image/jpeg',
      size: sizeBytes,
      s3Key: thumbnailS3Key,
      folderType: 'thumbnails',
      isActive: true,
      uploadedBy: null,
      revisionNote: 'Auto-generated from video (no thumbnail was uploaded for this task)',
    });

    console.log(`✅ [Thumbnail Complete] Created file ${id} for auto-thumbnail: ${thumbnailS3Key} (task ${videoFile.taskId})`);
    return NextResponse.json({ ok: true, fileId: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Thumbnail Complete] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}