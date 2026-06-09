// POST /api/internal/drive-mirror-complete
// Called by the file server after it finishes uploading a file to Google Drive.
// Updates the File record with the Drive URL for client review.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Simple internal secret check — file server sends this header
    const secret = req.headers.get('x-internal-secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileRecordId, reviewDriveUrl, driveFileId } = await req.json();

    if (!fileRecordId || !reviewDriveUrl) {
      return NextResponse.json({ error: 'fileRecordId and reviewDriveUrl required' }, { status: 400 });
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