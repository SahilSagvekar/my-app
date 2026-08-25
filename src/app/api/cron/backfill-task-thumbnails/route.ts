export const dynamic = 'force-dynamic';
// Cron: queue/reconcile auto-thumbnails for task output videos that have
// none. Runs as part of the every-minute tick so QC + client task cards
// stop showing "No thumbnail" once generation catches up.

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { backfillMissingTaskThumbnails } from '@/lib/backfill-task-thumbnails';

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
    return NextResponse.json({ ok: true, ...summary });
  } catch (err: any) {
    console.error('[Cron Backfill Task Thumbnails]', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Backfill failed' }, { status: 500 });
  }
}
