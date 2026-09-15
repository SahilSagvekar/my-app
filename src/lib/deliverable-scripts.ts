// src/lib/deliverable-scripts.ts
//
// One script per (clientId, monthFolder, code, number) deliverable slot —
// the auto-generated counterpart to the existing per-shoot ShootScript
// system (src/lib/shoot-scripts.ts). Created by ensureDeliverableScript
// alongside the raw-footage folder + editor task during monthly generation
// (see src/lib/recurring/generateMonthly.ts), when Client.scriptsRequired
// is true. Because all three rows share the same (clientId, monthFolder,
// code, number) key, folder <-> task <-> script are linked by construction
// — no trailing-digit guessing the way the older per-shoot flow needs.

import { and, eq } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { deliverableScript as deliverableScriptTable, task as taskTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { toFolderCode } from '@/lib/raw-footage-folders';
import { SCRIPT_TEMPLATES, type ScriptStatus } from '@/lib/shoot-scripts';
import { formatDateMMDDYYYY } from '@/lib/recurring/generateMonthly';

export interface DeliverableScriptVersion {
  number: number;
  title: string;
  content: string;
  createdAt: string;
}

/**
 * Idempotent — safe to call every time a monthly SF/LF task is (re)created.
 * Reuses the existing row for this slot if one exists (just re-pointing it
 * at the current folder/task, in case a manual relink moved things since),
 * otherwise creates a fresh draft. No-op for non-SF/LF deliverables, same
 * gate as assignRawFootageFolderForTask.
 */
export async function ensureDeliverableScript(params: {
  clientId: string;
  companyName: string;
  monthFolder: string;
  deliverableSlug: string;
  number: number;
  taskId: string;
  rawFootageFolderId: string;
}): Promise<{ id: string } | null> {
  const code = toFolderCode(params.deliverableSlug);
  if (!code) return null;

  const db = getDbHttp();
  try {
    const [existing] = await db.select({ id: deliverableScriptTable.id })
      .from(deliverableScriptTable)
      .where(and(
        eq(deliverableScriptTable.clientId, params.clientId),
        eq(deliverableScriptTable.monthFolder, params.monthFolder),
        eq(deliverableScriptTable.code, code),
        eq(deliverableScriptTable.number, params.number),
      )).limit(1);

    if (existing) {
      await db.update(deliverableScriptTable).set({
        taskId: params.taskId,
        rawFootageFolderId: params.rawFootageFolderId,
        updatedAt: new Date().toISOString(),
      }).where(eq(deliverableScriptTable.id, existing.id));
      return { id: existing.id };
    }

    const companyNameSlug = params.companyName.replace(/\s/g, '');
    const createdAtStr = formatDateMMDDYYYY(new Date());
    const title = `${companyNameSlug}-${createdAtStr}-${code}-${params.number}`;
    const id = createId();
    await db.insert(deliverableScriptTable).values({
      id,
      clientId: params.clientId,
      monthFolder: params.monthFolder,
      code,
      number: params.number,
      rawFootageFolderId: params.rawFootageFolderId,
      taskId: params.taskId,
      title,
      content: SCRIPT_TEMPLATES.overall.content,
      template: 'overall',
      status: 'draft',
      updatedAt: new Date().toISOString(),
    });
    return { id };
  } catch (error) {
    // Deliberately swallowed — same contract as assignRawFootageFolderForTask:
    // a script-creation hiccup must never break monthly task generation.
    console.error('[deliverable-scripts] ensureDeliverableScript failed:', error);
    return null;
  }
}

/** Manual reconciliation — point a script at a different folder/task, or clear the task link. */
export async function reassignDeliverableScript(scriptId: string, params: { taskId?: string | null; rawFootageFolderId?: string }) {
  const db = getDbHttp();
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (params.taskId !== undefined) set.taskId = params.taskId;
  if (params.rawFootageFolderId !== undefined) set.rawFootageFolderId = params.rawFootageFolderId;
  const [updated] = await db.update(deliverableScriptTable).set(set).where(eq(deliverableScriptTable.id, scriptId)).returning();
  return updated ?? null;
}

/** Staff content/title/template edit (autosave target). */
export async function updateDeliverableScriptContent(scriptId: string, patch: { title?: string; content?: string; template?: keyof typeof SCRIPT_TEMPLATES }) {
  const db = getDbHttp();
  const [updated] = await db.update(deliverableScriptTable).set({
    ...patch,
    updatedAt: new Date().toISOString(),
  }).where(eq(deliverableScriptTable.id, scriptId)).returning();
  return updated ?? null;
}

/**
 * Submit to client — same create-or-reuse CLIENT_REVIEW task pattern as the
 * per-shoot submit route (src/app/api/shoots/[id]/scripts/[scriptId]/submit/route.ts),
 * ported to a single DeliverableScript row instead of a JSON document.
 */
export async function submitDeliverableScript(scriptId: string, userId: number) {
  const db = getDbHttp();
  const [row] = await db.select({
    id: deliverableScriptTable.id,
    clientId: deliverableScriptTable.clientId,
    title: deliverableScriptTable.title,
    content: deliverableScriptTable.content,
    versions: deliverableScriptTable.versions,
    reviewTaskId: deliverableScriptTable.reviewTaskId,
    taskId: deliverableScriptTable.taskId,
    taskTitle: taskTable.title,
    taskAssignedTo: taskTable.assignedTo,
  }).from(deliverableScriptTable)
    .leftJoin(taskTable, eq(deliverableScriptTable.taskId, taskTable.id))
    .where(eq(deliverableScriptTable.id, scriptId)).limit(1);

  if (!row) return { error: 'Script not found' as const };
  if (!row.content?.trim()) return { error: 'Write a script before submitting it' as const };

  const now = new Date().toISOString();
  const existingVersions = ((row.versions as DeliverableScriptVersion[] | null) || []);
  const nextVersion = existingVersions.length + 1;
  const versions = [...existingVersions, { number: nextVersion, title: row.title, content: row.content, createdAt: now }];
  const reviewTaskTitle = `${row.taskTitle || 'Deliverable'} — Script`;
  const reviewPayload = JSON.stringify({ kind: 'deliverable-script', scriptId, versions });
  let reviewTaskId = row.reviewTaskId ?? undefined;

  if (reviewTaskId) {
    const [updated] = await db.update(taskTable).set({
      title: reviewTaskTitle,
      textContent: reviewPayload,
      status: 'CLIENT_REVIEW',
      nextDestination: 'client',
      clientReview: true,
      requiresClientReview: true,
      updatedAt: now,
    }).where(and(eq(taskTable.id, reviewTaskId), eq(taskTable.clientId, row.clientId))).returning({ id: taskTable.id });
    if (!updated) reviewTaskId = undefined;
  }
  if (!reviewTaskId) {
    reviewTaskId = createId();
    await db.insert(taskTable).values({
      id: reviewTaskId,
      title: reviewTaskTitle,
      description: `Script review for ${row.taskTitle || 'deliverable'}`,
      taskType: 'Text Post',
      deliverableType: 'Text Post',
      taskCategory: 'review',
      status: 'CLIENT_REVIEW',
      assignedTo: row.taskAssignedTo || userId,
      createdBy: userId,
      clientId: row.clientId,
      textContent: reviewPayload,
      requiresClientReview: true,
      clientReview: true,
      nextDestination: 'client',
      updatedAt: now,
    });
  }

  await db.update(deliverableScriptTable).set({
    reviewTaskId,
    versions,
    status: 'sent',
    updatedAt: now,
  }).where(eq(deliverableScriptTable.id, scriptId));

  return { taskId: reviewTaskId };
}

/** Client approve / reject / edit — same contract as the per-shoot /api/client/shoot-scripts PATCH. */
export async function clientActOnDeliverableScript(
  scriptId: string,
  clientId: string,
  action: 'approve' | 'reject' | 'update_content',
  payload: { content?: string; feedback?: string },
) {
  const db = getDbHttp();
  const [row] = await db.select().from(deliverableScriptTable)
    .where(and(eq(deliverableScriptTable.id, scriptId), eq(deliverableScriptTable.clientId, clientId))).limit(1);
  if (!row) return { error: 'Script not found' as const };
  if (!['sent', 'approved', 'changes_requested'].includes(row.status)) {
    return { error: 'Script is not available for review' as const };
  }

  const now = new Date().toISOString();
  const set: { status?: ScriptStatus; clientFeedback?: string; content?: string; updatedAt: string } = { updatedAt: now };
  if (action === 'approve') {
    set.status = 'approved';
  } else if (action === 'reject') {
    set.status = 'changes_requested';
    set.clientFeedback = (payload.feedback || '').trim();
  } else {
    set.content = payload.content ?? '';
    if (row.status === 'changes_requested') set.status = 'sent';
  }

  const [updated] = await db.update(deliverableScriptTable).set(set).where(eq(deliverableScriptTable.id, scriptId)).returning();
  return { script: updated };
}
