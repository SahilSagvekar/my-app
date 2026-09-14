// src/app/api/admin/backfill-raw-footage-folders/route.ts
//
// ONE-TIME backfill — creates RawFootageFolder rows (+ physical R2 folders)
// for SF/LF deliverable tasks that were already created THIS month, before
// the raw-footage-folder auto-numbering hook existed in generateMonthly.ts.
//
// Going forward, every NEW month's tasks get this automatically at
// creation time — this route only exists to catch up tasks created before
// that hook was added. Safe to re-run: assignRawFootageFolderForTask()
// reuses an existing row instead of duplicating it if a slot already
// exists for that (client, month, code, number).
//
// The folder number is recovered from the task's own title, since that's
// where generateMonthly.ts already put it (e.g. "AcmeCorp_09-01-2026_SF3"
// -> code "SF", number 3) — the exact same source of truth the live
// generation code uses, so a backfilled folder can never disagree with
// how the task was actually numbered.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNotNull, or } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { task as taskTable, client as clientTable } from '@/lib/db/schema';
import { assignRawFootageFolderForTask, toFolderCode } from '@/lib/raw-footage-folders';

function currentMonthFolder(): string {
  const now = new Date();
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  return `${month}-${now.getFullYear()}`; // matches generateMonthly.ts's format exactly
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((user.role || '').toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDbHttp();
  try {
    const body = await req.json().catch(() => ({}));
    const monthFolder: string = body.monthFolder || currentMonthFolder();

    // Only tasks tagged SF/LF for this month — everything else
    // (thumbnails, hard posts, etc.) is out of scope for this feature.
    const tasks = await db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        clientId: taskTable.clientId,
        deliverableType: taskTable.deliverableType,
      })
      .from(taskTable)
      .where(and(
        eq(taskTable.monthFolder, monthFolder),
        or(eq(taskTable.deliverableType, 'SF'), eq(taskTable.deliverableType, 'LF')),
        isNotNull(taskTable.clientId),
      ));

    if (!tasks.length) {
      return NextResponse.json({ monthFolder, processed: 0, results: [], note: 'No SF/LF tasks found for this month' });
    }

    // Cache companyName per client so we don't re-query it per task.
    const clientIds = [...new Set(tasks.map((t) => t.clientId!))];
    const clients = await db.select({ id: clientTable.id, companyName: clientTable.companyName, name: clientTable.name })
      .from(clientTable);
    const companyNameById = new Map(clients.filter(c => clientIds.includes(c.id)).map((c) => [c.id, c.companyName || c.name]));

    const results: Array<{ taskId: string; title: string; status: string }> = [];

    for (const t of tasks) {
      const code = toFolderCode(t.deliverableType!);
      if (!code) { results.push({ taskId: t.id, title: t.title, status: 'skipped (not SF/LF)' }); continue; }

      // Recover the number from the title's trailing "<code><digits>".
      const match = t.title?.match(new RegExp(`${code}(\\d+)$`));
      if (!match) { results.push({ taskId: t.id, title: t.title, status: 'skipped (could not parse folder number from title)' }); continue; }
      const number = parseInt(match[1], 10);

      const companyName = companyNameById.get(t.clientId!);
      if (!companyName) { results.push({ taskId: t.id, title: t.title, status: 'skipped (client not found)' }); continue; }

      try {
        await assignRawFootageFolderForTask({
          clientId: t.clientId!,
          companyName,
          monthFolder,
          deliverableSlug: code,
          number,
          taskId: t.id,
        });
        results.push({ taskId: t.id, title: t.title, status: `assigned ${code}${number}` });
      } catch (err) {
        console.error(`[Backfill Raw Footage Folders] Failed for task ${t.id}:`, err);
        results.push({ taskId: t.id, title: t.title, status: 'error — see server logs' });
      }
    }

    return NextResponse.json({ monthFolder, processed: results.length, results });
  } catch (error: unknown) {
    console.error('[Backfill Raw Footage Folders] error:', error);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}
