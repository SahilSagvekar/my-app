// Spot Instance Manager - Start/Stop c6i.xlarge for compression
import {
  EC2Client,
  RunInstancesCommand,
  TerminateInstancesCommand,
  DescribeInstancesCommand,
  DescribeSpotPriceHistoryCommand,
  CreateTagsCommand,
} from '@aws-sdk/client-ec2';
import { Redis } from '@upstash/redis';
import { COMPRESSION_CONFIG, REDIS_KEYS, SpotStatus } from './config';
import { getBudgetUsed, addToBudget, isBudgetExhausted } from './queue';

// const ec2 = new EC2Client({ region: COMPRESSION_CONFIG.spot.region });
const ec2 = new EC2Client({ 
  region: COMPRESSION_CONFIG.spot.region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_2!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_2!,
  }
});

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
 * Safely parse status data - Upstash auto-parses JSON, so handle both cases
 */
function parseStatus(data: unknown): SpotStatus {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  return data as SpotStatus;
}

/**
 * Get current spot instance status
 */
export async function getSpotStatus(): Promise<SpotStatus> {
  const client = getClient();
  const statusData = await client.get(REDIS_KEYS.spotStatus);
  
  if (!statusData) {
    return { status: 'stopped' };
  }
  
  return parseStatus(statusData);
}

/**
 * Update spot status in Redis
 */
async function setSpotStatus(status: SpotStatus): Promise<void> {
  const client = getClient();
  await client.set(REDIS_KEYS.spotStatus, JSON.stringify(status));
}

/**
 * Get current spot price
 */
export async function getCurrentSpotPrice(): Promise<number> {
  try {
    const response = await ec2.send(new DescribeSpotPriceHistoryCommand({
      InstanceTypes: [COMPRESSION_CONFIG.spot.instanceType],
      ProductDescriptions: ['Linux/UNIX'],
      MaxResults: 1,
    }));
    
    if (response.SpotPriceHistory && response.SpotPriceHistory.length > 0) {
      return parseFloat(response.SpotPriceHistory[0].SpotPrice || '0');
    }
    
    return 0;
  } catch (error) {
    console.error('[SpotManager] Error getting spot price:', error);
    return 0;
  }
}

/**
 * Start a spot instance for compression
 */
export async function startSpotInstance(): Promise<{ success: boolean; instanceId?: string; error?: string }> {
  try {
    // Check budget first
    if (await isBudgetExhausted()) {
      console.log('[SpotManager] Budget exhausted, cannot start spot');
      return { success: false, error: 'Budget exhausted' };
    }
    
    // Check current status
    const currentStatus = await getSpotStatus();
    if (currentStatus.status === 'running' || currentStatus.status === 'starting') {
      console.log('[SpotManager] Spot instance already running/starting');
      return { success: true, instanceId: currentStatus.instanceId };
    }
    
    // Check spot price
    const spotPrice = await getCurrentSpotPrice();
    const maxPrice = parseFloat(COMPRESSION_CONFIG.spot.maxSpotPrice);
    
    if (spotPrice > maxPrice) {
      console.log(`[SpotManager] Spot price too high: $${spotPrice}/hr (max: $${maxPrice}/hr)`);
      return { success: false, error: `Spot price too high: $${spotPrice}/hr` };
    }
    
    // Update status to starting
    await setSpotStatus({ status: 'starting' });
    
    console.log(`[SpotManager] Starting spot instance at $${spotPrice}/hr...`);
    
    // User data script - runs on instance startup
    const userDataScript = `#!/bin/bash
set -e

# Log everything
exec > /var/log/compression-worker.log 2>&1

echo "Starting compression worker..."

# Install dependencies if needed
if ! command -v ffmpeg &> /dev/null; then
  apt-get update
  apt-get install -y ffmpeg
fi

# Install Node.js if needed
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Clone/update the worker script
cd /opt
if [ ! -d "compression-worker" ]; then
  mkdir compression-worker
fi
cd compression-worker

# Create the worker script
cat > worker.js << 'WORKER_SCRIPT'
${getWorkerScript()}
WORKER_SCRIPT

# Install dependencies
npm init -y
npm install @aws-sdk/client-s3 ioredis

# Set environment variables
export REDIS_URL="${process.env.REDIS_URL}"
export R2_ENDPOINT="${COMPRESSION_CONFIG.r2.endpoint}"
export R2_ACCESS_KEY_ID="${COMPRESSION_CONFIG.r2.accessKeyId}"
export R2_SECRET_ACCESS_KEY="${COMPRESSION_CONFIG.r2.secretAccessKey}"
export R2_BUCKET_NAME="${COMPRESSION_CONFIG.r2.bucket}"
export PROCESSOR_TYPE="spot"

# Start the worker
node worker.js
`;

    // Launch spot instance
    const response = await ec2.send(new RunInstancesCommand({
      ImageId: COMPRESSION_CONFIG.spot.amiId,
      InstanceType: COMPRESSION_CONFIG.spot.instanceType,
      MinCount: 1,
      MaxCount: 1,
      KeyName: COMPRESSION_CONFIG.spot.keyName,
      SecurityGroupIds: [COMPRESSION_CONFIG.spot.securityGroupId],
      SubnetId: COMPRESSION_CONFIG.spot.subnetId,
      InstanceMarketOptions: {
        MarketType: 'spot',
        SpotOptions: {
          MaxPrice: COMPRESSION_CONFIG.spot.maxSpotPrice,
          SpotInstanceType: 'one-time',
          InstanceInterruptionBehavior: 'terminate',
        },
      },
      UserData: Buffer.from(userDataScript).toString('base64'),
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: [
            { Key: 'Name', Value: 'E8-Compression-Worker' },
            { Key: 'Purpose', Value: 'video-compression' },
            { Key: 'AutoShutdown', Value: 'true' },
          ],
        },
      ],
    }));
    
    const instanceId = response.Instances?.[0]?.InstanceId;
    
    if (!instanceId) {
      await setSpotStatus({ status: 'stopped' });
      return { success: false, error: 'Failed to get instance ID' };
    }
    
    // Update status
    await setSpotStatus({
      status: 'running',
      instanceId,
      launchedAt: new Date().toISOString(),
    });
    
    console.log(`[SpotManager] Spot instance started: ${instanceId}`);
    
    // Start budget tracking
    startBudgetTracking(instanceId);
    
    return { success: true, instanceId };
    
  } catch (error: any) {
    console.error('[SpotManager] Error starting spot instance:', error);
    await setSpotStatus({ status: 'stopped' });
    return { success: false, error: error.message };
  }
}

/**
 * Stop/terminate the spot instance
 */
export async function stopSpotInstance(): Promise<void> {
  try {
    const status = await getSpotStatus();
    
    if (!status.instanceId || status.status === 'stopped') {
      console.log('[SpotManager] No spot instance to stop');
      return;
    }
    
    await setSpotStatus({ ...status, status: 'stopping' });
    
    console.log(`[SpotManager] Terminating spot instance: ${status.instanceId}`);
    
    await ec2.send(new TerminateInstancesCommand({
      InstanceIds: [status.instanceId],
    }));
    
    await setSpotStatus({ status: 'stopped' });
    
    console.log('[SpotManager] Spot instance terminated');
    
  } catch (error: any) {
    console.error('[SpotManager] Error stopping spot instance:', error);
    // Reset status anyway
    await setSpotStatus({ status: 'stopped' });
  }
}

/**
 * Check if spot instance is actually running
 */
export async function verifySpotInstance(): Promise<boolean> {
  try {
    const status = await getSpotStatus();
    
    if (!status.instanceId) return false;
    
    const response = await ec2.send(new DescribeInstancesCommand({
      InstanceIds: [status.instanceId],
    }));
    
    const instance = response.Reservations?.[0]?.Instances?.[0];
    
    if (!instance) {
      await setSpotStatus({ status: 'stopped' });
      return false;
    }
    
    const state = instance.State?.Name;
    
    if (state === 'running') {
      return true;
    } else if (state === 'terminated' || state === 'shutting-down') {
      await setSpotStatus({ status: 'stopped' });
      return false;
    }
    
    return false;
    
  } catch (error: any) {
    console.error('[SpotManager] Error verifying spot instance:', error);
    return false;
  }
}

/**
 * Track budget usage (runs periodically while spot is active)
 */
let budgetInterval: NodeJS.Timeout | null = null;

function startBudgetTracking(instanceId: string): void {
  if (budgetInterval) {
    clearInterval(budgetInterval);
  }
  
  const spotPrice = parseFloat(COMPRESSION_CONFIG.spot.maxSpotPrice);
  const intervalMs = 60000; // Every minute
  const costPerMinute = spotPrice / 60;
  
  budgetInterval = setInterval(async () => {
    const status = await getSpotStatus();
    
    if (status.status !== 'running' || status.instanceId !== instanceId) {
      if (budgetInterval) {
        clearInterval(budgetInterval);
        budgetInterval = null;
      }
      return;
    }
    
    // Add cost
    await addToBudget(costPerMinute);
    
    // Check if budget exhausted
    if (await isBudgetExhausted()) {
      console.log('[SpotManager] Budget exhausted, stopping spot instance');
      await stopSpotInstance();
    }
    
  }, intervalMs);
}

/**
 * Get the worker script that runs on the spot instance
 */
function getWorkerScript(): string {
  return `
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const Redis = require('ioredis');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const REDIS_URL = process.env.REDIS_URL;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const PROCESSOR_TYPE = process.env.PROCESSOR_TYPE || 'spot';

const redis = new Redis(REDIS_URL);
const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const WORK_DIR = '/tmp/compression';
if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });

// Check for spot interruption (2-min warning)
let interrupted = false;

async function checkSpotInterruption() {
  try {
    const response = await fetch('http://169.254.169.254/latest/meta-data/spot/instance-action', {
      timeout: 1000
    });
    if (response.ok) {
      console.log('SPOT INTERRUPTION WARNING RECEIVED');
      interrupted = true;
    }
  } catch (e) {
    // No interruption
  }
}

setInterval(checkSpotInterruption, 5000);

async function getNextJob() {
  const jobStr = await redis.rpoplpush('video-compression:queue', 'video-compression:processing');
  if (!jobStr) return null;
  
  const job = JSON.parse(jobStr);
  job.status = 'processing';
  job.processor = PROCESSOR_TYPE;
  job.startedAt = new Date().toISOString();
  
  // Update in processing list
  const jobs = await redis.lrange('video-compression:processing', 0, -1);
  for (let i = 0; i < jobs.length; i++) {
    const j = JSON.parse(jobs[i]);
    if (j.id === job.id) {
      await redis.lset('video-compression:processing', i, JSON.stringify(job));
      break;
    }
  }
  
  return job;
}

async function updateProgress(jobId, progress) {
  const jobs = await redis.lrange('video-compression:processing', 0, -1);
  for (let i = 0; i < jobs.length; i++) {
    const job = JSON.parse(jobs[i]);
    if (job.id === jobId) {
      job.progress = progress;
      await redis.lset('video-compression:processing', i, JSON.stringify(job));
      break;
    }
  }
}

async function completeJob(jobId) {
  const jobs = await redis.lrange('video-compression:processing', 0, -1);
  for (let i = 0; i < jobs.length; i++) {
    const job = JSON.parse(jobs[i]);
    if (job.id === jobId) {
      await redis.lrem('video-compression:processing', 1, jobs[i]);
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      await redis.lpush('video-compression:completed', JSON.stringify(job));
      break;
    }
  }
}

async function failJob(jobId, error) {
  const jobs = await redis.lrange('video-compression:processing', 0, -1);
  for (let i = 0; i < jobs.length; i++) {
    const job = JSON.parse(jobs[i]);
    if (job.id === jobId) {
      await redis.lrem('video-compression:processing', 1, jobs[i]);
      job.attempts = (job.attempts || 0) + 1;
      job.error = error;
      
      if (job.attempts < 3) {
        job.status = 'pending';
        job.processor = null;
        await redis.lpush('video-compression:queue', JSON.stringify(job));
      } else {
        job.status = 'failed';
        await redis.lpush('video-compression:failed', JSON.stringify(job));
      }
      break;
    }
  }
}

async function interruptJob(jobId) {
  const jobs = await redis.lrange('video-compression:processing', 0, -1);
  for (let i = 0; i < jobs.length; i++) {
    const job = JSON.parse(jobs[i]);
    if (job.id === jobId) {
      await redis.lrem('video-compression:processing', 1, jobs[i]);
      job.status = 'pending';
      job.processor = null;
      job.error = 'Spot instance interrupted';
      await redis.rpush('video-compression:queue', JSON.stringify(job));
      break;
    }
  }
}

async function downloadFromR2(key, localPath) {
  const response = await s3.send(new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  }));
  
  const writeStream = fs.createWriteStream(localPath);
  await new Promise((resolve, reject) => {
    response.Body.pipe(writeStream);
    response.Body.on('error', reject);
    writeStream.on('finish', resolve);
  });
}

async function uploadToR2(localPath, key) {
  const fileStream = fs.createReadStream(localPath);
  const stats = fs.statSync(localPath);
  
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: fileStream,
    ContentLength: stats.size,
    ContentType: 'video/mp4',
  }));
}

async function compressVideo(inputPath, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-vf', 'scale=1280:720',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-threads', '0',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ]);
    
    let duration = 0;
    
    ffmpeg.stderr.on('data', (data) => {
      const str = data.toString();
      
      // Get duration
      const durMatch = str.match(/Duration: (\\d+):(\\d+):(\\d+)/);
      if (durMatch) {
        duration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3]);
      }
      
      // Get progress
      const timeMatch = str.match(/time=(\\d+):(\\d+):(\\d+)/);
      if (timeMatch && duration > 0) {
        const current = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
        const progress = Math.round((current / duration) * 100);
        onProgress(progress);
      }
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('FFmpeg exited with code ' + code));
    });
    
    ffmpeg.on('error', reject);
  });
}

async function processJob(job) {
  const inputPath = path.join(WORK_DIR, 'input_' + job.id + '.mp4');
  const outputPath = path.join(WORK_DIR, 'output_' + job.id + '.mp4');
  
  try {
    console.log('Processing job:', job.id);
    
    // Download
    console.log('Downloading from R2:', job.videoKey);
    await downloadFromR2(job.videoKey, inputPath);
    await updateProgress(job.id, 10);
    
    if (interrupted) {
      await interruptJob(job.id);
      return;
    }
    
    // Compress
    console.log('Compressing...');
    await compressVideo(inputPath, outputPath, async (progress) => {
      const adjustedProgress = 10 + Math.round(progress * 0.8);
      await updateProgress(job.id, adjustedProgress);
      
      if (interrupted) {
        // Kill ffmpeg somehow
      }
    });
    
    if (interrupted) {
      await interruptJob(job.id);
      return;
    }
    
    // Upload
    console.log('Uploading to R2:', job.outputKey);
    await uploadToR2(outputPath, job.outputKey);
    await updateProgress(job.id, 95);
    
    // Complete
    await completeJob(job.id);
    console.log('Job completed:', job.id);
    
  } catch (error) {
    console.error('Job failed:', job.id, error.message);
    await failJob(job.id, error.message);
  } finally {
    // Cleanup
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
}

async function main() {
  console.log('Compression worker started (processor:', PROCESSOR_TYPE, ')');
  
  let idleTime = 0;
  const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  while (!interrupted) {
    const job = await getNextJob();
    
    if (job) {
      idleTime = 0;
      await processJob(job);
    } else {
      idleTime += 5000;
      
      if (PROCESSOR_TYPE === 'spot' && idleTime >= IDLE_TIMEOUT) {
        console.log('Idle timeout reached, shutting down...');
        await redis.set('video-compression:spot-status', JSON.stringify({ status: 'stopped' }));
        process.exit(0);
      }
      
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  console.log('Worker interrupted, exiting...');
  process.exit(0);
}

main().catch(console.error);
`;
}