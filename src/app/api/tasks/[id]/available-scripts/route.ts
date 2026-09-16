export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import {
  shootDetail as shootDetailTable,
  task as taskTable,
  monthlyDeliverable as monthlyDeliverableTable,
  oneOffDeliverable as oneOffDeliverableTable,
} from '@/lib/db/schema';
import { readShootScriptDocument } from '@/lib/shoot-scripts';

function isSfLf(type?: string | null): boolean {
  if (!type) return false;
  const t = type.toUpperCase().replace(/[\s_-]+/g, '');
  if (t === 'SF' || t === 'LF') return true;
  if (t.startsWith('SF') || t.startsWith('LF')) return true;
  return t.includes('SHORTFORM') || t.includes('LONGFORM') || t.includes('SHORT') || t.includes('LONG');
}

// GET /api/tasks/[id]/available-scripts
// Unlinked shoot scripts for this task's client (any status). SF/LF tasks only.
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (user.role || '').toLowerCase();
  if (!['admin', 'manager', 'videographer', 'editor'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: taskId } = await props.params;
  const db = getDbHttp();

  const [task] = await db
    .select({
      id: taskTable.id,
      clientId: taskTable.clientId,
      assignedTo: taskTable.assignedTo,
      deliverableType: taskTable.deliverableType,
      monthlyType: monthlyDeliverableTable.type,
      oneOffType: oneOffDeliverableTable.type,
      shootScriptRef: taskTable.shootScriptRef,
    })
    .from(taskTable)
    .leftJoin(monthlyDeliverableTable, eq(taskTable.monthlyDeliverableId, monthlyDeliverableTable.id))
    .leftJoin(oneOffDeliverableTable, eq(taskTable.oneOffDeliverableId, oneOffDeliverableTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (role === 'editor' && task.assignedTo !== user.id) {
    return NextResponse.json({ error: 'You can only list scripts for your own tasks' }, { status: 403 });
  }
  if (!task.clientId) {
    return NextResponse.json({ error: 'Task has no client' }, { status: 400 });
  }
  if (![task.deliverableType, task.monthlyType, task.oneOffType].some(isSfLf)) {
    return NextResponse.json({ error: 'Scripts can only be attached to SF/LF tasks' }, { status: 400 });
  }

  const linkedKeys = new Set<string>();
  const linkedRows = await db
    .select({ id: taskTable.id, shootScriptRef: taskTable.shootScriptRef })
    .from(taskTable)
    .where(and(eq(taskTable.clientId, task.clientId), isNotNull(taskTable.shootScriptRef)));

  for (const row of linkedRows) {
    if (!row.shootScriptRef || row.id === taskId) continue;
    try {
      const ref = JSON.parse(row.shootScriptRef) as { shootTaskId?: string; scriptId?: string };
      if (ref.shootTaskId && ref.scriptId) linkedKeys.add(`${ref.shootTaskId}::${ref.scriptId}`);
    } catch {
      /* ignore */
    }
  }

  const shoots = await db
    .select({
      taskId: shootDetailTable.taskId,
      shootDate: shootDetailTable.shootDate,
      scriptContent: shootDetailTable.scriptContent,
      title: taskTable.title,
    })
    .from(shootDetailTable)
    .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
    .where(eq(taskTable.clientId, task.clientId))
    .orderBy(desc(shootDetailTable.shootDate));

  const scripts = shoots.flatMap((shoot) => {
    const doc = readShootScriptDocument(shoot.scriptContent);
    return doc.scripts
      .filter((script) => !linkedKeys.has(`${shoot.taskId}::${script.id}`))
      .map((script) => ({
        id: script.id,
        title: script.title || 'Untitled script',
        status: script.status,
        shootTaskId: shoot.taskId,
        shootTitle: shoot.title,
        shootDate: shoot.shootDate,
      }));
  });

  let current: { shootTaskId: string; scriptId: string; scriptTitle: string } | null = null;
  if (task.shootScriptRef) {
    try {
      const ref = JSON.parse(task.shootScriptRef) as {
        shootTaskId?: string;
        scriptId?: string;
        scriptTitle?: string;
      };
      if (ref.shootTaskId && ref.scriptId) {
        current = {
          shootTaskId: ref.shootTaskId,
          scriptId: ref.scriptId,
          scriptTitle: ref.scriptTitle || 'Linked script',
        };
      }
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ scripts, current });
}
