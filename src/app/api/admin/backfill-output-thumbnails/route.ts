export const dynamic = 'force-dynamic';
// src/app/api/admin/backfill-output-thumbnails/route.ts
//
// One-off admin action: finds every active task-output video that has no
// real thumbnail image, and queues an auto-thumbnail job for each via
// e8-file-server's existing /thumbnail/retry endpoint (same queue/worker
// that already handles raw-footage thumbnails and new output uploads —
// see thumbnail.js). This route only ENQUEUES; the actual ffmpeg work and
// the webhook that creates each File row happen asynchronously afterward.
//
// GET  — dry run: counts + a sample of what would be queued, queues nothing
// POST — actually queues thumbnail jobs for every eligible video

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable } from '@/lib/db/schema';
import { and, eq, like, isNotNull, notExists } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { requireAdmin } from '@/lib/auth';
import { retryThumbnail } from '@/lib/file-server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

async function findEligibleVideos(limit: number) {
  const db = getDbHttp();
  const thumbFile = alias(fileTable, 'thumbFile');

  return db.select({
    id: fileTable.id,
    s3Key: fileTable.s3Key,
    taskId: fileTable.taskId,
    name: fileTable.name,
  }).from(fileTable)
    .where(and(
      eq(fileTable.folderType, 'main'),
      eq(fileTable.isActive, true),
      like(fileTable.mimeType, 'video/%'),
      isNotNull(fileTable.s3Key),
      notExists(
        db.select().from(thumbFile).where(and(
          eq(thumbFile.taskId, fileTable.taskId),
          eq(thumbFile.folderType, 'thumbnails'),
          eq(thumbFile.isActive, true),
        ))
      ),
    ))
    .limit(limit);
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const eligible = await findEligibleVideos(2000);
    return NextResponse.json({
      eligibleCount: eligible.length,
      sample: eligible.slice(0, 10).map(v => ({ taskId: v.taskId, name: v.name, s3Key: v.s3Key })),
      note: eligible.length === 2000 ? 'Capped at 2000 — there may be more. Re-run after this batch completes.' : undefined,
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

    const eligible = await findEligibleVideos(2000);

    if (eligible.length === 0) {
      return NextResponse.json({ ok: true, message: 'Nothing to backfill — every active output video already has a thumbnail.', queued: 0 });
    }

    const results: { s3Key: string; outcome?: string; kind?: string; error?: string }[] = [];
    const CONCURRENCY = 10;

    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      const batch = eligible.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map(v => retryThumbnail(env, v.s3Key!))
      );
      settled.forEach((r, idx) => {
        const s3Key = batch[idx].s3Key!;
        if (r.status === 'fulfilled') {
          results.push({ s3Key, ...r.value });
        } else {
          results.push({ s3Key, error: (r.reason as Error).message });
        }
      });
    }

    const queued = results.filter(r => r.outcome === 'queued' || r.outcome === 're-queued').length;
    const skipped = results.filter(r => r.outcome === 'skipped').length;
    const failed = results.filter(r => r.error).length;

    return NextResponse.json({
      ok: true,
      message: `Queued ${queued} thumbnail job(s), ${skipped} already in progress, ${failed} failed to queue.`,
      queued,
      skipped,
      failed,
      results: failed > 0 ? results.filter(r => r.error) : undefined, // only include failures in the response body
    });
  } catch (err: any) {
    console.error('[Backfill Output Thumbnails] POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}