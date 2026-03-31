// Main Compression Worker - Runs on t3.large
// Monitors queue, manages spot instance, processes fallback jobs

import { 
  addToQueue,
  getNextJob, 
  completeJob, 
  failJob, 
  getQueueStats, 
  shouldStartSpot,
  updateJob,
  isBudgetExhausted,
  getBudgetRemaining,
  getProcessingJobs,
} from './queue';
import { 
  getSpotStatus, 
  startSpotInstance, 
  stopSpotInstance,
  verifySpotInstance,
} from './spot-manager';
import { compressVideo, checkFfmpeg } from './ffmpeg';
import { COMPRESSION_CONFIG, CompressionJob } from './config';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';

// R2 Client
const r2 = new S3Client({
  region: 'auto',
  endpoint: COMPRESSION_CONFIG.r2.endpoint,
  credentials: {
    accessKeyId: COMPRESSION_CONFIG.r2.accessKeyId,
    secretAccessKey: COMPRESSION_CONFIG.r2.secretAccessKey,
  },
});

const WORK_DIR = '/tmp/video-compression';

let isRunning = false;
let currentJob: CompressionJob | null = null;

/**
 * Initialize the worker
 */
export async function initWorker(): Promise<void> {
  // Check FFmpeg
  const ffmpegAvailable = await checkFfmpeg();
  if (!ffmpegAvailable) {
    console.error('[Worker] FFmpeg not found! Please install FFmpeg.');
    return;
  }
  
  // Create work directory
  await fs.mkdir(WORK_DIR, { recursive: true });
  
  console.log('[Worker] Initialized');
}

/**
 * Start the worker loop
 */
export async function startWorker(): Promise<void> {
  if (isRunning) {
    console.log('[Worker] Already running');
    return;
  }
  
  isRunning = true;
  console.log('[Worker] Starting main loop...');
  
  await initWorker();
  
  while (isRunning) {
    try {
      await workerTick();
    } catch (error) {
      console.error('[Worker] Error in tick:', error);
    }
    
    // Wait before next check
    await sleep(COMPRESSION_CONFIG.queue.checkIntervalMs);
  }
  
  console.log('[Worker] Stopped');
}

/**
 * Stop the worker
 */
export function stopWorker(): void {
  isRunning = false;
}

/**
 * Single worker tick
 */
async function workerTick(): Promise<void> {
  const stats = await getQueueStats();
  const spotStatus = await getSpotStatus();
  const budgetRemaining = await getBudgetRemaining();
  
  console.log(`[Worker] Queue: ${stats.pending} pending (${stats.pendingSizeGB.toFixed(2)} GB), Spot: ${spotStatus.status}, Budget: $${budgetRemaining.toFixed(2)} remaining`);
  
  // Check if we should start spot
  if (spotStatus.status === 'stopped' && stats.pending > 0) {
    const shouldStart = await shouldStartSpot();
    const budgetOk = !await isBudgetExhausted();
    
    if (shouldStart && budgetOk) {
      console.log('[Worker] Starting spot instance...');
      const result = await startSpotInstance();
      
      if (!result.success) {
        console.log(`[Worker] Failed to start spot: ${result.error}`);
        // Will process locally
      }
    }
  }
  
  // Verify spot is still running
  if (spotStatus.status === 'running') {
    const isAlive = await verifySpotInstance();
    
    if (!isAlive) {
      console.log('[Worker] Spot instance died, re-queueing any processing jobs');
      await handleSpotDeath();
    }
  }
  
  // If spot is running, let it handle jobs
  if (spotStatus.status === 'running') {
    return;
  }
  
  // Fallback: process locally on t3.large
  if (stats.pending > 0) {
    console.log('[Worker] Processing locally (fallback)...');
    await processNextJobLocally();
  }
}

/**
 * Process a job locally on t3.large
 */
async function processNextJobLocally(): Promise<void> {
  const job = await getNextJob();
  
  if (!job) {
    return;
  }
  
  currentJob = job;
  
  const inputPath = path.join(WORK_DIR, `input_${job.id}.mp4`);
  const outputPath = path.join(WORK_DIR, `output_${job.id}.mp4`);
  
  try {
    console.log(`[Worker] Processing job ${job.id}: ${job.videoKey}`);
    
    // Update job
    await updateJob(job.id, { processor: 'local' });
    
    // Download from R2
    console.log('[Worker] Downloading from R2...');
    await downloadFromR2(job.videoKey, inputPath);
    await updateJob(job.id, { progress: 10 });
    
    // Compress
    console.log('[Worker] Compressing...');
    const result = await compressVideo(inputPath, outputPath, async (progress) => {
      const adjustedProgress = 10 + Math.round(progress.percent * 0.8);
      await updateJob(job.id, { progress: adjustedProgress });
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Compression failed');
    }
    
    // Upload to R2
    console.log('[Worker] Uploading to R2...');
    await uploadToR2(outputPath, job.outputKey);
    await updateJob(job.id, { progress: 95 });
    
    // Complete
    await completeJob(job.id);
    console.log(`[Worker] Job ${job.id} completed`);
    
  } catch (error: any) {
    console.error(`[Worker] Job ${job.id} failed:`, error.message);
    await failJob(job.id, error.message);
  } finally {
    currentJob = null;
    
    // Cleanup
    await cleanupFile(inputPath);
    await cleanupFile(outputPath);
  }
}

/**
 * Handle spot instance death - re-queue any jobs it was processing
 */
async function handleSpotDeath(): Promise<void> {
  const processingJobs = await getProcessingJobs();
  
  for (const job of processingJobs) {
    if (job.processor === 'spot') {
      console.log(`[Worker] Re-queueing interrupted job: ${job.id}`);
      // The queue module will handle re-adding to queue
      await failJob(job.id, 'Spot instance terminated');
    }
  }
}

/**
 * Download file from R2
 */
async function downloadFromR2(key: string, localPath: string): Promise<void> {
  const response = await r2.send(new GetObjectCommand({
    Bucket: COMPRESSION_CONFIG.r2.bucket,
    Key: key,
  }));
  
  if (!response.Body) {
    throw new Error('Empty response from R2');
  }
  
  const writeStream = (await import('fs')).createWriteStream(localPath);
  
  await new Promise<void>((resolve, reject) => {
    (response.Body as Readable).pipe(writeStream);
    (response.Body as Readable).on('error', reject);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

/**
 * Upload file to R2
 */
async function uploadToR2(localPath: string, key: string): Promise<void> {
  const fileStream = (await import('fs')).createReadStream(localPath);
  const stats = await fs.stat(localPath);
  
  await r2.send(new PutObjectCommand({
    Bucket: COMPRESSION_CONFIG.r2.bucket,
    Key: key,
    Body: fileStream,
    ContentLength: stats.size,
    ContentType: 'video/mp4',
  }));
}

/**
 * Cleanup temp file
 */
async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (e) {
    // Ignore
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Add a video to the compression queue
 */
export async function queueVideoForCompression(params: {
  videoKey: string;
  sizeBytes: number;
  clientId?: string;
  taskId?: string;
}): Promise<CompressionJob> {
  return addToQueue(params);
}

/**
 * Get compression status
 */
export async function getCompressionStatus(): Promise<{
  queue: {
    pending: number;
    pendingSizeGB: number;
    processing: number;
    completed: number;
    failed: number;
  };
  spot: {
    status: string;
    instanceId?: string;
  };
  budget: {
    used: number;
    remaining: number;
    limit: number;
  };
  worker: {
    running: boolean;
    currentJob: string | null;
  };
}> {
  const [queueStats, spotStatus, budgetRemaining] = await Promise.all([
    getQueueStats(),
    getSpotStatus(),
    getBudgetRemaining(),
  ]);
  
  const budgetUsed = COMPRESSION_CONFIG.budget.monthlyLimitUSD - budgetRemaining;
  
  return {
    queue: queueStats,
    spot: {
      status: spotStatus.status,
      instanceId: spotStatus.instanceId,
    },
    budget: {
      used: budgetUsed,
      remaining: budgetRemaining,
      limit: COMPRESSION_CONFIG.budget.monthlyLimitUSD,
    },
    worker: {
      running: isRunning,
      currentJob: currentJob?.id || null,
    },
  };
}

/**
 * Force stop spot instance
 */
export async function forceStopSpot(): Promise<void> {
  await stopSpotInstance();
}

/**
 * Force start spot instance
 */
export async function forceStartSpot(): Promise<{ success: boolean; error?: string }> {
  const result = await startSpotInstance();
  return { success: result.success, error: result.error };
}