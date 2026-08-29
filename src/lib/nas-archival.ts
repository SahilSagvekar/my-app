// src/lib/nas-archival.ts
// Read-only reporting: identifies output files old enough and verified on
// NAS that a human might want to manually clean up from R2. This never
// deletes anything itself — per admin decision, R2 deletion only ever
// happens as an explicit manual action elsewhere, never automatically.
// Raw footage/elements are out of scope here entirely (never touched).

import { getDbHttp } from '@/lib/db';
import { file as fileTable, task as taskTable } from '@/lib/db/schema';
import { and, eq, inArray, isNotNull, not, like } from 'drizzle-orm';
import { headObjectOnNas } from '@/lib/nas-s3';

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
  outcome: 'eligible_confirmed_on_nas' | 'skipped_not_on_nas';
  reason?: string;
}

export interface SweepSummary {
  clientId: string | null;
  cutoffMonthFolder: string;
  eligibleCount: number;
  confirmedOnNasCount: number;
  skippedCount: number;
  bytesEligible: number;
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

/**
 * Read-only report of output files old enough to be considered for cleanup
 * and confirmed present on NAS. Does NOT delete anything — the caller (or a
 * human admin) decides what, if anything, to do with this list manually.
 */
export async function runNasArchivalSweep(opts: { clientId?: string | null }): Promise<SweepSummary> {
  const db = getDbHttp();
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
  let confirmedOnNasCount = 0;
  let skippedCount = 0;
  let bytesEligible = 0;

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

    confirmedOnNasCount++;
    bytesEligible += sizeBytes;
    monthsSwept.add(monthFolder);
    results.push({ fileId: file.id, s3Key, taskId: file.taskId, monthFolder, sizeBytes, outcome: 'eligible_confirmed_on_nas' });
  }

  return {
    clientId: opts.clientId || null,
    cutoffMonthFolder,
    eligibleCount: eligible.length,
    confirmedOnNasCount,
    skippedCount,
    bytesEligible,
    monthsSwept: Array.from(monthsSwept),
    results,
  };
}