// src/lib/nas-sweep-worker.ts
// Processes one NasSweepJob at a time — fetches the file's bytes from R2 and
// streams them straight to the NAS upload server (see nas-upload-server's
// server.js in the separate nas-upload-server repo/folder), then marks the
// file as archived. Copy-only — never touches or deletes anything in R2.
//
// Ticked by the every-minute Cron Trigger (see worker.ts + tick-queues
// route), same pattern as upload-worker.ts's runUploadWorkerTick.

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3, BUCKET as R2_BUCKET } from '@/lib/s3';
import { getDbHttp } from '@/lib/db';
import { file as fileTable, nasBackupRecord } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  popNasSweepJob,
  ackNasSweepJob,
  failNasSweepJob,
  recoverStuckNasSweepJobs,
  recordSweepFile,
  NasSweepJob,
} from '@/lib/nas-sweep-queue';

let isRunning = false;

export async function runNasSweepWorkerTick(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    await recoverStuckNasSweepJobs();

    const job = await popNasSweepJob();
    if (!job) return;

    await processJob(job);
  } catch (err: any) {
    console.error('[NasSweepWorker] Tick error:', err.message);
  } finally {
    isRunning = false;
  }
}

async function processJob(job: NasSweepJob): Promise<void> {
  const nasUploadUrl = process.env.NAS_UPLOAD_URL; // e.g. https://nas.e8productions.com
  const nasUploadSecret = process.env.NAS_UPLOAD_SECRET;

  if (!nasUploadUrl || !nasUploadSecret) {
    await failNasSweepJob(job, 'NAS_UPLOAD_URL or NAS_UPLOAD_SECRET not configured');
    return;
  }

  try {
    // Fetch the file's bytes from R2.
    const r2 = getS3();
    const { Body } = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: job.s3Key }));
    if (!Body) {
      await failNasSweepJob(job, 'R2 object has no body (may have been deleted)');
      return;
    }

    // Stream straight through to the NAS upload server — no buffering.
    const uploadUrl = `${nasUploadUrl.replace(/\/$/, '')}/upload?destPath=${encodeURIComponent(job.destPath)}`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'x-nas-upload-secret': nasUploadSecret,
        'Content-Type': 'application/octet-stream',
      },
      // @ts-ignore — Body from the S3 SDK is a web ReadableStream in the Workers runtime
      body: Body.transformToWebStream ? Body.transformToWebStream() : Body,
      // @ts-ignore — required by undici/workerd when streaming a request body
      duplex: 'half',
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      await failNasSweepJob(job, `NAS upload server returned ${response.status}: ${text}`);
      return;
    }

    // Success — mark the file as archived in whichever table this job's
    // category tracks (File for outputs, NasBackupRecord for raw-footage/elements).
    const db = getDbHttp();
    const now = new Date().toISOString();
    if (job.fileId) {
      await db.update(fileTable).set({
        archivedToNas: true,
        nasArchivedAt: now,
        nasPath: job.destPath,
      }).where(eq(fileTable.id, job.fileId));
    } else if (job.backupRecordId) {
      await db.update(nasBackupRecord).set({
        archivedToNas: true,
        nasArchivedAt: now,
        nasPath: job.destPath,
        updatedAt: now,
      }).where(eq(nasBackupRecord.id, job.backupRecordId));
    }

    await ackNasSweepJob(job.id);
    await recordSweepFile(job, { failed: false });

    console.log(`[NasSweepWorker] Copied ${job.s3Key} -> ${job.destPath}`);
  } catch (err: any) {
    console.error(`[NasSweepWorker] Job ${job.id} (${job.s3Key}) failed:`, err.message);
    await failNasSweepJob(job, err.message || String(err));
  }
}