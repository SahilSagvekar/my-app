// src/lib/upload-queue.ts
// Simple job queue using Upstash Redis — no extra infrastructure needed.
// upload/complete pushes a job, upload-worker processes it in the background.

import { Redis } from '@upstash/redis';

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