// src/app/api/shoots/[id]/scripts/link-new/route.ts
//
// Creates a new script AND links it to a specific deliverable task (e.g.
// "SF3") in one atomic step — the deterministic replacement for letting
// syncShootScriptsToTasks guess the link afterward by matching trailing
// digits (which is blind to SF vs LF and can mis-attach when both share a
// number). The script's title is set to the task's own title, so it's
// unambiguous at a glance which slot it belongs to.
//
// syncShootScriptsToTasks still runs on every general document PATCH, but
// since this script's link is written here BEFORE that ever fires, it
// always finds the link already in place and leaves it alone.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable } from '@/lib/db/schema';
import { createShootScript, readShootScriptDocument, writeShootScriptDocument, SCRIPT_TEMPLATES } from '@/lib/shoot-scripts';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: shootTaskId } = await props.params;
  const db = getDbHttp();

  try {
    const body = await req.json();
    const { taskId, template } = body;
    if (!taskId || !Object.keys(SCRIPT_TEMPLATES).includes(template)) {
      return NextResponse.json({ error: 'taskId and a valid template are required' }, { status: 400 });
    }

    const [shoot] = await db.select({ clientId: taskTable.clientId }).from(taskTable).where(eq(taskTable.id, shootTaskId)).limit(1);
    if (!shoot?.clientId) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });

    const [targetTask] = await db.select({ id: taskTable.id, title: taskTable.title, clientId: taskTable.clientId, shootScriptRef: taskTable.shootScriptRef })
      .from(taskTable).where(eq(taskTable.id, taskId)).limit(1);
    if (!targetTask) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (targetTask.clientId !== shoot.clientId) {
      return NextResponse.json({ error: 'That task belongs to a different client' }, { status: 400 });
    }
    if (targetTask.shootScriptRef) {
      return NextResponse.json({ error: 'That task already has a script attached' }, { status: 409 });
    }

    const [shootDetailRow] = await db.select({ scriptContent: shootDetailTable.scriptContent }).from(shootDetailTable).where(eq(shootDetailTable.taskId, shootTaskId)).limit(1);
    if (!shootDetailRow) return NextResponse.json({ error: 'Shoot detail not found' }, { status: 404 });

    const document = readShootScriptDocument(shootDetailRow.scriptContent);
    const script = { ...createShootScript(template, document.scripts.length + 1), title: targetTask.title || 'Untitled' };
    document.scripts.push(script);

    await db.update(shootDetailTable).set({
      scriptContent: writeShootScriptDocument(document),
      updatedAt: new Date().toISOString(),
    }).where(eq(shootDetailTable.taskId, shootTaskId));

    await db.update(taskTable).set({
      shootScriptRef: JSON.stringify({ shootTaskId, scriptId: script.id, scriptTitle: script.title }),
      updatedAt: new Date().toISOString(),
    }).where(eq(taskTable.id, taskId));

    return NextResponse.json({ document, linkedTask: { id: targetTask.id, title: targetTask.title } }, { status: 201 });
  } catch (error: unknown) {
    console.error('[Script Link New] POST error:', error);
    return NextResponse.json({ error: 'Failed to create and link script' }, { status: 500 });
  }
}
