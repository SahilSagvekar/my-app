import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { mediaPreview } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';

export const dynamic = 'force-dynamic';

// Called only by the ffmpeg-capable file service after it has uploaded the
// WebP/JPEG preview to R2. Keep this separate from browser authentication.
export async function POST(req: NextRequest) {
  const secret = process.env.FILE_SERVER_SECRET;
  if (!secret || req.headers.get('x-media-preview-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    s3Key, fileId = null, taskId = null, previewS3Key = null,
    status = 'READY', width = null, height = null, durationSeconds = null,
    frameTimestampSeconds = null, sourceEtag = null, attempts = 1,
    errorMessage = null,
  } = body;

  if (typeof s3Key !== 'string' || !s3Key || !['READY', 'FAILED', 'PROCESSING'].includes(status)) {
    return NextResponse.json({ error: 'Invalid preview payload' }, { status: 400 });
  }
  if (status === 'READY' && (typeof previewS3Key !== 'string' || !previewS3Key)) {
    return NextResponse.json({ error: 'previewS3Key is required when READY' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const db = getDbHttp();
  await db.insert(mediaPreview).values({
    id: createId(), s3Key, fileId, taskId, previewS3Key, status, width, height,
    durationSeconds, frameTimestampSeconds, sourceEtag, attempts, errorMessage,
    createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: mediaPreview.s3Key,
    set: { fileId, taskId, previewS3Key, status, width, height, durationSeconds,
      frameTimestampSeconds, sourceEtag, attempts, errorMessage, updatedAt: now },
  });

  return NextResponse.json({ ok: true });
}
