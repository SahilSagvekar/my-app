// src/lib/titling-service.ts

import { prisma } from './prisma';
import { submitVideoForTranscription, getTranscription } from './assemblyai';
import { generateTitlesFromTranscript, GeneratedTitle } from './ai-titling';

const WEBHOOK_SECRET = process.env.ASSEMBLYAI_WEBHOOK_SECRET || 'e8-titling-secret';

export interface TitlingJobResult {
  success: boolean;
  taskId: string;
  transcript?: string;
  transcriptSummary?: string;
  titles?: GeneratedTitle[];
  error?: string;
}

/**
 * Start the titling process for a task
 * Called when QC approves a task
 */
export async function startTitlingJob(taskId: string): Promise<{ jobId: string; transcriptId: string }> {
  console.log(`\n🎬 Starting titling job for task: ${taskId}`);

  // 1. Get task with files
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      files: {
        where: {
          isActive: true,
          mimeType: { startsWith: 'video/' },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      client: true,
      monthlyDeliverable: true,
    },
  });

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // 2. Find video file
  const videoFile = task.files[0];
  if (!videoFile) {
    throw new Error(`No video file found for task: ${taskId}`);
  }

  // Check if we have S3 key or URL
  const videoSource = videoFile.s3Key || videoFile.url;
  if (!videoSource) {
    throw new Error(`No S3 key or URL for video file: ${videoFile.id}`);
  }

  console.log(`   Video file: ${videoFile.name}`);
  console.log(`   Video source: ${videoSource}`);

  // 3. Determine platform from deliverable or default
  // const platform = task.platform || 
  //   (task.monthlyDeliverable?.platforms?.[0] as any) || 
  //   'youtube';

  const platform = 'general';

  // 4. Check for existing job
  const existingJob = await prisma.titlingJob.findUnique({
    where: { taskId },
  });

  if (existingJob && existingJob.status === 'PROCESSING') {
    console.log(`   ⚠️ Job already processing: ${existingJob.id}`);
    return { jobId: existingJob.id, transcriptId: existingJob.assemblyId || '' };
  }

  // 5. Submit to AssemblyAI
  const { transcriptId, presignedUrl } = await submitVideoForTranscription(videoSource, {
    webhookSecret: WEBHOOK_SECRET,
  });

  console.log(`   AssemblyAI transcript ID: ${transcriptId}`);

  // 6. Create or update job record
  const job = await prisma.titlingJob.upsert({
    where: { taskId },
    create: {
      taskId,
      status: 'PROCESSING',
      assemblyId: transcriptId,
      videoFileId: videoFile.id,
      videoFileName: videoFile.name,
      startedAt: new Date(),
    },
    update: {
      status: 'PROCESSING',
      assemblyId: transcriptId,
      videoFileId: videoFile.id,
      videoFileName: videoFile.name,
      startedAt: new Date(),
      error: null,
      attempts: { increment: 1 },
    },
  });

  // 7. Update task status
  await prisma.task.update({
    where: { id: taskId },
    data: {
      titlingStatus: 'PROCESSING',
      platform,
    },
  });

  console.log(`   ✅ Job created: ${job.id}`);

  return { jobId: job.id, transcriptId };
}

/**
 * Complete the titling process after receiving transcript from webhook
 */
export async function completeTitlingJob(
  assemblyId: string,
  transcript: string,
  audioDuration?: number
): Promise<TitlingJobResult> {
  console.log(`\n📝 Completing titling job for AssemblyAI ID: ${assemblyId}`);

  // 1. Find the job
  const job = await prisma.titlingJob.findFirst({
    where: { assemblyId },
    include: {
      task: {
        include: {
          monthlyDeliverable: true,
        },
      },
    },
  });

  if (!job) {
    console.error(`   ❌ Job not found for AssemblyAI ID: ${assemblyId}`);
    return {
      success: false,
      taskId: '',
      error: `Job not found for AssemblyAI ID: ${assemblyId}`,
    };
  }

  const taskId = job.taskId;
  console.log(`   Task ID: ${taskId}`);
  console.log(`   Transcript length: ${transcript.length} characters`);

  try {
    // 2. Determine platform
    const platform = job.task.platform || 
      (job.task.monthlyDeliverable?.platforms?.[0] as any) || 
      'youtube';

    // 3. Generate titles using AI API
    console.log(`   🤖 Generating titles for platform: ${platform}`);
    
    const titleResult = await generateTitlesFromTranscript({
      transcript,
      platform,
      numTitles: 10,
      includeTrends: true,
    });

    if (!titleResult.success) {
      throw new Error(titleResult.error || 'Failed to generate titles');
    }

    // 4. Update task with results
    await prisma.task.update({
      where: { id: taskId },
      data: {
        transcript,
        transcriptSummary: titleResult.transcript_summary,
        suggestedTitles: titleResult.generated_titles as any,
        titlingStatus: 'COMPLETED',
        titlingError: null,
      },
    });

    // 5. Update job status
    await prisma.titlingJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        videoDuration: audioDuration ? Math.round(audioDuration) : null,
      },
    });

    console.log(`   ✅ Titling completed! Generated ${titleResult.generated_titles?.length || 0} titles`);

    return {
      success: true,
      taskId,
      transcript,
      transcriptSummary: titleResult.transcript_summary,
      titles: titleResult.generated_titles,
    };

  } catch (error: any) {
    console.error(`   ❌ Error completing titling job:`, error.message);

    // Update job with error
    await prisma.titlingJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        error: error.message,
      },
    });

    // Update task status
    await prisma.task.update({
      where: { id: taskId },
      data: {
        titlingStatus: 'FAILED',
        titlingError: error.message,
      },
    });

    return {
      success: false,
      taskId,
      error: error.message,
    };
  }
}

/**
 * Handle transcription failure
 */
export async function failTitlingJob(assemblyId: string, error: string): Promise<void> {
  console.log(`\n❌ Failing titling job for AssemblyAI ID: ${assemblyId}`);
  console.log(`   Error: ${error}`);

  const job = await prisma.titlingJob.findFirst({
    where: { assemblyId },
  });

  if (!job) {
    console.error(`   Job not found for AssemblyAI ID: ${assemblyId}`);
    return;
  }

  await prisma.titlingJob.update({
    where: { id: job.id },
    data: {
      status: 'FAILED',
      error,
    },
  });

  await prisma.task.update({
    where: { id: job.taskId },
    data: {
      titlingStatus: 'FAILED',
      titlingError: error,
    },
  });
}

/**
 * Retry a failed titling job
 */
export async function retryTitlingJob(taskId: string): Promise<{ jobId: string; transcriptId: string }> {
  console.log(`\n🔄 Retrying titling job for task: ${taskId}`);

  // Reset task status
  await prisma.task.update({
    where: { id: taskId },
    data: {
      titlingStatus: 'PENDING',
      titlingError: null,
    },
  });

  // Start fresh
  return startTitlingJob(taskId);
}

/**
 * Get titling status for a task
 */
export async function getTitlingStatus(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      titlingStatus: true,
      titlingError: true,
      transcript: true,
      transcriptSummary: true,
      suggestedTitles: true,
      titlingJob: {
        select: {
          id: true,
          status: true,
          assemblyId: true,
          attempts: true,
          startedAt: true,
          completedAt: true,
          videoDuration: true,
        },
      },
    },
  });

  return task;
}

/**
 * Check for stuck jobs and handle them
 * Call this from a cron job every 30 minutes
 */
export async function checkStuckJobs(): Promise<number> {
  const STUCK_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
  const now = new Date();

  // Find jobs that have been processing for too long
  const stuckJobs = await prisma.titlingJob.findMany({
    where: {
      status: 'PROCESSING',
      startedAt: {
        lt: new Date(now.getTime() - STUCK_THRESHOLD_MS),
      },
    },
  });

  console.log(`\n🔍 Found ${stuckJobs.length} stuck jobs`);

  for (const job of stuckJobs) {
    try {
      // Check actual status with AssemblyAI
      if (job.assemblyId) {
        const result = await getTranscription(job.assemblyId);
        
        if (result.status === 'completed' && result.text) {
          // Webhook missed, complete manually
          console.log(`   Completing missed job: ${job.id}`);
          await completeTitlingJob(job.assemblyId, result.text, result.audio_duration);
        } else if (result.status === 'error') {
          // Failed
          console.log(`   Failing stuck job: ${job.id}`);
          await failTitlingJob(job.assemblyId, result.error || 'Transcription failed');
        }
        // If still processing, leave it alone
      }
    } catch (error: any) {
      console.error(`   Error checking stuck job ${job.id}:`, error.message);
    }
  }

  return stuckJobs.length;
}
