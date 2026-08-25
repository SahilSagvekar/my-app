// Shared logic for finding task-output videos missing thumbnails and
// either reconciling an already-generated R2 auto-thumb into a File row
// or enqueueing ffmpeg generation via e8-file-server.

import { getDbHttp } from '@/lib/db';
import { file as fileTable } from '@/lib/db/schema';
import { and, eq, like, isNotNull, notExists } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/db/id';
import { checkFileExists, getFileUrl } from '@/lib/s3';
import { retryThumbnail } from '@/lib/file-server';
import { autoThumbnailKeyForVideo } from '@/lib/task-thumbnail';

export type EligibleVideo = {
  id: string;
  s3Key: string;
  taskId: string;
  name: string;
};

export async function findVideosMissingThumbnails(limit: number): Promise<EligibleVideo[]> {
  const db = getDbHttp();
  const thumbFile = alias(fileTable, 'thumbFile');

  const rows = await db
    .select({
      id: fileTable.id,
      s3Key: fileTable.s3Key,
      taskId: fileTable.taskId,
      name: fileTable.name,
    })
    .from(fileTable)
    .where(
      and(
        eq(fileTable.folderType, 'main'),
        eq(fileTable.isActive, true),
        like(fileTable.mimeType, 'video/%'),
        isNotNull(fileTable.s3Key),
        notExists(
          db
            .select()
            .from(thumbFile)
            .where(
              and(
                eq(thumbFile.taskId, fileTable.taskId),
                eq(thumbFile.folderType, 'thumbnails'),
                eq(thumbFile.isActive, true)
              )
            )
        )
      )
    )
    .limit(limit);

  return rows.filter((r): r is EligibleVideo => !!r.s3Key && !!r.taskId);
}

/** If R2 already has `.thumbnails/{videoKey}.jpg`, create the File row now. */
export async function reconcileExistingAutoThumbnail(video: EligibleVideo): Promise<{
  reconciled: boolean;
  fileId?: string;
}> {
  const thumbKey = autoThumbnailKeyForVideo(video.s3Key);
  const exists = await checkFileExists(thumbKey);
  if (!exists) return { reconciled: false };

  const db = getDbHttp();

  const [existing] = await db
    .select({ id: fileTable.id })
    .from(fileTable)
    .where(eq(fileTable.s3Key, thumbKey))
    .limit(1);

  if (existing) {
    return { reconciled: true, fileId: existing.id };
  }

  const id = createId();
  await db.insert(fileTable).values({
    id,
    taskId: video.taskId,
    name: 'auto-thumbnail.jpg',
    url: getFileUrl(thumbKey),
    mimeType: 'image/jpeg',
    size: 0,
    s3Key: thumbKey,
    folderType: 'thumbnails',
    isActive: true,
    uploadedBy: null,
    revisionNote: 'Auto-generated from video (reconciled existing R2 thumbnail)',
  });

  return { reconciled: true, fileId: id };
}

export type BackfillResult = {
  s3Key: string;
  taskId: string;
  outcome: 'reconciled' | 'queued' | 're-queued' | 'skipped' | 'failed';
  error?: string;
};

/**
 * Process up to `limit` videos missing thumbnails:
 * 1) reconcile if auto-thumb already in R2
 * 2) otherwise enqueue generation on the file server
 */
export async function backfillMissingTaskThumbnails(
  env: CloudflareEnv,
  limit: number
): Promise<{
  processed: number;
  reconciled: number;
  queued: number;
  skipped: number;
  failed: number;
  results: BackfillResult[];
}> {
  const eligible = await findVideosMissingThumbnails(limit);
  const results: BackfillResult[] = [];

  const CONCURRENCY = 5;
  for (let i = 0; i < eligible.length; i += CONCURRENCY) {
    const batch = eligible.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (video) => {
        try {
          const reconciled = await reconcileExistingAutoThumbnail(video);
          if (reconciled.reconciled) {
            return {
              s3Key: video.s3Key,
              taskId: video.taskId,
              outcome: 'reconciled' as const,
            };
          }

          const res = await retryThumbnail(env, video.s3Key);
          if (res.error) {
            return {
              s3Key: video.s3Key,
              taskId: video.taskId,
              outcome: 'failed' as const,
              error: res.error,
            };
          }
          const outcome =
            res.outcome === 're-queued'
              ? ('re-queued' as const)
              : res.outcome === 'skipped'
                ? ('skipped' as const)
                : ('queued' as const);
          return { s3Key: video.s3Key, taskId: video.taskId, outcome };
        } catch (err: any) {
          return {
            s3Key: video.s3Key,
            taskId: video.taskId,
            outcome: 'failed' as const,
            error: err?.message || String(err),
          };
        }
      })
    );

    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value);
      else {
        results.push({
          s3Key: 'unknown',
          taskId: 'unknown',
          outcome: 'failed',
          error: String(r.reason),
        });
      }
    }
  }

  return {
    processed: results.length,
    reconciled: results.filter((r) => r.outcome === 'reconciled').length,
    queued: results.filter((r) => r.outcome === 'queued' || r.outcome === 're-queued').length,
    skipped: results.filter((r) => r.outcome === 'skipped').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
    results,
  };
}
