export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull, ne, inArray } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { createId } from '@/lib/db/id';
import { shootDetail as shootDetailTable, task as taskTable } from '@/lib/db/schema';
import { readShootScriptDocument, writeShootScriptDocument } from '@/lib/shoot-scripts';
import { syncShootScriptsToTasks } from '@/lib/shoot-scripts-sync';

const CAN_SUBMIT = ['admin', 'manager', 'videographer'];

export async function POST(req: NextRequest, props: { params: Promise<{ id: string; scriptId: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_SUBMIT.includes((user.role || '').toLowerCase())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id: shootTaskId, scriptId } = await props.params;
  const db = getDbHttp();
  const [shoot] = await db.select({
    scriptContent: shootDetailTable.scriptContent,
    shootDate: shootDetailTable.shootDate,
    clientId: taskTable.clientId,
    assignedTo: taskTable.assignedTo,
    shootTitle: taskTable.title,
  }).from(shootDetailTable).innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
    .where(eq(shootDetailTable.taskId, shootTaskId)).limit(1);
  if (!shoot) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
  if (!shoot.clientId) return NextResponse.json({ error: 'Assign a client to this shoot before submitting a script' }, { status: 400 });
  const document = readShootScriptDocument(shoot.scriptContent);
  const script = document.scripts.find((entry) => entry.id === scriptId);
  if (!script || !script.content.trim()) return NextResponse.json({ error: 'Write a script before submitting it' }, { status: 400 });

  const now = new Date().toISOString();
  const nextVersion = (script.versions?.length || 0) + 1;
  const versions = [...(script.versions || []), { number: nextVersion, title: script.title || `Video ${nextVersion}`, content: script.content, createdAt: now }];
  const taskTitle = `${shoot.shootTitle || 'Shoot'} — ${script.title || 'Script'}`;
  const reviewPayload = JSON.stringify({ kind: 'shoot-script', scriptId, shootTaskId, versions });
  let reviewTaskId = script.reviewTaskId;

  if (reviewTaskId) {
    const [updated] = await db.update(taskTable).set({ title: taskTitle, textContent: reviewPayload, status: 'CLIENT_REVIEW', nextDestination: 'client', clientReview: true, requiresClientReview: true, updatedAt: now }).where(and(eq(taskTable.id, reviewTaskId), eq(taskTable.clientId, shoot.clientId))).returning({ id: taskTable.id });
    if (!updated) reviewTaskId = undefined;
  }
  if (!reviewTaskId) {
    reviewTaskId = createId();
    await db.insert(taskTable).values({
      id: reviewTaskId,
      title: taskTitle,
      description: `Script review for ${shoot.shootTitle || 'shoot'}`,
      taskType: 'Text Post',
      deliverableType: 'Text Post',
      taskCategory: 'review',
      status: 'CLIENT_REVIEW',
      assignedTo: shoot.assignedTo || user.id,
      createdBy: user.id,
      clientId: shoot.clientId,
      dueDate: shoot.shootDate,
      textContent: reviewPayload,
      requiresClientReview: true,
      clientReview: true,
      nextDestination: 'client',
      updatedAt: now,
    });
  }
  script.reviewTaskId = reviewTaskId;
  script.versions = versions;
  script.status = 'sent';
  script.updatedAt = now;
  await db.update(shootDetailTable).set({ scriptContent: writeShootScriptDocument(document), scriptStatus: 'sent', scriptSentAt: now, scriptSentBy: user.id, updatedAt: now }).where(eq(shootDetailTable.taskId, shootTaskId));

  // ── Sync shoot scripts to production tasks ──────────────────────────────
  await syncShootScriptsToTasks(shootTaskId, db);

  return NextResponse.json({ taskId: reviewTaskId, script });
}

