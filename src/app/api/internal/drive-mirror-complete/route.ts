// POST /api/internal/drive-mirror-complete
// Called by the file server after it finishes uploading a file to Google Drive.
// Updates the File record with the Drive URL for client review.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-internal-secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileRecordId, reviewDriveUrl, driveFileId } = await req.json();

    if (!fileRecordId || !reviewDriveUrl) {
      return NextResponse.json({ error: 'fileRecordId and reviewDriveUrl required' }, { status: 400 });
    }

    // Check the file record exists before trying to update
    const existing = await prisma.file.findUnique({
      where: { id: fileRecordId },
      select: { id: true, reviewDriveUrl: true },
    });

    if (!existing) {
      console.error(`[Drive Mirror CB] File record not found: ${fileRecordId}`);
      return NextResponse.json({ error: 'File record not found' }, { status: 404 });
    }

    await prisma.file.update({
      where: { id: fileRecordId },
      data: { reviewDriveUrl },
    });

    console.log(`✅ [Drive Mirror CB] File ${fileRecordId} updated with Drive URL: ${reviewDriveUrl}`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Drive Mirror CB] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/internal/drive-mirror-complete?secret=xxx
// Returns all file records that have no reviewDriveUrl but were uploaded more than
// 10 minutes ago — these are likely failed callbacks that need manual recovery.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const missing = await prisma.file.findMany({
    where: {
      reviewDriveUrl: null,
      mimeType: { startsWith: 'video/' },
      createdAt: { lt: tenMinutesAgo },
      task: { requiresClientReview: true },
    },
    select: {
      id: true,
      name: true,
      s3Key: true,
      createdAt: true,
      taskId: true,
      task: { select: { title: true, client: { select: { companyName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    count: missing.length,
    files: missing,
    note: 'These video files have requiresClientReview=true but no reviewDriveUrl. Check file server logs for: MANUAL RECOVERY NEEDED',
  });
}