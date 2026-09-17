export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable, monthlyDeliverable as monthlyDeliverableTable, oneOffDeliverable as oneOffDeliverableTable } from '@/lib/db/schema';
import { readShootScriptDocument } from '@/lib/shoot-scripts';

// Roles that can view a script linked to their task
const CAN_VIEW = ['admin', 'manager', 'editor', 'videographer', 'qc', 'scheduler'];

function isSfLf(type?: string | null): boolean {
  if (!type) return false;
  const t = type.toUpperCase().replace(/[\s_-]+/g, '');
  if (t === 'SF' || t === 'LF') return true;
  if (t.startsWith('SF') || t.startsWith('LF')) return true;
  return t.includes('SHORTFORM') || t.includes('LONGFORM') || t.includes('SHORT') || t.includes('LONG');
}

// GET /api/tasks/[id]/script
// Returns the script linked to this production task via shootScriptRef.
// Editors use this while editing; schedulers may view only.
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_VIEW.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: taskId } = await props.params;
  const db = getDbHttp();
  const role = (user.role || '').toLowerCase();

  // Fetch the task to get its shootScriptRef
  const [row] = await db
    .select({
      shootScriptRef: taskTable.shootScriptRef,
      clientId: taskTable.clientId,
      assignedTo: taskTable.assignedTo,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (!row.shootScriptRef) return NextResponse.json({ script: null });

  // Editors / videographers / QC: own assigned tasks only.
  // Schedulers may view scripts on queue tasks (queue is not per-scheduler scoped).
  if (['editor', 'videographer', 'qc'].includes(role) && row.assignedTo !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let ref: { shootTaskId?: string; scriptId?: string; scriptTitle?: string };
  try {
    ref = JSON.parse(row.shootScriptRef);
  } catch {
    return NextResponse.json({ error: 'Invalid script reference' }, { status: 500 });
  }

  if (!ref.shootTaskId || !ref.scriptId) {
    return NextResponse.json({ error: 'Incomplete script reference' }, { status: 500 });
  }

  // Fetch the script content from the shoot
  const [shootRow] = await db
    .select({ scriptContent: shootDetailTable.scriptContent })
    .from(shootDetailTable)
    .where(eq(shootDetailTable.taskId, ref.shootTaskId))
    .limit(1);

  if (!shootRow) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });

  const document = readShootScriptDocument(shootRow.scriptContent);
  const script = document.scripts.find((s) => s.id === ref.scriptId);
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  // Manual linking only — never auto-detach on reject. Editors still see
  // the linked script (including rejected ones) until someone unlinks it.
  return NextResponse.json({
    script: {
      id: script.id,
      title: script.title,
      content: script.content,
      template: script.template,
      status: script.status,
      clientFeedback: script.clientFeedback,
      updatedAt: script.updatedAt,
      createdAt: script.createdAt,
    },
    shootTaskId: ref.shootTaskId,
  });
}

// PATCH /api/tasks/[id]/script — manually link a shoot script to this task.
// Editors may only link to tasks assigned to them. Body:
//   { shootTaskId, scriptId, scriptTitle? } to link
//   { clear: true } to unlink
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (user.role || '').toLowerCase();
  if (!['admin', 'manager', 'videographer', 'editor'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: taskId } = await props.params;
  const body = await req.json();
  const db = getDbHttp();

  const [task] = await db
    .select({
      id: taskTable.id,
      clientId: taskTable.clientId,
      assignedTo: taskTable.assignedTo,
      shootScriptRef: taskTable.shootScriptRef,
      deliverableType: taskTable.deliverableType,
      monthlyType: monthlyDeliverableTable.type,
      oneOffType: oneOffDeliverableTable.type,
    })
    .from(taskTable)
    .leftJoin(monthlyDeliverableTable, eq(taskTable.monthlyDeliverableId, monthlyDeliverableTable.id))
    .leftJoin(oneOffDeliverableTable, eq(taskTable.oneOffDeliverableId, oneOffDeliverableTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  if (role === 'editor' && task.assignedTo !== user.id) {
    return NextResponse.json({ error: 'You can only link scripts to your own tasks' }, { status: 403 });
  }
  if (![task.deliverableType, task.monthlyType, task.oneOffType].some(isSfLf)) {
    return NextResponse.json({ error: 'Scripts can only be attached to SF/LF tasks' }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.clear === true) {
    await db.update(taskTable).set({ shootScriptRef: null, updatedAt: now }).where(eq(taskTable.id, taskId));
    return NextResponse.json({ shootScriptRef: null });
  }

  const { shootTaskId, scriptId, scriptTitle } = body;
  if (!shootTaskId || !scriptId) {
    return NextResponse.json({ error: 'shootTaskId and scriptId are required' }, { status: 400 });
  }

  const [shootTask] = await db
    .select({ clientId: taskTable.clientId })
    .from(taskTable)
    .where(eq(taskTable.id, shootTaskId))
    .limit(1);
  if (!shootTask) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
  if (shootTask.clientId !== task.clientId) {
    return NextResponse.json({ error: 'Script and task must belong to the same client' }, { status: 400 });
  }

  const [shootRow] = await db
    .select({ scriptContent: shootDetailTable.scriptContent })
    .from(shootDetailTable)
    .where(eq(shootDetailTable.taskId, shootTaskId))
    .limit(1);
  if (!shootRow) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });

  const document = readShootScriptDocument(shootRow.scriptContent);
  const script = document.scripts.find((s) => s.id === scriptId);
  if (!script) return NextResponse.json({ error: 'Script not found on that shoot' }, { status: 404 });

  // One script → one task: clear any other task that already holds this scriptId.
  const others = await db
    .select({ id: taskTable.id, shootScriptRef: taskTable.shootScriptRef })
    .from(taskTable)
    .where(and(eq(taskTable.clientId, task.clientId!), isNotNull(taskTable.shootScriptRef)));
  for (const other of others) {
    if (other.id === taskId || !other.shootScriptRef) continue;
    try {
      const ref = JSON.parse(other.shootScriptRef);
      if (ref.scriptId === scriptId) {
        await db.update(taskTable).set({ shootScriptRef: null, updatedAt: now }).where(eq(taskTable.id, other.id));
      }
    } catch { /* ignore */ }
  }

  const shootScriptRef = JSON.stringify({
    shootTaskId,
    scriptId,
    scriptTitle: scriptTitle || script.title || '',
  });
  // Attaching a script is a real Task Action — clears "No Action Required"
  // if it was set.
  await db.update(taskTable).set({ shootScriptRef, noActionRequired: false, updatedAt: now }).where(eq(taskTable.id, taskId));
  return NextResponse.json({ shootScriptRef: JSON.parse(shootScriptRef) });
}