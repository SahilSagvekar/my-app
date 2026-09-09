// npx tsx scripts/generate-qc-thumbnails.ts

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { getDbHttp } from '../src/lib/db';
import { task as taskTable, file as fileTable, mediaPreview } from '../src/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { isLikelyImageFile } from '../src/lib/task-thumbnail';
import { generateThumbnailForVideoKey } from '../src/lib/media-preview-generator';

async function main() {
  console.log('🚀 Starting Thumbnail Generation for CLIENT_REVIEW tasks...\n');
  const db = getDbHttp();

  // 1. Fetch all CLIENT_REVIEW tasks
  const qcTasks = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      status: taskTable.status,
    })
    .from(taskTable)
    .where(eq(taskTable.status, 'CLIENT_REVIEW'));

  console.log(`📋 Found ${qcTasks.length} tasks in CLIENT_REVIEW status.`);

  if (qcTasks.length === 0) {
    console.log('No tasks in CLIENT_REVIEW status. Done.');
    process.exit(0);
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
    task: typeof qcTasks[0];
    videoFile: typeof files[0];
  }> = [];

  let alreadyHasManualThumbnail = 0;
  let alreadyHasReadyPreview = 0;
  let noVideoFound = 0;

  for (const task of qcTasks) {
    const taskFiles = filesByTask.get(task.id) || [];

    // Check if task has a manual image thumbnail
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

    // Find newest active video file
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

  console.log(`\n📊 Breakdown:`);
  console.log(`  - Already have manual thumbnail: ${alreadyHasManualThumbnail}`);
  console.log(`  - Already have generated preview: ${alreadyHasReadyPreview}`);
  console.log(`  - No video files attached: ${noVideoFound}`);
  console.log(`  - Queued for thumbnail generation: ${queue.length}\n`);

  if (queue.length === 0) {
    console.log('✅ All CLIENT_REVIEW tasks already have thumbnails or previews!');
    process.exit(0);
  }

  // 5. Process queue with concurrency
  const CONCURRENCY = 3;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ task, videoFile }, idx) => {
        const itemIndex = i + idx + 1;
        console.log(`[${itemIndex}/${queue.length}] Generating for Task "${task.title || task.id}" (File: ${videoFile.name || videoFile.s3Key})...`);
        const result = await generateThumbnailForVideoKey(videoFile.s3Key!, task.id, videoFile.id);
        if (result.status === 'READY') {
          console.log(`  ✅ [${itemIndex}/${queue.length}] Success: ${result.previewS3Key} (${result.width}x${result.height}, ${result.durationSeconds.toFixed(1)}s)`);
          successCount++;
        } else {
          console.error(`  ❌ [${itemIndex}/${queue.length}] Failed: ${result.error}`);
          failCount++;
        }
      })
    );
  }

  console.log(`\n🎉 Completed thumbnail generation!`);
  console.log(`  - Successfully generated: ${successCount}`);
  console.log(`  - Failed: ${failCount}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
