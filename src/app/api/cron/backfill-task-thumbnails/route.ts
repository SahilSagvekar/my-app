export const dynamic = 'force-dynamic';
// Cron: queue/reconcile auto-thumbnails for task output videos that have
// none. Runs as part of the every-minute tick so QC + client task cards
// stop showing "No thumbnail" once generation catches up.

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { backfillMissingTaskThumbnails } from '@/lib/backfill-task-thumbnails';
import { processThumbnailBatch } from '@/lib/file-server';

const BATCH_PER_TICK = 25;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  return !!(cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { env } = getCloudflareContext();
    const summary = await backfillMissingTaskThumbnails(env, BATCH_PER_TICK);

    // Enqueueing alone doesn't process anything — e8-file-server's
    // background setInterval loop stops ticking whenever the container
    // idles, which is most of the time. Draining a batch here, inside
    // this request, is what actually guarantees jobs get worked.
    let processed: { done: number; failed: number; remaining: number } | { error: string };
    try {
      processed = await processThumbnailBatch(env, { limit: 3, timeBudgetMs: 20000 });
    } catch (err: any) {
      processed = { error: err?.message || 'processThumbnailBatch failed' };
    }

    return NextResponse.json({ ok: true, ...summary, processed });
  } catch (err: any) {
    console.error('[Cron Backfill Task Thumbnails]', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Backfill failed' }, { status: 500 });
  }
}