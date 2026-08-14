// src/lib/nas-mirror-queue.ts
// Job queue for NAS mirror-and-cleanup runs, backed by the NasMirrorJob table
// instead of Redis (unlike upload-queue.ts) — because these rows also serve
// as the permanent history the admin UI shows, not just transient queue state.
//
// A job is either:
//   - an "outputs" job: clientName + monthFolder (e.g. "March-2026")
//   - a "raw-footage" job: clientName + folderPath (full relative path under
//     <clientName>/raw-footage/, e.g. "June-2025/SF12" or just "June-2025"
//     if a whole month was selected). monthFolder is still set to the first
//     path segment for display/history purposes even for raw-footage jobs.
//
// Triggered from the NAS Backup admin panel, picked up by
// nas-mirror-worker.ts on the next cron-master tick.

import { getDbHttp } from '@/lib/db';
import { nasMirrorJob } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, asc, eq, lt } from 'drizzle-orm';

const STUCK_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour — mirror jobs can be big

export type NasFolderType = 'outputs' | 'raw-footage';

export async function createNasMirrorJob(params: {
  clientName: string;
  folderType: NasFolderType;
  monthFolder: string; // for outputs: the month, e.g. "March-2026". for raw-footage: first path segment, for display.
  folderPath?: string; // only for raw-footage — full relative path under raw-footage/
  triggeredById?: number | null;
}) {
  const db = getDbHttp();
  const [job] = await db.insert(nasMirrorJob).values({
    id: createId(),
    clientName: params.clientName,
    folderType: params.folderType,
    monthFolder: params.monthFolder,
    folderPath: params.folderPath ?? null,
    status: 'pending',
    triggeredById: params.triggeredById ?? null,
    updatedAt: new Date().toISOString(),
  }).returning();
  return job;
}

// Picks the oldest pending job, if any, and marks it running.
export async function popPendingNasMirrorJob() {
  const db = getDbHttp();
  const [job] = await db.select().from(nasMirrorJob)
    .where(eq(nasMirrorJob.status, 'pending'))
    .orderBy(asc(nasMirrorJob.createdAt))
    .limit(1);
  if (!job) return null;

  const [updated] = await db.update(nasMirrorJob)
    .set({ status: 'running', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(nasMirrorJob.id, job.id))
    .returning();
  return updated;
}

export async function updateNasMirrorJobProgress(
  id: string,
  patch: Partial<{
    scannedCount: number;
    copiedCount: number;
    verifiedCount: number;
    deletedCount: number;
    failedCount: number;
    currentFile: string | null;
  }>
) {
  const db = getDbHttp();
  try {
    await db.update(nasMirrorJob)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(nasMirrorJob.id, id));
  } catch {
    // best-effort — if the job row was deleted or the update races, don't crash the worker
  }
}

export async function completeNasMirrorJob(id: string) {
  const db = getDbHttp();
  await db.update(nasMirrorJob)
    .set({ status: 'completed', completedAt: new Date().toISOString(), currentFile: null, updatedAt: new Date().toISOString() })
    .where(eq(nasMirrorJob.id, id));
}

export async function failNasMirrorJob(id: string, errorMessage: string) {
  const db = getDbHttp();
  await db.update(nasMirrorJob)
    .set({ status: 'failed', completedAt: new Date().toISOString(), errorMessage, currentFile: null, updatedAt: new Date().toISOString() })
    .where(eq(nasMirrorJob.id, id));
}

// On worker startup, any job stuck in "running" for over an hour (e.g. the
// process died mid-job) gets reset to "pending" so it gets picked up again.
export async function recoverStuckNasMirrorJobs(): Promise<number> {
  const db = getDbHttp();
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();
  const result = await db.update(nasMirrorJob)
    .set({ status: 'pending', startedAt: null, currentFile: null, updatedAt: new Date().toISOString() })
    .where(and(eq(nasMirrorJob.status, 'running'), lt(nasMirrorJob.startedAt, cutoff)))
    .returning({ id: nasMirrorJob.id });
  return result.length;
}