// POST /api/internal/thumbnail-complete
//
// Called by e8-file-server's thumbnailWorker once it finishes generating a
// thumbnail for an OUTPUT video (raw-footage thumbnails don't call this —
// those are browsed directly from R2 by DriveExplorer, not through the
// Task's files list). Creates the File row that getTaskThumbnail() /
// getTaskThumbnailFromFiles() (QC and Client dashboards) actually read.
//
// Companion fix to e8-file-server's missing shouldThumbnailOutput() —
// without that fix this route would never get called at all, since the
// job that leads here would never successfully enqueue.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq } from 'drizzle-orm';
import { getFileUrl } from '@/lib/s3';

function isAuthorizedCallback(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  return (
    (!!process.env.CRON_SECRET && secret === process.env.CRON_SECRET) ||
    (!!process.env.FILE_SERVER_SECRET && secret === process.env.FILE_SERVER_SECRET)
  );
}

export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    if (!isAuthorizedCallback(req)) {
      console.error('[Thumbnail CB] Unauthorized callback');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // e8-file-server's thumbnailWorker.js sends videoS3Key/sizeBytes — keep
    // these names in sync with notifyOutputThumbnailComplete() there.
    const { videoS3Key: sourceS3Key, thumbnailS3Key, sizeBytes: size } = await req.json();
    if (!sourceS3Key || !thumbnailS3Key) {
      return NextResponse.json({ error: 'videoS3Key and thumbnailS3Key required' }, { status: 400 });
    }

    // The file server only knows S3 keys, not task IDs — resolve the task
    // via the source video's own (already-existing) File row.
    const [sourceFile] = await db.select({
      id: fileTable.id,
      taskId: fileTable.taskId,
      uploadedBy: fileTable.uploadedBy,
      name: fileTable.name,
    }).from(fileTable)
      .where(and(
        eq(fileTable.s3Key, sourceS3Key),
        eq(fileTable.folderType, 'main'),
        eq(fileTable.isActive, true),
      ))
      .limit(1);

    if (!sourceFile) {
      console.error(`[Thumbnail CB] No active main File found for source key: ${sourceS3Key} — MANUAL RECOVERY NEEDED (thumbnail exists in R2 at ${thumbnailS3Key})`);
      return NextResponse.json({ error: 'Source file not found' }, { status: 404 });
    }

    // Idempotency: a retried callback (or a second worker pass) shouldn't
    // create a duplicate thumbnail File for the same task.
    const [existingThumb] = await db.select({ id: fileTable.id }).from(fileTable)
      .where(and(
        eq(fileTable.taskId, sourceFile.taskId),
        eq(fileTable.folderType, 'thumbnails'),
        eq(fileTable.isActive, true),
      ))
      .limit(1);

    if (existingThumb) {
      return NextResponse.json({ ok: true, skipped: true, fileId: existingThumb.id });
    }

    const now = new Date().toISOString();
    const [created] = await db.insert(fileTable).values({
      id: createId(),
      taskId: sourceFile.taskId,
      name: `${sourceFile.name}.thumb.jpg`,
      url: getFileUrl(thumbnailS3Key),
      s3Key: thumbnailS3Key,
      mimeType: 'image/jpeg',
      size: typeof size === 'number' ? size : 0,
      uploadedBy: sourceFile.uploadedBy,
      folderType: 'thumbnails',
      isActive: true,
      createdAt: now,
      uploadedAt: now,
    }).returning();

    console.log(`✅ [Thumbnail CB] File ${created.id} created for task ${sourceFile.taskId}`);
    return NextResponse.json({ ok: true, fileId: created.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Thumbnail CB] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}