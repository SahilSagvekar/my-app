// Video Compression System Configuration

export const COMPRESSION_CONFIG = {
  // Spot Instance Settings
  spot: {
    instanceType: 'c6i.xlarge',
    amiId: process.env.COMPRESSION_AMI_ID || '', // Will be set after AMI creation
    securityGroupId: process.env.COMPRESSION_SG_ID || '',
    subnetId: process.env.COMPRESSION_SUBNET_ID || '',
    keyName: process.env.COMPRESSION_KEY_NAME || '',
    maxSpotPrice: '0.05', // Won't pay more than $0.05/hr
    region: process.env.AWS_REGION || 'us-east-1',
  },

  // Budget Controls
  budget: {
    monthlyLimitUSD: 20,
    alertThresholdPercent: 80, // Alert when 80% used
  },

  // Queue Settings
  queue: {
    redisPrefix: 'video-compression:',
    jobTimeout: 3600, // 1 hour max per job
    retryAttempts: 3,
    checkIntervalMs: 30000, // Check queue every 30 seconds
  },

  // Processing Thresholds
  thresholds: {
    minJobsToStartSpot: 3, // Start spot if 3+ jobs pending
    minSizeGBToStartSpot: 5, // Or if 5GB+ pending
    idleMinutesToStopSpot: 5, // Stop spot after 5 min idle
  },

  // FFmpeg Settings (FAST preset - quality not priority)
  ffmpeg: {
    // Fast compression for most videos
    fast: {
      scale: '1280:720',
      preset: 'ultrafast',
      crf: '28',
      threads: '0',
    },
    // Nuclear option for very large files
    nuclear: {
      scale: '854:480',
      preset: 'ultrafast',
      crf: '35',
      threads: '0',
      noAudio: true,
    },
  },

  // R2 Settings
  r2: {
    bucket: process.env.R2_BUCKET_NAME || '',
    endpoint: process.env.R2_ENDPOINT || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    compressedPrefix: 'compressed/',
  },

  // Slack Notifications
  slack: {
    webhookUrl: process.env.SLACK_COMPRESSION_WEBHOOK || '',
    enabled: !!process.env.SLACK_COMPRESSION_WEBHOOK,
  },
};

// Redis Keys
export const REDIS_KEYS = {
  queue: 'video-compression:queue',
  processing: 'video-compression:processing',
  completed: 'video-compression:completed',
  failed: 'video-compression:failed',
  spotStatus: 'video-compression:spot-status',
  spotInstanceId: 'video-compression:spot-instance-id',
  budgetUsed: 'video-compression:budget-used',
  budgetResetDate: 'video-compression:budget-reset-date',
  stats: 'video-compression:stats',
};

// Job Status
export type JobStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'interrupted';

// Job Interface
export interface CompressionJob {
  id: string;
  videoKey: string; // R2 key
  outputKey: string; // Where to save compressed
  sizeBytes: number;
  status: JobStatus;
  progress: number;
  processor: 'spot' | 'local' | null;
  attempts: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  clientId?: string;
  taskId?: string;
}

// Spot Instance Status
export interface SpotStatus {
  status: 'stopped' | 'starting' | 'running' | 'stopping';
  instanceId?: string;
  launchedAt?: string;
  lastJobAt?: string;
  currentJobId?: string;
}