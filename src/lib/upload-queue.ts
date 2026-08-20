// src/lib/upload-queue.ts
// Simple job queue using Upstash Redis — no extra infrastructure needed.
// upload/complete pushes a job, upload-worker processes it in the background.

import { Redis } from '@upstash/redis';
import { sendBatchUploadNotification } from '@/lib/upload-notifications';

const QUEUE_KEY = 'upload:jobs:pending';
const PROCESSING_KEY = 'upload:jobs:processing';
const FAILED_KEY = 'upload:jobs:failed';
const MAX_ATTEMPTS = 3;

export interface UploadJob {
  id: string;
  createdAt: string;
  attempts: number;

  // Everything needed to do the background work
  key: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  taskId: string;
  subfolder: string;
  codec?: string | null;
  userId: number;
  userRole: string;

  // Drive mirror
  driveFolderId?: string | null;
  clientName?: string | null;
  requiresClientReview?: boolean;
  clientId?: string | null;

  // Drive upload flag
  isDriveUpload?: boolean;

  // Set by upload/complete after DB write — worker skips file creation if present
  fileRecordId?: string | null;

  // Admin-selected editors to tag in Slack upload notification (raw footage uploads).
  // null/omitted = fall back to auto-tagging all editors with an active task for the client.
  taggedEditorIds?: string[] | null;

  // Set when this file was part of a multi-file selection (2+ files picked in
  // one dialog session). All files sharing a batchId are grouped into a single
  // Slack notification once batchTotal of them have been recorded — see
  // recordBatchFile() below. null/omitted = notify immediately, as before.
  batchId?: string | null;
  batchTotal?: number | null;
}

// ── Batch notification tracking ─────────────────────────────────────────
// One Slack notification per multi-file upload batch instead of one per file.
// Tracked in Redis (not the job queue) since the worker processes jobs from
// a batch across several ticks — this survives across those ticks and across
// worker restarts. TTL is a safety net: if a batch never reaches its total
// (e.g. a stuck job that never fails or retries forever), it won't hang
// around indefinitely.
const BATCH_KEY_PREFIX = 'upload:batch:';
const BATCH_TTL_SECONDS = 2 * 60 * 60; // 2h

export interface BatchProgress {
  total: number;
  filesRecorded: number;
  totalSize: number;
  // Context needed to send the eventual aggregated notification — same shape
  // as a single UploadNotificationParams, captured from the first file seen.
  uploadedBy: number;
  clientId?: string | null;
  taskId?: string;
  folderType?: string;
  s3Key?: string;
  taggedEditorIds?: string[] | null;
  isDriveUpload?: boolean;
}

// Atomically record one file's completion (or permanent failure) against its
// batch. Returns the updated progress and isComplete — the caller that gets
// isComplete:true back is the one responsible for sending the single
// aggregated notification (this function itself never sends anything).
export async function recordBatchFile(
  batchId: string,
  total: number,
  fileSize: number,
  ctx: {
    uploadedBy: number;
    clientId?: string | null;
    taskId?: string;
    folderType?: string;
    s3Key?: string;
    taggedEditorIds?: string[] | null;
    isDriveUpload?: boolean;
  },
): Promise<{ progress: BatchProgress; isComplete: boolean }> {
  const key = `${BATCH_KEY_PREFIX}${batchId}`;
  const redis = getRedis();

  const existingRaw = await redis.get(key);
  const existing: BatchProgress | null = existingRaw
    ? (typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw as BatchProgress)
    : null;

  const progress: BatchProgress = existing ?? {
    total,
    filesRecorded: 0,
    totalSize: 0,
    ...ctx,
  };

  progress.filesRecorded += 1;
  progress.totalSize += fileSize;

  const isComplete = progress.filesRecorded >= progress.total;

  if (isComplete) {
    await redis.del(key);
  } else {
    await redis.set(key, JSON.stringify(progress), { ex: BATCH_TTL_SECONDS });
  }

  return { progress, isComplete };
}

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

export async function pushUploadJob(job: Omit<UploadJob, 'id' | 'createdAt' | 'attempts'>): Promise<string> {
  const fullJob: UploadJob = {
    ...job,
    id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await getRedis().lpush(QUEUE_KEY, JSON.stringify(fullJob));
  console.log(`[UploadQueue] Pushed job ${fullJob.id} for ${fullJob.fileName}`);
  return fullJob.id;
}

export async function popUploadJob(): Promise<UploadJob | null> {
  const data = await getRedis().rpop(QUEUE_KEY);
  if (!data) return null;
  const job: UploadJob = typeof data === 'string' ? JSON.parse(data) : data as UploadJob;
  // Move to processing list so we can recover if worker crashes
  job.attempts += 1;
  await getRedis().lpush(PROCESSING_KEY, JSON.stringify(job));
  return job;
}

export async function ackUploadJob(jobId: string): Promise<void> {
  // Remove from processing list
  const jobs = await getRedis().lrange(PROCESSING_KEY, 0, -1);
  for (const item of jobs) {
    const job: UploadJob = typeof item === 'string' ? JSON.parse(item) : item as UploadJob;
    if (job.id === jobId) {
      await getRedis().lrem(PROCESSING_KEY, 1, item);
      console.log(`[UploadQueue] Acked job ${jobId}`);
      return;
    }
  }
}

export async function failUploadJob(job: UploadJob, error: string): Promise<void> {
  await getRedis().lrem(PROCESSING_KEY, 1, JSON.stringify(job));

  if (job.attempts < MAX_ATTEMPTS) {
    // Re-queue for retry
    console.warn(`[UploadQueue] Job ${job.id} failed (attempt ${job.attempts}/${MAX_ATTEMPTS}), re-queuing: ${error}`);
    await getRedis().lpush(QUEUE_KEY, JSON.stringify(job));
  } else {
    // Give up — move to failed list for inspection
    console.error(`[UploadQueue] Job ${job.id} failed permanently after ${MAX_ATTEMPTS} attempts: ${error}`);
    const failedJob = { ...job, error, failedAt: new Date().toISOString() };
    await getRedis().lpush(FAILED_KEY, JSON.stringify(failedJob));
    await getRedis().ltrim(FAILED_KEY, 0, 99); // keep last 100 failed jobs

    // Still count this file toward its batch (as 0 bytes) so a permanently
    // failed file doesn't leave the rest of the batch's notification stuck
    // waiting for a file that will never complete.
    if (job.batchId && job.batchTotal) {
      try {
        const { progress, isComplete } = await recordBatchFile(job.batchId, job.batchTotal, 0, {
          uploadedBy: job.userId,
          clientId: job.clientId,
          taskId: job.taskId,
          folderType: job.subfolder,
          s3Key: job.key,
          taggedEditorIds: job.taggedEditorIds,
          isDriveUpload: job.isDriveUpload,
        });
        if (isComplete) {
          await sendBatchUploadNotification({
            fileCount: progress.total,
            totalSize: progress.totalSize,
            uploadedBy: progress.uploadedBy,
            clientId: progress.clientId,
            taskId: progress.taskId,
            folderType: progress.folderType,
            s3Key: progress.s3Key,
            taggedEditorIds: progress.taggedEditorIds,
          });
        }
      } catch (err) {
        console.error('[UploadQueue] recordBatchFile (failure path) error:', err);
      }
    }
  }
}

export async function getQueueStats(): Promise<{ pending: number; processing: number; failed: number }> {
  const [pending, processing, failed] = await Promise.all([
    getRedis().llen(QUEUE_KEY),
    getRedis().llen(PROCESSING_KEY),
    getRedis().llen(FAILED_KEY),
  ]);
  return { pending, processing, failed };
}

// Recovery: on startup, move any stuck processing jobs back to pending
export async function recoverStuckJobs(): Promise<number> {
  const jobs = await getRedis().lrange(PROCESSING_KEY, 0, -1);
  let recovered = 0;
  for (const item of jobs) {
    const job: UploadJob = typeof item === 'string' ? JSON.parse(item) : item as UploadJob;
    // If job has been processing for more than 10 minutes, it's stuck
    const ageMs = Date.now() - new Date(job.createdAt).getTime();
    if (ageMs > 10 * 60 * 1000) {
      await getRedis().lrem(PROCESSING_KEY, 1, item);
      if (job.attempts < MAX_ATTEMPTS) {
        await getRedis().lpush(QUEUE_KEY, JSON.stringify(job));
        recovered++;
      }
    }
  }
  if (recovered > 0) {
    console.log(`[UploadQueue] Recovered ${recovered} stuck jobs`);
  }
  return recovered;
}