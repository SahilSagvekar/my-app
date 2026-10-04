export const dynamic = 'force-dynamic';
// src/app/api/cron/tick-queues/route.ts
// Drains both background job queues a few jobs at a time. Called every
// minute by a Cron Trigger (see worker.ts) — this is the Workers-native
// replacement for what cron-master.ts's setInterval loop used to do on EC2/
// PM2, which is no longer running.
//
// Handles:
//   - upload queue (upload-notifications for finished file uploads —
//     was silently stalled since the EC2 cutover, since nothing was calling
//     runUploadWorkerTick anymore)
//   - NAS sweep queue (weekly R2 -> NAS backup copy jobs)
//
// Each tick call only pops ONE job per queue (see runUploadWorkerTick /
// runNasSweepWorkerTick) — this route loops a bounded number of times per
// invocation so a backlog drains faster than one job/minute, while staying
// well inside a Cron Trigger's execution time limit.

import { NextRequest, NextResponse } from 'next/server';
import { runUploadWorkerTick } from '@/lib/upload-worker';
import { runNasSweepWorkerTick } from '@/lib/nas-sweep-worker';
import { getQueueStats } from '@/lib/upload-queue';
import { getNasSweepQueueStats } from '@/lib/nas-sweep-queue';
import { publishDueAnnouncements, sendEmailBatches } from '@/lib/announcements';

const MAX_ITERATIONS_PER_TICK = 10; // bounded to stay well inside execution time limits

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  return !!(cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uploadTicks = 0;
  let nasTicks = 0;

  try {
    for (let i = 0; i < MAX_ITERATIONS_PER_TICK; i++) {
      const before = await getQueueStats();
      if (before.pending === 0) break;
      await runUploadWorkerTick();
      uploadTicks++;
    }
  } catch (err: any) {
    console.error('[TickQueues] Upload queue tick error:', err.message);
  }

  try {
    for (let i = 0; i < MAX_ITERATIONS_PER_TICK; i++) {
      const before = await getNasSweepQueueStats();
      if (before.pending === 0) break;
      await runNasSweepWorkerTick();
      nasTicks++;
    }
  } catch (err: any) {
    console.error('[TickQueues] NAS sweep queue tick error:', err.message);
  }

  // Announcements: publish scheduled ones that are due, then send the next
  // batch of announcement emails (one batch per tick, never a big loop).
  let announcementsPublished = 0;
  let announcementEmails = 0;
  try {
    announcementsPublished = await publishDueAnnouncements();
    announcementEmails = await sendEmailBatches();
  } catch (err: any) {
    console.error('[TickQueues] Announcements tick error:', err.message);
  }

  return NextResponse.json({ ok: true, uploadTicks, nasTicks, announcementsPublished, announcementEmails });
}