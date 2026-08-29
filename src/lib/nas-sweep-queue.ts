// src/lib/nas-sweep-queue.ts
// Job queue for the weekly R2 -> NAS backup sweep. One job per file, same
// Redis-backed pattern as upload-queue.ts. This is copy-only — it does NOT
// touch or delete anything in R2 (unlike the older nas-mirror-worker.ts,
// which was a combined copy+verify+delete tool for a different, on-demand
// workflow). A completed job just marks the file as archived in Postgres.
//
// Populated weekly by /api/cron/nas-weekly-sweep, drained continuously by
// the every-minute Cron Trigger tick (see /api/cron/tick-queues and
// worker.ts) via nas-sweep-worker.ts.

import { Redis } from '@upstash/redis';
import { createId } from '@/lib/db/id';
import { sendNasSweepCompleteNotification } from '@/lib/nas-sweep-notifications';

const QUEUE_KEY = 'nas-sweep:jobs:pending';
const PROCESSING_KEY = 'nas-sweep:jobs:processing';
const FAILED_KEY = 'nas-sweep:jobs:failed';
const BATCH_KEY_PREFIX = 'nas-sweep:batch:';
const BATCH_TTL_SECONDS = 7 * 24 * 60 * 60; // 1 week — generous, a sweep should finish in hours not days
const MAX_ATTEMPTS = 3;
const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 min — video files can be large

export interface NasSweepJob {
  id: string;
  createdAt: string;
  attempts: number;

  // Exactly one of these is set, depending on folderType — the worker
  // updates whichever table backs that category's "backed up" status.
  fileId?: string;            // 'outputs' jobs — updates File.archivedToNas
  backupRecordId?: string;    // 'raw-footage'/'elements' jobs — updates NasBackupRecord.archivedToNas

  s3Key: string;
  fileName: string;
  fileSize: number;
  destPath: string; // relative path under the NAS shared folder

  // Batch this job belongs to — used to send one Slack summary once the
  // whole Saturday sweep finishes, same pattern as upload batch notifications.
  batchId: string;
  batchTotal: number;
}

export interface NasSweepBatchProgress {
  total: number;
  filesProcessed: number;
  filesCopied: number;
  filesFailed: number;
  totalSize: number;
  startedAt: string;
}

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

export async function pushNasSweepJob(job: Omit<NasSweepJob, 'id' | 'createdAt' | 'attempts'>): Promise<string> {
  const id = createId();
  const fullJob: NasSweepJob = { ...job, id, createdAt: new Date().toISOString(), attempts: 0 };
  await getRedis().lpush(QUEUE_KEY, JSON.stringify(fullJob));
  return id;
}

export async function popNasSweepJob(): Promise<NasSweepJob | null> {
  const data = await getRedis().rpop(QUEUE_KEY);
  if (!data) return null;
  const job: NasSweepJob = typeof data === 'string' ? JSON.parse(data) : (data as NasSweepJob);
  job.attempts += 1;
  await getRedis().lpush(PROCESSING_KEY, JSON.stringify(job));
  return job;
}

export async function ackNasSweepJob(jobId: string): Promise<void> {
  const redis = getRedis();
  const all = await redis.lrange(PROCESSING_KEY, 0, -1);
  for (const raw of all) {
    const job: NasSweepJob = typeof raw === 'string' ? JSON.parse(raw) : (raw as NasSweepJob);
    if (job.id === jobId) {
      await redis.lrem(PROCESSING_KEY, 1, raw as string);
      break;
    }
  }
}

export async function failNasSweepJob(job: NasSweepJob, error: string): Promise<void> {
  const redis = getRedis();
  const all = await redis.lrange(PROCESSING_KEY, 0, -1);
  for (const raw of all) {
    const j: NasSweepJob = typeof raw === 'string' ? JSON.parse(raw) : (raw as NasSweepJob);
    if (j.id === job.id) {
      await redis.lrem(PROCESSING_KEY, 1, raw as string);
      break;
    }
  }

  if (job.attempts < MAX_ATTEMPTS) {
    await redis.lpush(QUEUE_KEY, JSON.stringify(job)); // retry
    return;
  }

  console.error(`[NasSweepQueue] Job ${job.id} (${job.s3Key}) failed permanently after ${MAX_ATTEMPTS} attempts: ${error}`);
  const failedJob = { ...job, error, failedAt: new Date().toISOString() };
  await redis.lpush(FAILED_KEY, JSON.stringify(failedJob));
  await redis.ltrim(FAILED_KEY, 0, 99);

  // Still count this file toward the batch (as failed) so one bad file
  // doesn't leave the sweep's completion notification stuck forever.
  await recordSweepFile(job, { failed: true });
}

export async function recoverStuckNasSweepJobs(): Promise<number> {
  const redis = getRedis();
  const all = await redis.lrange(PROCESSING_KEY, 0, -1);
  let recovered = 0;
  for (const raw of all) {
    const job: NasSweepJob = typeof raw === 'string' ? JSON.parse(raw) : (raw as NasSweepJob);
    const age = Date.now() - new Date(job.createdAt).getTime();
    if (age > STUCK_THRESHOLD_MS) {
      await redis.lrem(PROCESSING_KEY, 1, raw as string);
      await redis.lpush(QUEUE_KEY, JSON.stringify(job));
      recovered++;
    }
  }
  return recovered;
}

// Create a new batch record when the weekly sweep populates the queue.
export async function startNasSweepBatch(batchId: string, total: number): Promise<void> {
  const progress: NasSweepBatchProgress = {
    total,
    filesProcessed: 0,
    filesCopied: 0,
    filesFailed: 0,
    totalSize: 0,
    startedAt: new Date().toISOString(),
  };
  await getRedis().set(`${BATCH_KEY_PREFIX}${batchId}`, JSON.stringify(progress), { ex: BATCH_TTL_SECONDS });
}

// Called by nas-sweep-worker.ts (success path) and failNasSweepJob (failure
// path) after each file. Sends the one summary Slack notification once the
// batch's total is reached.
export async function recordSweepFile(job: NasSweepJob, result: { failed: boolean }): Promise<void> {
  const key = `${BATCH_KEY_PREFIX}${job.batchId}`;
  const redis = getRedis();

  const existingRaw = await redis.get(key);
  if (!existingRaw) {
    console.error(`[NasSweepQueue] No batch record for ${job.batchId} — sweep notification will be skipped for this batch`);
    return;
  }
  const progress: NasSweepBatchProgress = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : (existingRaw as NasSweepBatchProgress);

  progress.filesProcessed += 1;
  if (result.failed) {
    progress.filesFailed += 1;
  } else {
    progress.filesCopied += 1;
    progress.totalSize += job.fileSize;
  }

  const isComplete = progress.filesProcessed >= progress.total;

  if (isComplete) {
    await redis.del(key);
    await sendNasSweepCompleteNotification({
      total: progress.total,
      copied: progress.filesCopied,
      failed: progress.filesFailed,
      totalSize: progress.totalSize,
    });
  } else {
    await redis.set(key, JSON.stringify(progress), { ex: BATCH_TTL_SECONDS });
  }
}

export async function getNasSweepQueueStats(): Promise<{ pending: number; processing: number; failed: number }> {
  const redis = getRedis();
  const [pending, processing, failed] = await Promise.all([
    redis.llen(QUEUE_KEY),
    redis.llen(PROCESSING_KEY),
    redis.llen(FAILED_KEY),
  ]);
  return { pending, processing, failed };
}

// Used by the manual NAS backup admin panel's status polling — the last
// 100 permanently-failed jobs (same cap failNasSweepJob already applies),
// with the actual error message per file rather than just a count.
export async function getRecentFailedNasSweepJobs(): Promise<Array<NasSweepJob & { error: string; failedAt: string }>> {
  const raw = await getRedis().lrange(FAILED_KEY, 0, 99);
  return raw.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
}