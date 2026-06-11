export const dynamic = 'force-dynamic';
// GET /api/cron/check-drive-mirrors
// Polls the file server's completed-mirror queue and writes Drive URLs to the DB.
// Called by cron-master every 2 minutes. No cross-server push needed.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { drainDriveMirrorQueue, ackDriveMirrorJobs } from '@/lib/file-server';

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret');
  if (process.env.NODE_ENV === 'production' && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Drain the queue from the file server
    const jobs = await drainDriveMirrorQueue();

    if (jobs.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: 'Queue empty' });
    }

    console.log(`[check-drive-mirrors] 📬 ${jobs.length} job(s) to process`);

    const succeeded: string[] = [];
    const failed: { fileRecordId: string; error: string }[] = [];

    for (const job of jobs) {
      try {
        const existing = await prisma.file.findUnique({
          where: { id: job.fileRecordId },
          select: { id: true, reviewDriveUrl: true },
        });

        if (!existing) {
          console.warn(`[check-drive-mirrors] File record not found: ${job.fileRecordId} — acking anyway to clear queue`);
          succeeded.push(job.fileRecordId);
          continue;
        }

        if (existing.reviewDriveUrl) {
          console.log(`[check-drive-mirrors] Already has Drive URL — skipping: ${job.fileRecordId}`);
          succeeded.push(job.fileRecordId);
          continue;
        }

        await prisma.file.update({
          where: { id: job.fileRecordId },
          data: { reviewDriveUrl: job.reviewDriveUrl },
        });

        console.log(`[check-drive-mirrors] ✅ ${job.fileRecordId} → ${job.reviewDriveUrl}`);
        succeeded.push(job.fileRecordId);
      } catch (err: any) {
        console.error(`[check-drive-mirrors] ❌ Failed to update ${job.fileRecordId}: ${err.message}`);
        failed.push({ fileRecordId: job.fileRecordId, error: err.message });
      }
    }

    // 2. Ack only the ones we successfully processed
    if (succeeded.length > 0) {
      await ackDriveMirrorJobs(succeeded);
      console.log(`[check-drive-mirrors] Acked ${succeeded.length} job(s)`);
    }

    return NextResponse.json({
      ok: true,
      processed: succeeded.length,
      failed: failed.length,
      failures: failed.length > 0 ? failed : undefined,
    });
  } catch (err: any) {
    console.error('[check-drive-mirrors] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}