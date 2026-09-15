// src/app/api/cron/generate-qc-thumbnails/route.ts
// Generates media-preview thumbnails for every READY_FOR_QC task that
// doesn't already have a manual thumbnail or a READY preview. Ported from
// scripts/generate-qc-thumbnails.ts so it can be triggered externally
// (e.g. cron-job.org) via POST with the CRON_SECRET header, instead of
// being run manually with `npx tsx`.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import { task as taskTable, file as fileTable, mediaPreview } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { isLikelyImageFile } from '@/lib/task-thumbnail';
import { generateThumbnailForVideoKey } from '@/lib/media-preview-generator';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && process.env.CRON_SECRET) {
    if (authHeader.slice(7) === process.env.CRON_SECRET) return true;
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

const CONCURRENCY = 3;

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDbHttp();

  // 1. Fetch all READY_FOR_QC tasks
  const qcTasks = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      status: taskTable.status,
    })
    .from(taskTable)
    .where(eq(taskTable.status, 'READY_FOR_QC'));

  if (qcTasks.length === 0) {
    return NextResponse.json({
      tasksChecked: 0,
      alreadyHasManualThumbnail: 0,
      alreadyHasReadyPreview: 0,
      noVideoFound: 0,
      queued: 0,
      successCount: 0,
      failCount: 0,
      failures: [],
    });
  }

  const taskIds = qcTasks.map((t) => t.id);

  // 2. Fetch all active files for these tasks
  const files = await db
    .select({
      id: fileTable.id,
      taskId: fileTable.taskId,
      name: fileTable.name,
      folderType: fileTable.folderType,
      mimeType: fileTable.mimeType,
      s3Key: fileTable.s3Key,
      url: fileTable.url,
      isActive: fileTable.isActive,
      uploadedAt: fileTable.uploadedAt,
      createdAt: fileTable.createdAt,
    })
    .from(fileTable)
    .where(and(inArray(fileTable.taskId, taskIds), eq(fileTable.isActive, true)));

  // 3. Fetch existing media previews
  const existingPreviews = await db
    .select({
      s3Key: mediaPreview.s3Key,
      previewS3Key: mediaPreview.previewS3Key,
      status: mediaPreview.status,
    })
    .from(mediaPreview);

  const readyPreviewsMap = new Map(
    existingPreviews
      .filter((p) => p.status === 'READY' && p.previewS3Key)
      .map((p) => [p.s3Key, p.previewS3Key])
  );

  // Group files by taskId
  const filesByTask = new Map<string, typeof files>();
  for (const f of files) {
    if (!f.taskId) continue;
    const list = filesByTask.get(f.taskId) || [];
    list.push(f);
    filesByTask.set(f.taskId, list);
  }

  // 4. Identify tasks needing thumbnail generation
  const queue: Array<{
    task: (typeof qcTasks)[0];
    videoFile: (typeof files)[0];
  }> = [];

  let alreadyHasManualThumbnail = 0;
  let alreadyHasReadyPreview = 0;
  let noVideoFound = 0;

  for (const task of qcTasks) {
    const taskFiles = filesByTask.get(task.id) || [];

    const hasManualThumbnail = taskFiles.some(
      (f) =>
        f.isActive !== false &&
        (f.folderType === 'thumbnails' || isLikelyImageFile(f)) &&
        (f.url || f.s3Key)
    );

    if (hasManualThumbnail) {
      alreadyHasManualThumbnail++;
      continue;
    }

    const newestFirst = [...taskFiles].sort((a, b) => {
      const aTime = new Date(a.uploadedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.uploadedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    const videoFile = newestFirst.find(
      (f) =>
        f.isActive !== false &&
        (f.mimeType?.startsWith('video/') ||
          f.folderType === 'main' ||
          /\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(f.name || '')) &&
        !!f.s3Key
    );

    if (!videoFile || !videoFile.s3Key) {
      noVideoFound++;
      continue;
    }

    if (readyPreviewsMap.has(videoFile.s3Key)) {
      alreadyHasReadyPreview++;
      continue;
    }

    queue.push({ task, videoFile });
  }

  // 5. Process queue with concurrency
  let successCount = 0;
  let failCount = 0;
  const failures: Array<{ taskId: string; taskTitle: string | null; error: string }> = [];

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ task, videoFile }) => {
        try {
          const result = await generateThumbnailForVideoKey(videoFile.s3Key!, task.id, videoFile.id);
          if (result.status === 'READY') {
            successCount++;
          } else {
            failCount++;
            failures.push({ taskId: task.id, taskTitle: task.title, error: result.error ?? 'unknown error' });
          }
        } catch (err: any) {
          failCount++;
          failures.push({ taskId: task.id, taskTitle: task.title, error: err?.message ?? String(err) });
        }
      })
    );
  }

  return NextResponse.json({
    tasksChecked: qcTasks.length,
    alreadyHasManualThumbnail,
    alreadyHasReadyPreview,
    noVideoFound,
    queued: queue.length,
    successCount,
    failCount,
    failures,
  });
}

// Allow GET too, since some external cron schedulers (e.g. cron-job.org's
// free tier) default to GET requests.
export const GET = POST;