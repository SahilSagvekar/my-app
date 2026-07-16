// src/lib/nas-archival.ts
// Monthly output-folder sweep: once a task's output month is more than 2
// calendar months old and the task is finalized, verify the file is really
// present on the NAS (real check against the NAS's MinIO S3 API over
// Tailscale — not just the `archivedToNas` flag, which is bulk-set by the
// daily webhook in src/app/api/nas/backup-complete/route.ts without
// per-file verification) and only then delete the R2 copy. Raw footage is
// never touched here.
//
// Previously this did an fs.existsSync() check against an NFS mount that
// was never actually set up (NAS_MOUNT_PATH pointed at nothing on the EC2
// host, so every file was permanently skipped). Replaced with a live
// HeadObject call against the NAS's MinIO instance, reached over Tailscale.
// See src/lib/nas-s3.ts for the client.

import { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { deleteFromS3 } from '@/lib/s3';
import { headObjectOnNas, NAS_BUCKET } from '@/lib/nas-s3';

const FINALIZED_STATUSES: TaskStatus[] = [TaskStatus.COMPLETED, TaskStatus.SCHEDULED, TaskStatus.POSTED];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface SweepFileResult {
  fileId: string;
  s3Key: string;
  taskId: string;
  monthFolder: string;
  sizeBytes: number;
  outcome: 'deleted' | 'would_delete' | 'skipped_not_on_nas' | 'failed';
  reason?: string;
}

export interface SweepSummary {
  dryRun: boolean;
  clientId: string | null;
  cutoffMonthFolder: string;
  eligibleCount: number;
  deletedCount: number;
  skippedCount: number;
  failedCount: number;
  bytesFreed: number;
  monthsSwept: string[];
  results: SweepFileResult[];
}

// "February-2026" -> Date(2026, 1, 1). Returns null if unparseable.
function parseMonthFolder(monthFolder: string): Date | null {
  const [monthName, yearStr] = monthFolder.split('-');
  const monthIndex = MONTH_NAMES.findIndex(m => m === monthName);
  const year = Number(yearStr);
  if (monthIndex === -1 || !Number.isFinite(year)) return null;
  return new Date(year, monthIndex, 1);
}

// Sweep is rolling: every run catches anything older than 2 full calendar
// months back, not just the month that just turned 2-months-old — so a
// month missed by an earlier failed run still gets picked up later.
export function getCutoffDate(referenceDate: Date = new Date()): Date {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 2, 1);
}

function isEligibleMonthFolder(monthFolder: string | null, cutoff: Date): boolean {
  if (!monthFolder) return false;
  const parsed = parseMonthFolder(monthFolder);
  if (!parsed) return false;
  return parsed.getTime() < cutoff.getTime();
}

// Real per-file check against the NAS's MinIO instance — the daily
// webhook's `archivedToNas` flag is a blanket assumption, not a per-file
// guarantee. This is a live API call, so it also catches size mismatches
// (truncated/corrupt copies) the same way the old filesystem check did.
async function verifyOnNas(s3Key: string, expectedSizeBytes: number): Promise<{ ok: boolean; reason?: string }> {
  const head = await headObjectOnNas(s3Key);
  if (!head.ok) {
    return { ok: false, reason: head.reason };
  }
  if (head.sizeBytes !== undefined && head.sizeBytes !== expectedSizeBytes) {
    return { ok: false, reason: `size mismatch (NAS ${head.sizeBytes}B vs R2 ${expectedSizeBytes}B)` };
  }
  return { ok: true };
}

export async function runNasArchivalSweep(opts: { dryRun: boolean; clientId?: string | null }): Promise<SweepSummary> {
  const cutoff = getCutoffDate();
  const cutoffMonthFolder = `${MONTH_NAMES[cutoff.getMonth()]}-${cutoff.getFullYear()}`;

  const candidates = await prisma.file.findMany({
    where: {
      isActive: true,
      deletedFromCloud: false,
      s3Key: { not: null },
      NOT: { s3Key: { contains: 'raw-footage' } },
      task: {
        status: { in: FINALIZED_STATUSES },
        monthFolder: { not: null },
        ...(opts.clientId ? { clientId: opts.clientId } : {}),
      },
    },
    select: {
      id: true,
      s3Key: true,
      size: true,
      taskId: true,
      task: { select: { monthFolder: true } },
    },
  });

  const eligible = candidates.filter(f => isEligibleMonthFolder(f.task.monthFolder, cutoff));

  const results: SweepFileResult[] = [];
  const monthsSwept = new Set<string>();
  let deletedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let bytesFreed = 0;

  for (const file of eligible) {
    const s3Key = file.s3Key!;
    const sizeBytes = Number(file.size);
    const monthFolder = file.task.monthFolder!;

    const verification = await verifyOnNas(s3Key, sizeBytes);
    if (!verification.ok) {
      skippedCount++;
      results.push({
        fileId: file.id, s3Key, taskId: file.taskId, monthFolder, sizeBytes,
        outcome: 'skipped_not_on_nas', reason: verification.reason,
      });
      continue;
    }

    if (opts.dryRun) {
      results.push({ fileId: file.id, s3Key, taskId: file.taskId, monthFolder, sizeBytes, outcome: 'would_delete' });
      monthsSwept.add(monthFolder);
      bytesFreed += sizeBytes;
      continue;
    }

    try {
      const deleted = await deleteFromS3(s3Key);
      if (!deleted) throw new Error('deleteFromS3 returned false');

      await prisma.file.update({
        where: { id: file.id },
        data: {
          deletedFromCloud: true,
          deletedFromCloudAt: new Date(),
          archivedToNas: true,
          nasArchivedAt: new Date(),
          nasPath: `minio://${NAS_BUCKET}`,
        },
      });

      deletedCount++;
      bytesFreed += sizeBytes;
      monthsSwept.add(monthFolder);
      results.push({ fileId: file.id, s3Key, taskId: file.taskId, monthFolder, sizeBytes, outcome: 'deleted' });
    } catch (err: any) {
      failedCount++;
      results.push({
        fileId: file.id, s3Key, taskId: file.taskId, monthFolder, sizeBytes,
        outcome: 'failed', reason: err.message,
      });
    }
  }

  if (!opts.dryRun && eligible.length > 0) {
    await prisma.nasSyncLog.create({
      data: {
        status: failedCount === 0 ? 'success' : (deletedCount > 0 ? 'partial' : 'failed'),
        completedAt: new Date(),
        bucketName: NAS_BUCKET,
        paths: Array.from(monthsSwept),
        filesCount: deletedCount,
        bytesCount: BigInt(bytesFreed),
        errorMessage: failedCount > 0 ? `${failedCount} file(s) failed to delete from R2` : null,
      },
    });
  }

  return {
    dryRun: opts.dryRun,
    clientId: opts.clientId || null,
    cutoffMonthFolder,
    eligibleCount: eligible.length,
    deletedCount,
    skippedCount,
    failedCount,
    bytesFreed,
    monthsSwept: Array.from(monthsSwept),
    results,
  };
}