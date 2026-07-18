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

import { prisma } from '@/lib/prisma';

const STUCK_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour — mirror jobs can be big

export type NasFolderType = 'outputs' | 'raw-footage';

export async function createNasMirrorJob(params: {
  clientName: string;
  folderType: NasFolderType;
  monthFolder: string; // for outputs: the month, e.g. "March-2026". for raw-footage: first path segment, for display.
  folderPath?: string; // only for raw-footage — full relative path under raw-footage/
  triggeredById?: number | null;
}) {
  return prisma.nasMirrorJob.create({
    data: {
      clientName: params.clientName,
      folderType: params.folderType,
      monthFolder: params.monthFolder,
      folderPath: params.folderPath ?? null,
      status: 'pending',
      triggeredById: params.triggeredById ?? null,
    },
  });
}

// Picks the oldest pending job, if any, and marks it running.
export async function popPendingNasMirrorJob() {
  const job = await prisma.nasMirrorJob.findFirst({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
  if (!job) return null;

  return prisma.nasMirrorJob.update({
    where: { id: job.id },
    data: { status: 'running', startedAt: new Date() },
  });
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
  await prisma.nasMirrorJob.update({ where: { id }, data: patch }).catch(() => {
    // best-effort — if the job row was deleted or the update races, don't crash the worker
  });
}

export async function completeNasMirrorJob(id: string) {
  await prisma.nasMirrorJob.update({
    where: { id },
    data: { status: 'completed', completedAt: new Date(), currentFile: null },
  });
}

export async function failNasMirrorJob(id: string, errorMessage: string) {
  await prisma.nasMirrorJob.update({
    where: { id },
    data: { status: 'failed', completedAt: new Date(), errorMessage, currentFile: null },
  });
}

// On worker startup, any job stuck in "running" for over an hour (e.g. the
// process died mid-job) gets reset to "pending" so it gets picked up again.
export async function recoverStuckNasMirrorJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
  const result = await prisma.nasMirrorJob.updateMany({
    where: { status: 'running', startedAt: { lt: cutoff } },
    data: { status: 'pending', startedAt: null, currentFile: null },
  });
  return result.count;
}