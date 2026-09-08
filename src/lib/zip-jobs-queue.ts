// src/lib/zip-jobs-queue.ts
//
// Producer/consumer plumbing for "Download All" zip-build jobs — mirrors
// notification-queue.ts's shape. The producer side (enqueueZipJob) is
// called from src/app/api/drive/download-zip/route.ts, which returns a
// jobId to the browser immediately and does NOT wait for the zip to be
// built. The consumer side (deliverZipJob) is called from worker.ts's
// queue() handler and awaits the file-server's full response — which can
// legitimately take hours for a 100GB folder. That's safe specifically
// because Cloudflare Queue consumer invocations have no wall-time limit
// (unlike a plain HTTP fetch handler, which is why the producer route
// must never await this itself).
//
// The browser never holds a long connection open for any of this — it
// polls GET /api/drive/zip-jobs/[jobId] (a fast, separate route) for
// progress instead.

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { startZipJob, ZipJobRequest } from '@/lib/file-server';

export type ZipJobMessage = ZipJobRequest & {
  jobId: string;
  userId: number | string;
  role: string;
};

// ── Producer side ─────────────────────────────────────────────────────────

export async function enqueueZipJob(job: ZipJobMessage): Promise<boolean> {
  try {
    const { env } = getCloudflareContext();
    const queue = (env as any)?.ZIP_JOBS_QUEUE;
    if (queue) {
      await queue.send(job);
      return true;
    }
  } catch (err: any) {
    console.warn('[zip-jobs-queue] No queue binding available:', err?.message);
  }
  return false;
}

// ── Consumer side (called from worker.ts's queue() handler) ────────────────

export async function deliverZipJob(job: ZipJobMessage, env: any): Promise<void> {
  const result = await startZipJob(env, job.userId, job.role, job.jobId, {
    keys: job.keys,
    folderPrefix: job.folderPrefix,
    zipName: job.zipName,
  });
  if (!result.success) {
    throw new Error(result.error || 'Zip job failed on file server');
  }
}