export const dynamic = 'force-dynamic';
// src/app/api/cron/drive-tick/route.ts
//
// Every-minute housekeeping for Files & Drive (called from worker.ts's
// '* * * * *' cron, same x-cron-secret pattern as tick-queues):
//   1. Index reconcile — continues a running R2 <-> Postgres sync for up to
//      ~35s per tick. Starts a new full run once a day, and on first deploy
//      (no run yet), which is what performs the initial backfill.
//   2. Trash — permanently deletes items whose 30-day retention ran out.
//   3. Video previews — polls running transcodes and starts queued ones.
// Each step is isolated: one failing never blocks the others.

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  continueIndexSync,
  startIndexSync,
  getLatestSyncRun,
  isDriveTrashEnabled,
  isDrivePreviewsEnabled,
  expiredTrashRoots,
  logDriveActivity,
  tsToIso,
} from '@/lib/drive/index-store';
import { purgeTrashRoot } from '@/lib/drive/permanent-delete';
import { runPreviewTick } from '@/lib/drive/preview-jobs';

const SYNC_BUDGET_MS = 35_000;
const DAILY_MS = 24 * 60 * 60 * 1000;

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret');
  return !!(secret && process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { env } = getCloudflareContext();
  const report: Record<string, unknown> = {};

  // 1. Reconcile / backfill
  try {
    if (process.env.DRIVE_INDEX_AUTO_SYNC !== 'false') {
      const latest = await getLatestSyncRun();
      const lastStart = latest ? new Date(tsToIso(latest.startedAt) || 0).getTime() : 0;
      const lastEnd = latest?.finishedAt ? new Date(tsToIso(latest.finishedAt) || 0).getTime() : 0;
      const due =
        !latest ||
        (latest.status === 'done' && Date.now() - lastStart > DAILY_MS) ||
        (latest.status === 'failed' && Date.now() - lastEnd > 10 * 60_000); // retry a failed run after 10 min
      if (due) {
        await startIndexSync('', latest ? 'daily' : 'initial-backfill');
      }
    }
    const run = await continueIndexSync(env, SYNC_BUDGET_MS);
    if (run) report.sync = { id: run.id, status: run.status, listed: run.listedCount, tombstoned: run.tombstonedCount };
  } catch (err: any) {
    report.syncError = err?.message || String(err);
    console.error('[drive-tick] sync step failed:', err);
  }

  // 2. Trash retention
  if (isDriveTrashEnabled()) {
    try {
      const expired = await expiredTrashRoots(5);
      let purged = 0;
      for (const rootKey of expired) {
        try {
          const r = await purgeTrashRoot(env, rootKey);
          await logDriveActivity([{ key: rootKey, action: 'deleted', userId: null, details: { reason: 'trash-retention', files: r.deletedCount } }]);
          purged++;
        } catch (err: any) {
          console.error(`[drive-tick] purge failed for ${rootKey}:`, err?.message);
        }
      }
      report.trashPurged = purged;
    } catch (err: any) {
      report.trashError = err?.message || String(err);
    }
  }

  // 3. Previews
  if (isDrivePreviewsEnabled()) {
    try {
      report.previews = await runPreviewTick(env);
    } catch (err: any) {
      report.previewError = err?.message || String(err);
      console.error('[drive-tick] preview step failed:', err);
    }
  }

  return NextResponse.json({ ok: true, ...report });
}
