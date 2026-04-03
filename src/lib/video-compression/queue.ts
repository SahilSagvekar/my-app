// Video Compression Queue Management
import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_KEYS, CompressionJob, JobStatus, COMPRESSION_CONFIG } from './config';

// Get Redis client
let redis: Redis | null = null;

const getClient = (): Redis => {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
};

/**
 * Safely parse job data - Upstash auto-parses JSON, so handle both cases
 */
function parseJob(data: unknown): CompressionJob {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  return data as CompressionJob;
}

/**
 * Add a video to the compression queue
 */
export async function addToQueue(params: {
  videoKey: string;
  sizeBytes: number;
  clientId?: string;
  taskId?: string;
}): Promise<CompressionJob> {
  const client = getClient();
  
  const job: CompressionJob = {
    id: uuidv4(),
    videoKey: params.videoKey,
    outputKey: params.videoKey.replace(/^uploads\//, COMPRESSION_CONFIG.r2.compressedPrefix),
    sizeBytes: params.sizeBytes,
    status: 'pending',
    progress: 0,
    processor: null,
    attempts: 0,
    createdAt: new Date().toISOString(),
    clientId: params.clientId,
    taskId: params.taskId,
  };

  // Add to queue
  await client.lpush(REDIS_KEYS.queue, JSON.stringify(job));
  
  console.log(`[Queue] Added job ${job.id} for ${job.videoKey} (${(job.sizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB)`);
  
  return job;
}

/**
 * Get next job from queue
 */
export async function getNextJob(): Promise<CompressionJob | null> {
  const client = getClient();
  
  // Upstash doesn't have rpoplpush, so we do it manually
  const jobData = await client.rpop(REDIS_KEYS.queue);
  
  if (!jobData) return null;
  
  const job = parseJob(jobData);
  job.status = 'processing';
  job.startedAt = new Date().toISOString();
  
  // Add to processing list
  await client.lpush(REDIS_KEYS.processing, JSON.stringify(job));
  
  return job;
}

/**
 * Update job status
 */
export async function updateJob(jobId: string, updates: Partial<CompressionJob>): Promise<void> {
  const client = getClient();
  
  // Check in processing list
  const processingJobs = await client.lrange(REDIS_KEYS.processing, 0, -1);
  
  for (let i = 0; i < processingJobs.length; i++) {
    const job = parseJob(processingJobs[i]);
    if (job.id === jobId) {
      const updatedJob = { ...job, ...updates };
      await client.lset(REDIS_KEYS.processing, i, JSON.stringify(updatedJob));
      return;
    }
  }
}

/**
 * Complete a job successfully
 */
export async function completeJob(jobId: string): Promise<void> {
  const client = getClient();
  
  const job = await removeFromProcessing(jobId);
  if (!job) return;
  
  job.status = 'completed';
  job.progress = 100;
  job.completedAt = new Date().toISOString();
  
  // Add to completed list (keep last 1000)
  await client.lpush(REDIS_KEYS.completed, JSON.stringify(job));
  await client.ltrim(REDIS_KEYS.completed, 0, 999);
  
  // Update stats
  await incrementStats('completed', job.sizeBytes);
  
  console.log(`[Queue] Job ${jobId} completed`);
}

/**
 * Fail a job
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  const client = getClient();
  
  const job = await removeFromProcessing(jobId);
  if (!job) return;
  
  job.attempts += 1;
  job.error = error;
  
  if (job.attempts < COMPRESSION_CONFIG.queue.retryAttempts) {
    // Retry - put back in queue
    job.status = 'pending';
    job.processor = null;
    await client.lpush(REDIS_KEYS.queue, JSON.stringify(job));
    console.log(`[Queue] Job ${jobId} failed, retrying (attempt ${job.attempts})`);
  } else {
    // Max retries reached
    job.status = 'failed';
    await client.lpush(REDIS_KEYS.failed, JSON.stringify(job));
    await client.ltrim(REDIS_KEYS.failed, 0, 999);
    await incrementStats('failed', job.sizeBytes);
    console.log(`[Queue] Job ${jobId} failed permanently: ${error}`);
  }
}

/**
 * Mark job as interrupted (spot instance terminated)
 */
export async function interruptJob(jobId: string): Promise<void> {
  const client = getClient();
  
  const job = await removeFromProcessing(jobId);
  if (!job) return;
  
  job.status = 'pending';
  job.processor = null;
  job.error = 'Spot instance interrupted';
  
  // Put back at front of queue for immediate retry
  await client.rpush(REDIS_KEYS.queue, JSON.stringify(job));
  
  console.log(`[Queue] Job ${jobId} interrupted, re-queued`);
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  pendingSizeGB: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const client = getClient();
  
  const [pendingJobs, processingCount, completedCount, failedCount] = await Promise.all([
    client.lrange(REDIS_KEYS.queue, 0, -1),
    client.llen(REDIS_KEYS.processing),
    client.llen(REDIS_KEYS.completed),
    client.llen(REDIS_KEYS.failed),
  ]);
  
  const pendingSizeBytes = pendingJobs.reduce((sum, jobData) => {
    const job = parseJob(jobData);
    return sum + (job.sizeBytes || 0);
  }, 0);
  
  return {
    pending: pendingJobs.length,
    pendingSizeGB: pendingSizeBytes / 1024 / 1024 / 1024,
    processing: processingCount,
    completed: completedCount,
    failed: failedCount,
  };
}

/**
 * Get all pending jobs
 */
export async function getPendingJobs(): Promise<CompressionJob[]> {
  const client = getClient();
  const jobs = await client.lrange(REDIS_KEYS.queue, 0, -1);
  return jobs.map(j => parseJob(j));
}

/**
 * Get processing jobs
 */
export async function getProcessingJobs(): Promise<CompressionJob[]> {
  const client = getClient();
  const jobs = await client.lrange(REDIS_KEYS.processing, 0, -1);
  return jobs.map(j => parseJob(j));
}

/**
 * Check if should start spot instance
 */
export async function shouldStartSpot(): Promise<boolean> {
  const stats = await getQueueStats();
  
  return (
    stats.pending >= COMPRESSION_CONFIG.thresholds.minJobsToStartSpot ||
    stats.pendingSizeGB >= COMPRESSION_CONFIG.thresholds.minSizeGBToStartSpot
  );
}

// ─── Helper Functions ─────────────────────────────────────────

async function removeFromProcessing(jobId: string): Promise<CompressionJob | null> {
  const client = getClient();
  
  const processingJobs = await client.lrange(REDIS_KEYS.processing, 0, -1);
  
  for (let i = 0; i < processingJobs.length; i++) {
    const job = parseJob(processingJobs[i]);
    if (job.id === jobId) {
      // Need to stringify for lrem comparison
      const originalStr = typeof processingJobs[i] === 'string' 
        ? processingJobs[i] 
        : JSON.stringify(processingJobs[i]);
      await client.lrem(REDIS_KEYS.processing, 1, originalStr);
      return job;
    }
  }
  
  return null;
}

async function updateJobInList(listKey: string, job: CompressionJob): Promise<void> {
  const client = getClient();
  
  const jobs = await client.lrange(listKey, 0, -1);
  
  for (let i = 0; i < jobs.length; i++) {
    const existing = parseJob(jobs[i]);
    if (existing.id === job.id) {
      await client.lset(listKey, i, JSON.stringify(job));
      return;
    }
  }
}

async function incrementStats(type: 'completed' | 'failed', sizeBytes: number): Promise<void> {
  const client = getClient();
  const today = new Date().toISOString().split('T')[0];
  
  await client.hincrby(`${REDIS_KEYS.stats}:${today}`, `${type}Count`, 1);
  await client.hincrby(`${REDIS_KEYS.stats}:${today}`, `${type}Bytes`, sizeBytes);
}

// ─── Budget Tracking ─────────────────────────────────────────

export async function getBudgetUsed(): Promise<number> {
  const client = getClient();
  
  // Check if we need to reset (new month)
  const resetDate = await client.get(REDIS_KEYS.budgetResetDate) as string | null;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  if (resetDate !== currentMonth) {
    await client.set(REDIS_KEYS.budgetUsed, '0');
    await client.set(REDIS_KEYS.budgetResetDate, currentMonth);
    return 0;
  }
  
  const used = await client.get(REDIS_KEYS.budgetUsed) as string | null;
  return parseFloat(used || '0');
}

export async function addToBudget(amountUSD: number): Promise<void> {
  const client = getClient();
  await client.incrbyfloat(REDIS_KEYS.budgetUsed, amountUSD);
}

export async function isBudgetExhausted(): Promise<boolean> {
  const used = await getBudgetUsed();
  return used >= COMPRESSION_CONFIG.budget.monthlyLimitUSD;
}

export async function getBudgetRemaining(): Promise<number> {
  const used = await getBudgetUsed();
  return Math.max(0, COMPRESSION_CONFIG.budget.monthlyLimitUSD - used);
}