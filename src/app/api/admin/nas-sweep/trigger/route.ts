export const dynamic = 'force-dynamic';
// src/app/api/admin/nas-sweep/trigger/route.ts
//
// Manual, scoped version of the weekly sweep — pushes NasSweepJobs for
// exactly the files/client requested instead of the whole eligible backlog.
// Same eligibility rules as /api/cron/nas-weekly-sweep, same underlying
// queue (nas-sweep-queue.ts), drained by the same every-minute cron tick.
//
// Body: { fileIds: string[] } — send specific files, or
//       { clientId: string }  — send every eligible file for that client

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable, task as taskTable } from '@/lib/db/schema';
import { and, eq, inArray, not, like } from 'drizzle-orm';
import { createId } from '@/lib/db/id';
import { pushNasSweepJob, startNasSweepBatch } from '@/lib/nas-sweep-queue';
import { getCurrentUser2 } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fileIds, clientId } = body as { fileIds?: string[]; clientId?: string };

    if (!fileIds?.length && !clientId) {
      return NextResponse.json({ error: 'Provide fileIds or clientId' }, { status: 400 });
    }

    const db = getDbHttp();

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
