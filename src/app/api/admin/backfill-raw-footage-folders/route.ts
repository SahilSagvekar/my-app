export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import {
  task as taskTable,
  client as clientTable,
  monthlyDeliverable as monthlyDeliverableTable,
  rawFootageFolder as rawFootageFolderTable,
} from '@/lib/db/schema';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { assignRawFootageFolderForTask } from '@/lib/raw-footage-folders';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/backfill-raw-footage-folders
//
// One-time repair for a gap in /api/tasks/recurring/run (now fixed
// alongside this route): that monthly cron created SF/LF task rows but
// never called assignRawFootageFolderForTask, so only the very first task
// ever created for a deliverable (the manually-created "master template",
// via generateMonthlyTasksFromTemplate) ever got a real raw-footage folder
// + RawFootageFolder DB row. Every task the cron generated since then has a
// task row and a script-quota slot, but no folder — which is why the
// "Which deliverable is this for?" script picker and the raw-footage view
// only ever show the one original slot per deliverable.
//
// This finds every SF/LF task missing its RawFootageFolder link and
// creates it, reusing assignRawFootageFolderForTask so behavior (and the
// unique client+month+code+number slot, and reuse-if-slot-exists logic)
// exactly matches what task-creation-time assignment would have done.
//
// Body: { clientId?: string, dryRun?: boolean }
//   - clientId omitted -> backfills every active client
//   - dryRun: true     -> reports what it WOULD assign, creates nothing
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    await requireAdmin(req);

    const { clientId, dryRun }: { clientId?: string; dryRun?: boolean } = await req.json().catch(() => ({}));

    const conditions = [
      inArray(taskTable.deliverableType, ['SF', 'LF']),
      isNotNull(taskTable.monthlyDeliverableId),
      isNotNull(taskTable.monthFolder),
      isNotNull(taskTable.clientId),
      isNull(rawFootageFolderTable.id), // anti-join: no RawFootageFolder references this task yet
    ];
    if (clientId) conditions.push(eq(taskTable.clientId, clientId));

    const rows = await db.select({
      taskId: taskTable.id,
      title: taskTable.title,
      clientId: taskTable.clientId,
      companyName: clientTable.companyName,
      clientName: clientTable.name,
      monthFolder: taskTable.monthFolder,
      deliverableSlug: taskTable.deliverableType,
      deliverableType: monthlyDeliverableTable.type,
    })
      .from(taskTable)
      .leftJoin(rawFootageFolderTable, eq(rawFootageFolderTable.taskId, taskTable.id))
      .innerJoin(clientTable, eq(clientTable.id, taskTable.clientId))
      .leftJoin(monthlyDeliverableTable, eq(monthlyDeliverableTable.id, taskTable.monthlyDeliverableId))
      .where(and(...conditions));

    const results: { taskId: string; title: string | null; ok: boolean; reason?: string }[] = [];

    // Sequential on purpose — assignRawFootageFolderForTask does a
    // read-then-maybe-write against a unique (client, month, code, number)
    // slot; running these concurrently for the same client+month risks two
    // tasks racing for the same slot number.
    for (const row of rows) {
      const match = row.title?.match(/(SF|LF)(\d+)$/);
      if (!match) {
        results.push({ taskId: row.taskId, title: row.title, ok: false, reason: 'Could not parse SF/LF number from task title' });
        continue;
      }
      const number = parseInt(match[2], 10);
      const companyName = (row.companyName || row.clientName || '').trim();
      if (!companyName || !row.clientId || !row.monthFolder || !row.deliverableSlug) {
        results.push({ taskId: row.taskId, title: row.title, ok: false, reason: 'Missing clientId/companyName/monthFolder/deliverableSlug' });
        continue;
      }

      if (dryRun) {
        results.push({ taskId: row.taskId, title: row.title, ok: true, reason: `Would assign ${row.deliverableSlug}${number} in ${row.monthFolder}` });
        continue;
      }

      const assigned = await assignRawFootageFolderForTask({
        clientId: row.clientId,
        companyName,
        monthFolder: row.monthFolder,
        deliverableSlug: row.deliverableSlug,
        deliverableType: row.deliverableType || undefined,
        number,
        taskId: row.taskId,
      });

      results.push({
        taskId: row.taskId,
        title: row.title,
        ok: !!assigned,
        reason: assigned ? undefined : 'assignRawFootageFolderForTask returned null — check server logs',
      });
    }

    const assignedCount = results.filter(r => r.ok).length;
    const failedCount = results.filter(r => !r.ok).length;

    return NextResponse.json({
      scanned: rows.length,
      assigned: assignedCount,
      failed: failedCount,
      dryRun: !!dryRun,
      results,
    });
  } catch (err: any) {
    console.error('backfill-raw-footage-folders error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/backfill-raw-footage-folders
// Same scan as the POST, but read-only — lets the admin see the damage
// before running the real thing (equivalent to POST with dryRun: true, but
// with no request body needed, e.g. for a quick curl/browser check).
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId') || undefined;

    const conditions = [
      inArray(taskTable.deliverableType, ['SF', 'LF']),
      isNotNull(taskTable.monthlyDeliverableId),
      isNotNull(taskTable.monthFolder),
      isNotNull(taskTable.clientId),
      isNull(rawFootageFolderTable.id),
    ];
    if (clientId) conditions.push(eq(taskTable.clientId, clientId));

    const rows = await db.select({
      taskId: taskTable.id,
      title: taskTable.title,
      companyName: clientTable.companyName,
      clientName: clientTable.name,
      monthFolder: taskTable.monthFolder,
      deliverableSlug: taskTable.deliverableType,
    })
      .from(taskTable)
      .leftJoin(rawFootageFolderTable, eq(rawFootageFolderTable.taskId, taskTable.id))
      .innerJoin(clientTable, eq(clientTable.id, taskTable.clientId))
      .where(and(...conditions));

    const byClient: Record<string, { count: number; titles: string[] }> = {};
    for (const row of rows) {
      const name = row.companyName || row.clientName || 'Unknown';
      if (!byClient[name]) byClient[name] = { count: 0, titles: [] };
      byClient[name].count++;
      byClient[name].titles.push(row.title || row.taskId);
    }

    return NextResponse.json({ missingCount: rows.length, byClient });
  } catch (err: any) {
    console.error('backfill-raw-footage-folders GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}