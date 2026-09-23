// src/lib/drive/preview-jobs.ts
//
// Job queue for Drive video previews (720p HLS + scrub sprite), kept in the
// DriveItem row itself (previewStatus: none -> queued -> processing -> ready|failed).
//
// Why a DB queue polled by the drive tick instead of a Cloudflare Queue
// consumer that awaits the transcode: queue consumers have a 15-minute
// wall-clock limit, and a long transcode would outlive it. Instead the
// file server runs the transcode in the background and this tick polls it
// every minute — and those polls are exactly what keep the transcoder
// container from going to sleep mid-job.

import { sql } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { createId } from '@/lib/db/id';
import { getHlsJobStatus, startHlsJob } from '@/lib/file-server';
import { isVideoName, HLS_PREFIX } from './keys';
import { tsToIso } from './index-store';

const MAX_ATTEMPTS = 3;
const CONCURRENCY = Math.max(1, Number(process.env.DRIVE_PREVIEW_CONCURRENCY || 1));
const LOST_JOB_GRACE_MS = 3 * 60_000; // status 'unknown' this long after start = container restarted
const STALL_LIMIT_MS = 6 * 60 * 60_000;

async function rows<T = any>(query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await getDbHttp().execute(query);
  return (res as any).rows as T[];
}

/** Put a video at the front of the line (someone just opened it). */
export async function requestPreview(key: string): Promise<string | null> {
  if (!isVideoName(key)) return null;
  const r = await rows<{ previewStatus: string }>(sql`
    UPDATE "DriveItem" SET
      "previewStatus" = CASE WHEN "previewStatus" IN ('none', 'failed') THEN 'queued' ELSE "previewStatus" END,
      "previewPriority" = 10,
      "previewRequestedAt" = CASE WHEN "previewStatus" IN ('none', 'failed') THEN now() ELSE coalesce("previewRequestedAt", now()) END,
      "previewAttempts" = CASE WHEN "previewStatus" = 'failed' THEN 0 ELSE "previewAttempts" END,
      "previewError" = CASE WHEN "previewStatus" = 'failed' THEN NULL ELSE "previewError" END,
      "updatedAt" = now()
    WHERE "key" = ${key} AND "removedAt" IS NULL AND "storageTier" = 'r2' AND "isFolder" = false
    RETURNING "previewStatus"
  `);
  return r[0]?.previewStatus ?? null;
}

/** Queue previews for existing videos under a prefix (admin backfill for deliverables). */
export async function queuePreviewsUnder(prefix: string, onlyOutputs = true): Promise<number> {
  const like = `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const r = await rows(sql`
    UPDATE "DriveItem" SET "previewStatus" = 'queued', "previewRequestedAt" = now(), "previewPriority" = 0, "updatedAt" = now()
    WHERE "key" LIKE ${like} AND "previewStatus" = 'none' AND "removedAt" IS NULL AND "trashedAt" IS NULL
      AND "storageTier" = 'r2' AND "isFolder" = false
      AND "name" ~* '\\.(mp4|mov|m4v|webm|mkv|avi|wmv|mts|m2ts|mxf)$'
      ${onlyOutputs ? sql`AND "key" LIKE '%/outputs/%'` : sql``}
    RETURNING "key"
  `);
  return r.length;
}

async function failOrRetry(key: string, previewPrefix: string | null, attempts: number, error: string) {
  const next = attempts + 1;
  const final = next >= MAX_ATTEMPTS;
  await getDbHttp().execute(sql`
    UPDATE "DriveItem" SET
      "previewStatus" = ${final ? 'failed' : 'queued'},
      "previewAttempts" = ${next},
      "previewError" = ${error.slice(0, 500)},
      "previewPrefix" = NULL,
      "previewStartedAt" = NULL,
      "updatedAt" = now()
    WHERE "key" = ${key} AND "previewStatus" = 'processing' AND "previewPrefix" IS NOT DISTINCT FROM ${previewPrefix}
  `);
}

export async function runPreviewTick(env: any): Promise<{ polled: number; completed: number; failed: number; started: number }> {
  const out = { polled: 0, completed: 0, failed: 0, started: 0 };

  // 1. Poll running jobs (this is also the transcoder's keep-alive).
  const running = await rows<{ key: string; previewPrefix: string | null; previewAttempts: number; previewStartedAt: string | null }>(sql`
    SELECT "key", "previewPrefix", "previewAttempts", "previewStartedAt" FROM "DriveItem"
    WHERE "previewStatus" = 'processing' LIMIT 20
  `);
  let stillRunning = 0;
  for (const job of running) {
    out.polled++;
    const startedMs = new Date(tsToIso(job.previewStartedAt) || Date.now()).getTime();
    try {
      const status = await getHlsJobStatus(env, job.key);
      if (status.state === 'done' && status.result) {
        await getDbHttp().execute(sql`
          UPDATE "DriveItem" SET
            "previewStatus" = 'ready',
            "durationSeconds" = ${status.result.durationSeconds},
            "width" = ${status.result.width},
            "height" = ${status.result.height},
            "previewError" = NULL,
            "updatedAt" = now()
          WHERE "key" = ${job.key} AND "previewStatus" = 'processing' AND "previewPrefix" IS NOT DISTINCT FROM ${job.previewPrefix}
        `);
        out.completed++;
      } else if (status.state === 'failed') {
        await failOrRetry(job.key, job.previewPrefix, job.previewAttempts, status.error || 'Transcode failed');
        out.failed++;
      } else if (status.state === 'unknown') {
        if (Date.now() - startedMs > LOST_JOB_GRACE_MS) {
          await failOrRetry(job.key, job.previewPrefix, job.previewAttempts, 'Transcoder restarted mid-job');
          out.failed++;
        } else {
          stillRunning++;
        }
      } else if (Date.now() - startedMs > STALL_LIMIT_MS) {
        await failOrRetry(job.key, job.previewPrefix, job.previewAttempts, 'Transcode took longer than 6 hours');
        out.failed++;
      } else {
        stillRunning++;
      }
    } catch (err: any) {
      console.warn(`[drive-preview] status check failed for ${job.key}:`, err?.message);
      stillRunning++;
    }
  }

  // 2. Start new jobs up to the concurrency cap. Highest priority (opened in
  // the player) first, then oldest request.
  while (stillRunning < CONCURRENCY) {
    const outPrefix = `${HLS_PREFIX}${createId()}/`;
    const claimed = await rows<{ key: string; etag: string | null; previewAttempts: number }>(sql`
      UPDATE "DriveItem" SET "previewStatus" = 'processing', "previewPrefix" = ${outPrefix}, "previewStartedAt" = now(), "updatedAt" = now()
      WHERE "key" = (
        SELECT "key" FROM "DriveItem"
        WHERE "previewStatus" = 'queued' AND "removedAt" IS NULL AND "trashedAt" IS NULL
          AND "storageTier" = 'r2' AND "pending" = false
        ORDER BY "previewPriority" DESC, "previewRequestedAt" ASC NULLS LAST
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      ) AND "previewStatus" = 'queued'
      RETURNING "key", "etag", "previewAttempts"
    `);
    const job = claimed[0];
    if (!job) break;
    try {
      const res = await startHlsJob(env, job.key, outPrefix, job.etag);
      if (!res.accepted) {
        // Transcoder is full (e.g. a job it's still finishing that we lost
        // track of) — put it back and try next tick.
        await getDbHttp().execute(sql`
          UPDATE "DriveItem" SET "previewStatus" = 'queued', "previewPrefix" = NULL, "previewStartedAt" = NULL
          WHERE "key" = ${job.key} AND "previewPrefix" = ${outPrefix}
        `);
        break;
      }
      out.started++;
      stillRunning++;
    } catch (err: any) {
      await failOrRetry(job.key, outPrefix, job.previewAttempts, err?.message || 'Could not start transcode');
      out.failed++;
      break;
    }
  }

  return out;
}
