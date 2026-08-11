export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nasSyncLog, file as fileTable, task as taskTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, count, desc, eq, inArray } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    // ── Auth: verify webhook secret ───────────────────────
    const secret = req.headers.get('x-webhook-secret');
    const expectedSecret = process.env.NAS_WEBHOOK_SECRET;

    if (!expectedSecret) {
      console.error('[NAS Webhook] NAS_WEBHOOK_SECRET not set in env');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (secret !== expectedSecret) {
      console.warn('[NAS Webhook] Invalid secret received');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse body ────────────────────────────────────────
    const body = await req.json();
    const { status, completedAt, bucketName, paths, filesCount, bytesCount, errorMessage } = body;

    if (!status || !completedAt) {
      return NextResponse.json({ error: 'Missing required fields: status, completedAt' }, { status: 400 });
    }

    console.log(`[NAS Webhook] Received backup report: status=${status} completedAt=${completedAt}`);

    // ── Save sync log ─────────────────────────────────────
    const [log] = await db.insert(nasSyncLog).values({
      id: createId(),
      status,
      completedAt: new Date(completedAt).toISOString(),
      bucketName: bucketName || null,
      paths: paths || [],
      filesCount: filesCount ? Number(filesCount) : null,
      bytesCount: bytesCount ? Number(bytesCount) : null,
      errorMessage: errorMessage || null,
    }).returning();

    // ── If success: mark files as archivedToNas ───────────
    if (status === 'success') {
      // Mark all files that belong to completed/approved tasks as archived
      const eligibleTaskIds = db.select({ id: taskTable.id }).from(taskTable)
        .where(inArray(taskTable.status, ['COMPLETED', 'SCHEDULED', 'POSTED', 'READY_FOR_QC'] as any));

      const updated = await db.update(fileTable)
        .set({
          archivedToNas: true,
          nasArchivedAt: new Date(completedAt).toISOString(),
          nasPath: `/volume2/Backup/outputs`,
        })
        .where(and(
          eq(fileTable.archivedToNas, false),
          inArray(fileTable.taskId, eligibleTaskIds),
        ))
        .returning({ id: fileTable.id });

      console.log(`[NAS Webhook] Marked ${updated.length} files as archivedToNas`);
    }

    return NextResponse.json({
      ok: true,
      logId: log.id,
      message: `Backup ${status} recorded`,
    });

  } catch (err: any) {
    console.error('[NAS Webhook] Error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── GET: last sync status (for admin panel polling) ───────────────────────────
export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get('x-webhook-secret') || req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.NAS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [logs, totalFilesResult, archivedFilesResult] = await Promise.all([
      db.select().from(nasSyncLog).orderBy(desc(nasSyncLog.completedAt)).limit(20),
      db.select({ value: count() }).from(fileTable),
      db.select({ value: count() }).from(fileTable).where(eq(fileTable.archivedToNas, true)),
    ]);
    const totalFiles = totalFilesResult[0].value;
    const archivedFiles = archivedFilesResult[0].value;

    return NextResponse.json({
      logs: logs.map(l => ({
        ...l,
        bytesCount: l.bytesCount ? Number(l.bytesCount) : null,
      })),
      stats: {
        totalFiles,
        archivedFiles,
        pendingFiles: totalFiles - archivedFiles,
        lastSync: logs[0] || null,
      },
    });
  } catch (err: any) {
    console.error('[NAS GET] Error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}