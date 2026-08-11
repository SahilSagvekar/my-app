// src/lib/titling-service.ts

import { db } from './db';
import {
  task as taskTable,
  file as fileTable,
  titlingJob as titlingJobTable,
} from './db/schema';
import { createId } from './db/id';
import { and, eq, desc, like, lt, sql } from 'drizzle-orm';
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
  const task = await db.query.task.findFirst({
    where: eq(taskTable.id, taskId),
    with: {
      files: {
        where: and(eq(fileTable.isActive, true), like(fileTable.mimeType, 'video/%')),
        orderBy: [desc(fileTable.createdAt)],
        limit: 1,
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
  const [existingJob] = await db
    .select()
    .from(titlingJobTable)
    .where(eq(titlingJobTable.taskId, taskId))
    .limit(1);

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
  const now = new Date().toISOString();
  const [job] = await db
    .insert(titlingJobTable)
    .values({
      id: createId(),
      taskId,
      status: 'PROCESSING',
      assemblyId: transcriptId,
      videoFileId: videoFile.id,
      videoFileName: videoFile.name,
      startedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: titlingJobTable.taskId,
      set: {
        status: 'PROCESSING',
        assemblyId: transcriptId,
        videoFileId: videoFile.id,
        videoFileName: videoFile.name,
        startedAt: now,
        error: null,
        attempts: sql`${titlingJobTable.attempts} + 1`,
        updatedAt: now,
      },
    })
    .returning();

  // 7. Update task status
  await db.update(taskTable).set({
    titlingStatus: 'PROCESSING',
    platform,
    updatedAt: now,
  }).where(eq(taskTable.id, taskId));

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
  const job = await db.query.titlingJob.findFirst({
    where: eq(titlingJobTable.assemblyId, assemblyId),
    with: {
      task: {
        with: {
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
      numTitles: 5,
      includeTrends: true,
    });

    if (!titleResult.success) {
      throw new Error(titleResult.error || 'Failed to generate titles');
    }

    // 4. Update task with results
    await db.update(taskTable).set({
      transcript,
      transcriptSummary: titleResult.transcript_summary,
      suggestedTitles: titleResult.generated_titles as any,
      titlingStatus: 'COMPLETED',
      titlingError: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(taskTable.id, taskId));

    // 5. Update job status
    await db.update(titlingJobTable).set({
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      videoDuration: audioDuration ? Math.round(audioDuration) : null,
      updatedAt: new Date().toISOString(),
    }).where(eq(titlingJobTable.id, job.id));

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
    await db.update(titlingJobTable).set({
      status: 'FAILED',
      error: error.message,
      updatedAt: new Date().toISOString(),
    }).where(eq(titlingJobTable.id, job.id));

    // Update task status
    await db.update(taskTable).set({
      titlingStatus: 'FAILED',
      titlingError: error.message,
      updatedAt: new Date().toISOString(),
    }).where(eq(taskTable.id, taskId));

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

  const [job] = await db
    .select()
    .from(titlingJobTable)
    .where(eq(titlingJobTable.assemblyId, assemblyId))
    .limit(1);

  if (!job) {
    console.error(`   Job not found for AssemblyAI ID: ${assemblyId}`);
    return;
  }

  await db.update(titlingJobTable).set({
    status: 'FAILED',
    error,
    updatedAt: new Date().toISOString(),
  }).where(eq(titlingJobTable.id, job.id));

  await db.update(taskTable).set({
    titlingStatus: 'FAILED',
    titlingError: error,
    updatedAt: new Date().toISOString(),
  }).where(eq(taskTable.id, job.taskId));
}

/**
 * Retry a failed titling job
 */
export async function retryTitlingJob(taskId: string): Promise<{ jobId: string; transcriptId: string }> {
  console.log(`\n🔄 Retrying titling job for task: ${taskId}`);

  // Reset task status
  await db.update(taskTable).set({
    titlingStatus: 'PENDING',
    titlingError: null,
    updatedAt: new Date().toISOString(),
  }).where(eq(taskTable.id, taskId));

  // Start fresh
  return startTitlingJob(taskId);
}

/**
 * Get titling status for a task
 */
export async function getTitlingStatus(taskId: string) {
  const task = await db.query.task.findFirst({
    where: eq(taskTable.id, taskId),
    columns: {
      titlingStatus: true,
      titlingError: true,
      transcript: true,
      transcriptSummary: true,
      suggestedTitles: true,
    },
    with: {
      // NOTE: TitlingJob has a unique index on taskId (true 1:1), but
      // drizzle-kit introspection labels the reverse relation `many()` —
      // fetch as a list and take the first entry (see CLAUDE.md pitfall #3).
      titlingJobs: {
        columns: {
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

  if (!task) return null;

  const { titlingJobs, ...rest } = task;
  return { ...rest, titlingJob: titlingJobs[0] ?? null };
}

/**
 * Check for stuck jobs and handle them
 * Call this from a cron job every 30 minutes
 */
export async function checkStuckJobs(): Promise<number> {
  const STUCK_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
  const now = new Date();

  // Find jobs that have been processing for too long
  const stuckJobs = await db
    .select()
    .from(titlingJobTable)
    .where(
      and(
        eq(titlingJobTable.status, 'PROCESSING'),
        lt(titlingJobTable.startedAt, new Date(now.getTime() - STUCK_THRESHOLD_MS).toISOString()),
      )
    );

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
