export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { readShootScriptDocument, writeShootScriptDocument } from '@/lib/shoot-scripts';
import { resolveShootWindow } from '@/lib/calendar-invite';
import { notifyClientShootScheduled, notifyClientShootCancelled } from '@/lib/shoot-notify';
import { createAuditLog, AuditAction } from '@/lib/audit-logger';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await props.params;
  const body = await req.json();
  const db = getDbHttp();
  const now = new Date().toISOString();

  const [existingTask] = await db
    .select({ id: taskTable.id, title: taskTable.title, status: taskTable.status, clientId: taskTable.clientId })
    .from(taskTable).where(eq(taskTable.id, id)).limit(1);
  if (!existingTask) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });

  const [existingShoot] = await db.select().from(shootDetailTable).where(eq(shootDetailTable.taskId, id)).limit(1);
  if (!existingShoot) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });

  // ── Cancellation path — status flip to CANCELLED spins up a replacement
  // shoot instead of just closing this one out, and (optionally) tells the
  // client their calendar invite is void. ──
  const isCancelling = body.status === 'CANCELLED' && existingTask.status !== 'CANCELLED';
  if (isCancelling) {
    const reason = typeof body.cancellationReason === 'string' ? (body.cancellationReason.trim() || null) : null;
    const existingDocument = readShootScriptDocument(existingShoot.scriptContent);
    // Task.assignedTo is NOT NULL — fall back to whoever is cancelling if the
    // slot never had a videographer assigned, same fallback POST uses on create.
    const carriedVideographerId = existingShoot.videographerId || Number(user.id);

    const replacementTaskId = createId();
    await db.insert(taskTable).values({
      id: replacementTaskId,
      title: `${existingTask.title || 'Shoot'} (Replacement)`,
      description: `Replacement for cancelled shoot "${existingTask.title || 'Shoot'}"${reason ? ` — ${reason}` : ''}.`,
      assignedTo: carriedVideographerId,
      videographer: carriedVideographerId,
      createdBy: Number(user.id),
      clientId: existingTask.clientId,
      status: 'PENDING',
      updatedAt: now,
    });

    await db.insert(shootDetailTable).values({
      id: createId(),
      taskId: replacementTaskId,
      location: existingShoot.location,
      hostName: existingShoot.hostName,
      equipmentIds: existingShoot.equipmentIds || [],
      camera: existingShoot.camera,
      quality: existingShoot.quality,
      frameRate: existingShoot.frameRate,
      lighting: existingShoot.lighting,
      exclusions: existingShoot.exclusions,
      videographerId: carriedVideographerId,
      scriptContent: writeShootScriptDocument({ version: 1, videosPlanned: existingDocument.videosPlanned, scripts: [] }),
      replacesTaskId: id,
      updatedAt: now,
    });

    await db.update(taskTable).set({ status: 'CANCELLED', updatedAt: now }).where(eq(taskTable.id, id));
    await db.update(shootDetailTable).set({
      cancelledAt: now,
      cancelledBy: Number(user.id),
      cancellationReason: reason,
      replacementTaskId,
      updatedAt: now,
    }).where(eq(shootDetailTable.taskId, id));

    await createAuditLog({
      userId: Number(user.id),
      action: AuditAction.TASK_UPDATED,
      entity: 'Task',
      entityId: id,
      details: `Cancelled shoot "${existingTask.title || ''}"${reason ? ` — ${reason}` : ''}. Replacement task ${replacementTaskId} created.`,
      metadata: { taskId: id, replacementTaskId, cancelledBy: user.id, reason },
    });

    if (existingTask.clientId) {
      const window = resolveShootWindow({
        shootDate: existingShoot.shootDate,
        plannedStartTime: existingShoot.plannedStartTime,
        plannedEndTime: existingShoot.plannedEndTime,
      });
      if (window) {
        await notifyClientShootCancelled({
          taskId: id,
          clientId: existingTask.clientId,
          taskTitle: existingTask.title || 'Shoot',
          start: window.start,
          end: window.end,
          reason,
        });
      }
    }

    return NextResponse.json({ ok: true, cancelled: true, replacementTaskId });
  }

  // ── Normal edit path ──
  const [updatedTask] = await db.update(taskTable).set({
    ...(body.title !== undefined ? { title: String(body.title).trim() || null } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.notes !== undefined ? { description: body.notes || '' } : {}),
    ...(body.shootDate ? { dueDate: new Date(body.shootDate).toISOString() } : {}),
    updatedAt: now,
  }).where(eq(taskTable.id, id)).returning({ id: taskTable.id });
  if (!updatedTask) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });

  const existingDocument = body.videosPlanned !== undefined ? readShootScriptDocument(existingShoot.scriptContent) : null;
  await db.update(shootDetailTable).set({
    ...(body.location !== undefined ? { location: body.location || null } : {}),
    ...(body.shootDate ? { shootDate: new Date(body.shootDate).toISOString() } : {}),
    ...(body.hostName !== undefined ? { hostName: body.hostName || null } : {}),
    ...(Array.isArray(body.equipmentIds) ? { equipmentIds: body.equipmentIds } : {}),
    ...(body.camera !== undefined ? { camera: body.camera || null } : {}),
    ...(body.quality !== undefined ? { quality: body.quality || null } : {}),
    ...(body.frameRate !== undefined ? { frameRate: body.frameRate || null } : {}),
    ...(body.lighting !== undefined ? { lighting: body.lighting || null } : {}),
    ...(body.exclusions !== undefined ? { exclusions: body.exclusions || null } : {}),
    ...(body.videographerId ? { videographerId: Number(body.videographerId) } : {}),
    // Scripting feature — the Production Log's per-shoot "Notes" (both
    // portals) reads from ShootDetail.videographerNotes, not Task.
    // description. The "notes" field on this same edit form was already
    // being saved to description above (kept as-is, in case anything else
    // reads it) but was never ALSO reaching this column — so it never
    // showed up in the Production Log no matter what was typed.
    ...(body.notes !== undefined ? { videographerNotes: body.notes || null } : {}),
    ...(body.plannedStartTime !== undefined ? { plannedStartTime: body.plannedStartTime ? new Date(body.plannedStartTime).toISOString() : null } : {}),
    ...(body.plannedEndTime !== undefined ? { plannedEndTime: body.plannedEndTime ? new Date(body.plannedEndTime).toISOString() : null } : {}),
    ...(body.actualStartTime !== undefined ? { actualStartTime: body.actualStartTime ? new Date(body.actualStartTime).toISOString() : null } : {}),
    ...(body.actualEndTime !== undefined ? { actualEndTime: body.actualEndTime ? new Date(body.actualEndTime).toISOString() : null } : {}),
    ...(existingDocument ? { scriptContent: writeShootScriptDocument({ ...existingDocument, videosPlanned: Math.max(1, Math.min(99, Number(body.videosPlanned) || 1)) }) } : {}),
    updatedAt: now,
  }).where(eq(shootDetailTable.taskId, id));

  // Notify the client (new email + fresh calendar invite) only when the
  // shoot's date/time actually moved — not on every unrelated field edit.
  const nextShootDate = body.shootDate ? new Date(body.shootDate).toISOString() : existingShoot.shootDate;
  const nextPlannedStart = body.plannedStartTime !== undefined
    ? (body.plannedStartTime ? new Date(body.plannedStartTime).toISOString() : null)
    : existingShoot.plannedStartTime;
  const nextPlannedEnd = body.plannedEndTime !== undefined
    ? (body.plannedEndTime ? new Date(body.plannedEndTime).toISOString() : null)
    : existingShoot.plannedEndTime;
  const dateTimeChanged =
    nextShootDate !== existingShoot.shootDate ||
    nextPlannedStart !== existingShoot.plannedStartTime ||
    nextPlannedEnd !== existingShoot.plannedEndTime;

  if (dateTimeChanged && existingTask.clientId) {
    const window = resolveShootWindow({
      shootDate: nextShootDate,
      plannedStartTime: nextPlannedStart,
      plannedEndTime: nextPlannedEnd,
    });
    if (window) {
      await notifyClientShootScheduled({
        taskId: id,
        clientId: existingTask.clientId,
        taskTitle: (body.title !== undefined ? String(body.title).trim() : existingTask.title) || 'Shoot',
        location: body.location !== undefined ? (body.location || null) : existingShoot.location,
        hostName: body.hostName !== undefined ? (body.hostName || null) : existingShoot.hostName,
        start: window.start,
        end: window.end,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
