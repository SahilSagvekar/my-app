export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull, ne, inArray } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { createId } from '@/lib/db/id';
import { shootDetail as shootDetailTable, task as taskTable } from '@/lib/db/schema';
import { readShootScriptDocument, writeShootScriptDocument } from '@/lib/shoot-scripts';

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

  // ── Link this script to a matching editor production task ──────────────────
  // Find production tasks for this client that are not review tasks and don't
  // yet have a script linked. Match by "Video N" number in the script title,
  // falling back to the first available unlinked task.
  try {
    const scriptRef = JSON.stringify({ shootTaskId, scriptId, scriptTitle: script.title || '' });

    // Fetch unlinked production tasks for the client
    const candidateTasks = await db
      .select({ id: taskTable.id, title: taskTable.title })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.clientId, shoot.clientId),
          isNull(taskTable.shootScriptRef),
          ne(taskTable.taskCategory ?? 'none', 'review'),
          inArray(taskTable.status, ['PENDING', 'IN_PROGRESS']),
        )
      )
      .limit(50);

    if (candidateTasks.length > 0) {
      // Try to match by number at end of script title (e.g. "Video 3" → task ending in "3")
      const scriptNumberMatch = (script.title || '').match(/(\d+)$/);
      const scriptNumber = scriptNumberMatch ? parseInt(scriptNumberMatch[1]) : null;

      let targetTaskId: string | null = null;
      if (scriptNumber !== null) {
        const matched = candidateTasks.find((t) => {
          const tMatch = (t.title || '').match(/(\d+)$/);
          return tMatch && parseInt(tMatch[1]) === scriptNumber;
        });
        targetTaskId = matched?.id ?? null;
      }
      // Fallback to first unlinked task
      if (!targetTaskId) {
        targetTaskId = candidateTasks[0].id;
      }

      if (targetTaskId) {
        await db.update(taskTable).set({ shootScriptRef: scriptRef, updatedAt: now }).where(eq(taskTable.id, targetTaskId));
      }
    }
  } catch (linkErr) {
    // Non-fatal — script submission itself succeeded; linking is best-effort
    console.error('[Scripts] Failed to link script to production task:', linkErr);
  }

  return NextResponse.json({ taskId: reviewTaskId, script });
}
