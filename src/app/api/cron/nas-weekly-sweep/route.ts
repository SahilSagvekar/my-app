export const dynamic = 'force-dynamic';
// src/app/api/cron/nas-weekly-sweep/route.ts
// Populates the NAS sweep queue with every active, not-yet-archived file
// across all three categories: outputs (from the File table), and
// raw-footage/elements (listed directly from R2 per client, tracked via
// NasBackupRecord — see nas-backup-records.ts).
// Copy-only: never touches or deletes anything in R2. Called weekly by the
// Saturday Cron Trigger (see worker.ts), same auth pattern as the other
// /api/cron/* routes.
//
// Actual copying happens asynchronously afterward, drained by the
// every-minute tick (/api/cron/tick-queues) via nas-sweep-worker.ts — this
// route just enqueues and returns immediately.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable } from '@/lib/db/schema';
import { and, eq, isNull, or, not, like } from 'drizzle-orm';
import { createId } from '@/lib/db/id';
import { pushNasSweepJob, startNasSweepBatch } from '@/lib/nas-sweep-queue';
import { listTrackedFiles, getClientsWithTrackedFolders } from '@/lib/nas-backup-records';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  return !!(cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET);
}

async function sweepOutputs(): Promise<number> {
  const db = getDbHttp();
  const candidates = await db
    .select({
      id: fileTable.id,
      s3Key: fileTable.s3Key,
      name: fileTable.name,
      size: fileTable.size,
      taskId: fileTable.taskId,
    })
    .from(fileTable)
    .where(and(
      eq(fileTable.isActive, true),
      or(eq(fileTable.archivedToNas, false), isNull(fileTable.archivedToNas)),
      not(eq(fileTable.deletedFromCloud, true)),
      not(like(fileTable.s3Key, '%raw-footage%')),
    ))
    .limit(2000); // safety cap per sweep — anything left over gets picked up next Saturday

  const eligible = candidates.filter((f) => !!f.s3Key);
  if (eligible.length === 0) return 0;

  const batchId = createId();
  await startNasSweepBatch(batchId, eligible.length);

  for (const f of eligible) {
    await pushNasSweepJob({
      fileId: f.id,
      s3Key: f.s3Key!,
      fileName: f.name,
      fileSize: f.size,
      destPath: f.s3Key!,
      batchId,
      batchTotal: eligible.length,
    });
  }
  return eligible.length;
}

async function sweepTrackedFolderType(folderType: 'raw-footage' | 'elements'): Promise<number> {
  const clients = await getClientsWithTrackedFolders(folderType);
  let totalQueued = 0;

  for (const client of clients) {
    const files = await listTrackedFiles(client.id, folderType);
    const eligible = files.filter((f) => !f.archivedToNas);
    if (eligible.length === 0) continue;

    const batchId = createId();
    await startNasSweepBatch(batchId, eligible.length);

    for (const f of eligible) {
      await pushNasSweepJob({
        backupRecordId: f.backupRecordId,
        s3Key: f.s3Key,
        fileName: f.fileName,
        fileSize: f.fileSize,
        destPath: f.s3Key,
        batchId,
        batchTotal: eligible.length,
      });
    }
    totalQueued += eligible.length;
  }

  return totalQueued;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [outputsQueued, rawFootageQueued, elementsQueued] = await Promise.all([
      sweepOutputs(),
      sweepTrackedFolderType('raw-footage'),
      sweepTrackedFolderType('elements'),
    ]);

    const total = outputsQueued + rawFootageQueued + elementsQueued;
    if (total === 0) {
      return NextResponse.json({ ok: true, message: 'Nothing to sweep — everything already archived.', queued: 0 });
    }

    return NextResponse.json({
      ok: true,
      message: `Queued ${total} file(s) for NAS backup (${outputsQueued} outputs, ${rawFootageQueued} raw-footage, ${elementsQueued} elements).`,
      queued: total,
      breakdown: { outputs: outputsQueued, rawFootage: rawFootageQueued, elements: elementsQueued },
    });
  } catch (err: any) {
    console.error('[NAS Weekly Sweep] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Sweep population failed' }, { status: 500 });
  }
}