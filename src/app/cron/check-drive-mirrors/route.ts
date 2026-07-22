export const dynamic = 'force-dynamic';
// src/app/api/cron/check-drive-mirrors/route.ts
// Called by cron-master.ts ("Drive Mirror Sync", every 30s).
// Polls the file server's completed Drive-mirror queue, writes
// reviewDriveUrl onto the matching File records, then acks so the file
// server drops those entries. See drive-mirror.ts for the dispatch side
// and e8-file-server/src/index.js (GET /drive-mirror/completed, POST
// /drive-mirror/ack) for the file server side.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { drainDriveMirrorQueue, ackDriveMirrorJobs } from '@/lib/file-server';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  const cookieHeader = req.headers.get('cookie');
  const match = cookieHeader?.match(/authToken=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.role?.toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobs = await drainDriveMirrorQueue();

    if (jobs.length === 0) {
      return NextResponse.json({ ok: true, message: 'No completed Drive mirrors pending', processed: 0 });
    }

    const succeededIds: string[] = [];

    for (const job of jobs) {
      try {
        await prisma.file.update({
          where: { id: job.fileRecordId },
          data: { reviewDriveUrl: job.reviewDriveUrl },
        });
        succeededIds.push(job.fileRecordId);
        console.log(`[check-drive-mirrors] ✅ File ${job.fileRecordId} — reviewDriveUrl set (${job.driveFileId})`);
      } catch (err: any) {
        // Don't ack this one — it'll be retried on the next poll. Most
        // likely cause: the File record was deleted between dispatch and
        // completion.
        console.error(`[check-drive-mirrors] ❌ Failed to write reviewDriveUrl for file ${job.fileRecordId}:`, err.message);
      }
    }

    if (succeededIds.length > 0) {
      await ackDriveMirrorJobs(succeededIds);
    }

    return NextResponse.json({
      ok: true,
      message: `Processed ${succeededIds.length}/${jobs.length} completed Drive mirror(s)`,
      processed: succeededIds.length,
      total: jobs.length,
    });
  } catch (err: any) {
    console.error('❌ /api/cron/check-drive-mirrors error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}