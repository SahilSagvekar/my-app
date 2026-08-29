export const dynamic = 'force-dynamic';
// src/app/api/admin/nas-sweep/trigger/route.ts
//
// Manual, scoped version of the sweep — pushes NasSweepJobs for exactly the
// files/client requested. Same underlying queue (nas-sweep-queue.ts),
// drained by the same every-minute cron tick, for all three folder types.
//
// Body: { fileIds: string[], folderType? }  — send specific files, or
//       { clientId: string, folderType? }   — send every eligible file for that client
// folderType defaults to "outputs". For "raw-footage"/"elements", fileIds
// refer to NasBackupRecord ids (as returned by the browse route), not File ids.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable, task as taskTable, nasBackupRecord } from '@/lib/db/schema';
import { and, eq, inArray, not, like } from 'drizzle-orm';
import { createId } from '@/lib/db/id';
import { pushNasSweepJob, startNasSweepBatch } from '@/lib/nas-sweep-queue';
import { listTrackedFiles } from '@/lib/nas-backup-records';
import { getCurrentUser2 } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fileIds, clientId } = body as { fileIds?: string[]; clientId?: string };
    const folderType = (body.folderType || 'outputs') as 'outputs' | 'raw-footage' | 'elements';

    if (!fileIds?.length && !clientId) {
      return NextResponse.json({ error: 'Provide fileIds or clientId' }, { status: 400 });
    }

    const db = getDbHttp();

    // ── raw-footage / elements — tracked via NasBackupRecord ──
    if (folderType === 'raw-footage' || folderType === 'elements') {
      let eligible: { id: string; s3Key: string; name: string; size: number }[];

      if (fileIds?.length) {
        const rows = await db.select().from(nasBackupRecord).where(and(
          inArray(nasBackupRecord.id, fileIds),
          eq(nasBackupRecord.archivedToNas, false),
        ));
        eligible = rows.map((r) => ({ id: r.id, s3Key: r.s3Key, name: r.fileName, size: r.fileSize || 0 }));
      } else {
        const all = await listTrackedFiles(clientId!, folderType);
        eligible = all
          .filter((f) => !f.archivedToNas)
          .map((f) => ({ id: f.backupRecordId, s3Key: f.s3Key, name: f.fileName, size: f.fileSize }));
      }

      if (eligible.length === 0) {
        return NextResponse.json({ ok: true, message: 'Nothing eligible to send.', queued: 0, fileIds: [] });
      }

      const batchId = createId();
      await startNasSweepBatch(batchId, eligible.length);

      for (const f of eligible) {
        await pushNasSweepJob({
          backupRecordId: f.id,
          s3Key: f.s3Key,
          fileName: f.name,
          fileSize: f.size,
          destPath: f.s3Key,
          batchId,
          batchTotal: eligible.length,
        });
      }

      return NextResponse.json({
        ok: true,
        message: `Queued ${eligible.length} file(s) for NAS backup.`,
        queued: eligible.length,
        batchId,
        fileIds: eligible.map((f) => f.id),
      });
    }

    // ── outputs — tracked via File, unchanged from before ──
    let candidates;
    if (fileIds?.length) {
      candidates = await db
        .select({ id: fileTable.id, s3Key: fileTable.s3Key, name: fileTable.name, size: fileTable.size })
        .from(fileTable)
        .where(and(
          inArray(fileTable.id, fileIds),
          eq(fileTable.isActive, true),
          not(eq(fileTable.deletedFromCloud, true)),
        ));
    } else {
      candidates = await db
        .select({ id: fileTable.id, s3Key: fileTable.s3Key, name: fileTable.name, size: fileTable.size })
        .from(fileTable)
        .innerJoin(taskTable, eq(fileTable.taskId, taskTable.id))
        .where(and(
          eq(taskTable.clientId, clientId!),
          eq(fileTable.isActive, true),
          not(eq(fileTable.deletedFromCloud, true)),
          not(like(fileTable.s3Key, '%raw-footage%')),
        ));
    }

    const eligible = candidates.filter((f) => !!f.s3Key);

    if (eligible.length === 0) {
      return NextResponse.json({ ok: true, message: 'Nothing eligible to send.', queued: 0, fileIds: [] });
    }

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

    return NextResponse.json({
      ok: true,
      message: `Queued ${eligible.length} file(s) for NAS backup.`,
      queued: eligible.length,
      batchId,
      fileIds: eligible.map((f) => f.id),
    });
  } catch (err: any) {
    console.error('[NAS Manual Trigger] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Trigger failed' }, { status: 500 });
  }
}