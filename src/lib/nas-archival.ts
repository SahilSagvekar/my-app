// src/lib/nas-archival.ts
// Monthly output-folder sweep: once a task's output month is more than 2
// calendar months old and the task is finalized, verify the file is really
// present on the NAS (real check against the NAS's MinIO S3 API over
// Tailscale — not just the `archivedToNas` flag, which is bulk-set by the
// daily webhook in src/app/api/nas/backup-complete/route.ts without
// per-file verification) and only then delete the R2 copy. Raw footage is
// never touched here.

import { db } from '@/lib/db';
import { file as fileTable, task as taskTable, nasSyncLog } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, inArray, isNotNull, not, like } from 'drizzle-orm';
import { deleteFromS3 } from '@/lib/s3';
import { headObjectOnNas, NAS_BUCKET } from '@/lib/nas-s3';

const FINALIZED_STATUSES = ['COMPLETED', 'SCHEDULED', 'POSTED'] as const;
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

function parseMonthFolder(monthFolder: string): Date | null {
  const [monthName, yearStr] = monthFolder.split('-');
  const monthIndex = MONTH_NAMES.findIndex(m => m === monthName);
  const year = Number(yearStr);
  if (monthIndex === -1 || !Number.isFinite(year)) return null;
  return new Date(year, monthIndex, 1);
}

export function getCutoffDate(referenceDate: Date = new Date()): Date {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 2, 1);
}

function isEligibleMonthFolder(monthFolder: string | null, cutoff: Date): boolean {
  if (!monthFolder) return false;
  const parsed = parseMonthFolder(monthFolder);
  if (!parsed) return false;
  return parsed.getTime() < cutoff.getTime();
}

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

  const taskConditions = [
    inArray(taskTable.status, FINALIZED_STATUSES as any),
    isNotNull(taskTable.monthFolder),
    ...(opts.clientId ? [eq(taskTable.clientId, opts.clientId)] : []),
  ];

  const candidates = await db.select({
    id: fileTable.id,
    s3Key: fileTable.s3Key,
    size: fileTable.size,
    taskId: fileTable.taskId,
    monthFolder: taskTable.monthFolder,
  })
    .from(fileTable)
    .innerJoin(taskTable, eq(fileTable.taskId, taskTable.id))
    .where(and(
      eq(fileTable.isActive, true),
      eq(fileTable.deletedFromCloud, false),
      isNotNull(fileTable.s3Key),
      not(like(fileTable.s3Key, '%raw-footage%')),
      ...taskConditions,
    ));

  const eligible = candidates.filter(f => isEligibleMonthFolder(f.monthFolder, cutoff));

  const results: SweepFileResult[] = [];
  const monthsSwept = new Set<string>();
  let deletedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let bytesFreed = 0;

  for (const file of eligible) {
    const s3Key = file.s3Key!;
    const sizeBytes = Number(file.size);
    const monthFolder = file.monthFolder!;

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

      await db.update(fileTable).set({
        deletedFromCloud: true,
        deletedFromCloudAt: new Date().toISOString(),
        archivedToNas: true,
        nasArchivedAt: new Date().toISOString(),
        nasPath: `minio://${NAS_BUCKET}`,
      }).where(eq(fileTable.id, file.id));

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
    await db.insert(nasSyncLog).values({
      id: createId(),
      status: failedCount === 0 ? 'success' : (deletedCount > 0 ? 'partial' : 'failed'),
      completedAt: new Date().toISOString(),
      bucketName: NAS_BUCKET,
      paths: Array.from(monthsSwept),
      filesCount: deletedCount,
      bytesCount: bytesFreed,
      errorMessage: failedCount > 0 ? `${failedCount} file(s) failed to delete from R2` : null,
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