export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { readShootScriptDocument, writeShootScriptDocument } from '@/lib/shoot-scripts';
import { resolveShootWindow } from '@/lib/calendar-invite';
import { notifyClientShootScheduled, notifyClientShootCancelled, notifyHostShoot } from '@/lib/shoot-notify';
import { canManageHostRate, getHostUser, parseHostRate } from '@/lib/host-portal';
import { createAuditLog, AuditAction } from '@/lib/audit-logger';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const baseRole = (user.role || '').toLowerCase();
  // Clients get a narrow carve-out of this endpoint: they can cancel their
  // own shoot from the Production Log, nothing else here. Everything past
  // the isCancelling check below (location/videographer/notes/etc. edits)
  // stays admin/manager/videographer-only.
  const isClientCancelOnly = baseRole === 'client';
  if (!CAN_EDIT.includes(baseRole) && !isClientCancelOnly) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  if (isClientCancelOnly) {
    const ownClientId = await resolveClientIdForUser(user.id);
    if (!ownClientId || existingTask.clientId !== ownClientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (body.status !== 'CANCELLED') {
      return NextResponse.json({ error: 'Clients can only cancel a shoot from this endpoint' }, { status: 403 });
    }
    if (existingTask.status === 'CANCELLED') {
      return NextResponse.json({ error: 'This shoot is already cancelled' }, { status: 409 });
    }
  }

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
      hostId: existingShoot.hostId,
      hostRole: existingShoot.hostRole,
      hostWardrobe: existingShoot.hostWardrobe,
      hostRate: existingShoot.hostRate,
      hostNotes: existingShoot.hostNotes,
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

    if (existingShoot.hostId) {
      const hostWindow = resolveShootWindow({
        shootDate: existingShoot.shootDate,
        plannedStartTime: existingShoot.plannedStartTime,
        plannedEndTime: existingShoot.plannedEndTime,
      });
      if (hostWindow) {
        await notifyHostShoot({
          kind: 'cancelled',
          hostId: existingShoot.hostId,
          taskId: id,
          clientId: existingTask.clientId,
          taskTitle: existingTask.title || 'Shoot',
          location: existingShoot.location,
          start: hostWindow.start,
          end: hostWindow.end,
        });
      }
    }

    return NextResponse.json({ ok: true, cancelled: true, replacementTaskId });
  }

  // ── Normal edit path ──
  // Host Portal: hostId undefined = leave unchanged; null/'' = remove the host; otherwise it
  // must be a real host account. Validated before any write so a bad id changes nothing.
  let nextHostId: number | null = existingShoot.hostId ?? null;
  let nextHost: Awaited<ReturnType<typeof getHostUser>> = null;
  if (body.hostId !== undefined) {
    if (body.hostId === null || body.hostId === '') {
      nextHostId = null;
    } else {
      nextHost = await getHostUser(Number(body.hostId));
      if (!nextHost) {
        return NextResponse.json({ error: 'Selected host was not found or is not a host account' }, { status: 400 });
      }
      nextHostId = nextHost.id;
    }
  }
  // Only admin/manager may set the rate. For everyone else the field is ignored, and if they swap
  // the host the old host's rate is cleared (it belonged to the previous person) for an admin to set.
  const canSetRate = canManageHostRate(user);
  const parsedHostRate = canSetRate ? parseHostRate(body.hostRate) : undefined;
  if (canSetRate && body.hostRate !== undefined && parsedHostRate === undefined) {
    return NextResponse.json({ error: 'Host rate must be a positive number' }, { status: 400 });
  }
  const hostRemoved = body.hostId !== undefined && nextHostId === null;

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
    ...(body.hostName !== undefined
      ? { hostName: body.hostName || nextHost?.name || null }
      : nextHost && nextHost.id !== existingShoot.hostId && !existingShoot.hostName
        ? { hostName: nextHost.name } // first time a real host is linked: fill the display name
        : {}),
    ...(body.hostId !== undefined ? { hostId: nextHostId } : {}),
    // Booking details belong to the host: clearing the host clears them too.
    ...(hostRemoved
      ? { hostRole: null, hostWardrobe: null, hostRate: null, hostNotes: null }
      : {
          ...(body.hostRole !== undefined ? { hostRole: body.hostRole || null } : {}),
          ...(body.hostWardrobe !== undefined ? { hostWardrobe: body.hostWardrobe || null } : {}),
          ...(canSetRate && body.hostRate !== undefined ? { hostRate: parsedHostRate ?? null } : {}),
          ...(!canSetRate && nextHostId !== (existingShoot.hostId ?? null) ? { hostRate: null } : {}),
          ...(body.hostNotes !== undefined ? { hostNotes: body.hostNotes || null } : {}),
        }),
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

  // Host notifications: a newly assigned host gets the booking, a host taken off the shoot
  // gets a cancellation, and an unchanged host is told only if the date/time moved.
  const hostWindow = resolveShootWindow({
    shootDate: nextShootDate,
    plannedStartTime: nextPlannedStart,
    plannedEndTime: nextPlannedEnd,
  });
  const oldHostWindow = resolveShootWindow({
    shootDate: existingShoot.shootDate,
    plannedStartTime: existingShoot.plannedStartTime,
    plannedEndTime: existingShoot.plannedEndTime,
  });
  const nextTitle = (body.title !== undefined ? String(body.title).trim() : existingTask.title) || 'Shoot';
  const nextLocation = body.location !== undefined ? (body.location || null) : existingShoot.location;
  const nextRole = hostRemoved ? null : (body.hostRole !== undefined ? (body.hostRole || null) : existingShoot.hostRole);
  const nextWardrobe = hostRemoved ? null : (body.hostWardrobe !== undefined ? (body.hostWardrobe || null) : existingShoot.hostWardrobe);
  const hostChanged = nextHostId !== (existingShoot.hostId ?? null);

  if (hostChanged && existingShoot.hostId && oldHostWindow) {
    await notifyHostShoot({
      kind: 'cancelled', hostId: existingShoot.hostId, taskId: id, clientId: existingTask.clientId,
      taskTitle: existingTask.title || 'Shoot', location: existingShoot.location,
      start: oldHostWindow.start, end: oldHostWindow.end,
    });
  }
  if (nextHostId && hostWindow && (hostChanged || dateTimeChanged)) {
    await notifyHostShoot({
      kind: hostChanged ? 'assigned' : 'updated', hostId: nextHostId, taskId: id, clientId: existingTask.clientId,
      taskTitle: nextTitle, location: nextLocation, role: nextRole, wardrobe: nextWardrobe,
      start: hostWindow.start, end: hostWindow.end,
    });
  }

  return NextResponse.json({ ok: true });
}