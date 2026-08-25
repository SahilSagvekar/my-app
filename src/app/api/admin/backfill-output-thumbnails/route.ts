export const dynamic = 'force-dynamic';
// src/app/api/admin/backfill-output-thumbnails/route.ts
//
// Admin action: finds every active task-output video that has no
// thumbnail File row, reconciles existing R2 auto-thumbs into File rows,
// and queues ffmpeg jobs for the rest via e8-file-server.
//
// GET  — dry run: counts + sample
// POST — reconcile + queue

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  backfillMissingTaskThumbnails,
  findVideosMissingThumbnails,
} from '@/lib/backfill-task-thumbnails';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const eligible = await findVideosMissingThumbnails(2000);
    return NextResponse.json({
      eligibleCount: eligible.length,
      sample: eligible.slice(0, 10).map((v) => ({
        taskId: v.taskId,
        name: v.name,
        s3Key: v.s3Key,
      })),
      note:
        eligible.length === 2000
          ? 'Capped at 2000 — there may be more. Re-run after this batch completes.'
          : undefined,
    });
  } catch (err: any) {
    console.error('[Backfill Output Thumbnails] GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { env } = getCloudflareContext();

    const summary = await backfillMissingTaskThumbnails(env, 2000);

    if (summary.processed === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Nothing to backfill — every active output video already has a thumbnail.',
        ...summary,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Reconciled ${summary.reconciled}, queued ${summary.queued}, skipped ${summary.skipped}, failed ${summary.failed}.`,
      ...summary,
      results: summary.failed > 0 ? summary.results.filter((r) => r.outcome === 'failed') : undefined,
    });
  } catch (err: any) {
    console.error('[Backfill Output Thumbnails] POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
