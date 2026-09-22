export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task as taskTable, shootDetail as shootDetailTable, client as clientTable, user as userTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, isNotNull, desc } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { readShootScriptDocument, writeShootScriptDocument } from '@/lib/shoot-scripts';
import { resolveShootWindow } from '@/lib/calendar-invite';
import { notifyClientShootScheduled } from '@/lib/shoot-notify';

// Shoot-day status is a focused subset of the broader TaskStatus enum —
// all three values are valid TaskStatus members already, so no schema
// change is needed to store them on Task.status.
const SHOOT_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
type ShootStatus = typeof SHOOT_STATUSES[number];

// Admin/manager/videographer all get full visibility here, matching the
// "videographer has access similar to admin" access level already granted
// elsewhere in the portal (Drive, etc.) — this is a shared team schedule,
// not scoped to "my shoots only".
const CAN_VIEW = ['admin', 'manager', 'videographer'];
const CAN_CREATE = ['admin', 'manager', 'videographer'];

// GET — list all shoot days (tasks that have a ShootDetail row)
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_VIEW.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await db
      .select({
        shoot: shootDetailTable,
        task: taskTable,
        client: { id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName, scriptsRequired: clientTable.scriptsRequired },
        videographer: { id: userTable.id, name: userTable.name, email: userTable.email },
      })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
      .leftJoin(userTable, eq(shootDetailTable.videographerId, userTable.id))
      .where(isNotNull(shootDetailTable.taskId))
      .orderBy(desc(shootDetailTable.shootDate));

    const shoots = rows.map(r => {
      const scriptDocument = readShootScriptDocument(r.shoot.scriptContent);
      return ({
      id: r.task.id,
      title: r.task.title,
      status: r.task.status,
      client: r.client,
      videographer: r.videographer,
      location: r.shoot.location,
      shootDate: r.shoot.shootDate,
      hostName: r.shoot.hostName,
      equipmentIds: r.shoot.equipmentIds || [],
      camera: r.shoot.camera,
      quality: r.shoot.quality,
      frameRate: r.shoot.frameRate,
      lighting: r.shoot.lighting,
      exclusions: r.shoot.exclusions,
      videographerNotes: r.shoot.videographerNotes,
      equipmentReturnedAt: r.shoot.equipmentReturnedAt,
      equipmentReturnedPhotoUrls: r.shoot.equipmentReturnedPhotoUrls || [],
      scriptContent: r.shoot.scriptContent,
      scriptStatus: r.shoot.scriptStatus,
      scriptSentAt: r.shoot.scriptSentAt,
      videosPlanned: scriptDocument.videosPlanned,
      scriptsCount: scriptDocument.scripts.length,
      plannedStartTime: r.shoot.plannedStartTime,
      plannedEndTime: r.shoot.plannedEndTime,
      actualStartTime: r.shoot.actualStartTime,
      actualEndTime: r.shoot.actualEndTime,
      cancelledAt: r.shoot.cancelledAt,
      cancelledBy: r.shoot.cancelledBy,
      cancellationReason: r.shoot.cancellationReason,
      replacementTaskId: r.shoot.replacementTaskId,
      replacesTaskId: r.shoot.replacesTaskId,
    });
    });

    return NextResponse.json({ shoots });
  } catch (error: unknown) {
    console.error('[Shoots] GET error:', error);
    return NextResponse.json({ error: 'Failed to load shoots' }, { status: 500 });
  }
}

// POST — create a new shoot day (Task + ShootDetail together)
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_CREATE.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      clientId,
      videographerId,
      location,
      shootDate,
      hostName,
      equipmentIds,
      camera,
      quality,
      frameRate,
      lighting,
      exclusions,
      notes,
      status,
      videosPlanned,
      plannedStartTime,
      plannedEndTime,
      actualStartTime,
      actualEndTime,
    } = body;

    if (!shootDate) {
      return NextResponse.json({ error: 'Shoot date/time is required' }, { status: 400 });
    }

    const shootStatus: ShootStatus = SHOOT_STATUSES.includes(status) ? status : 'PENDING';

    const assignedVideographerId = videographerId ? Number(videographerId) : user.id;

    let clientName: string | null = null;
    if (clientId) {
      const [foundClient] = await db.select({ name: clientTable.name, companyName: clientTable.companyName })
        .from(clientTable).where(eq(clientTable.id, clientId)).limit(1);
      clientName = foundClient?.companyName || foundClient?.name || null;
    }

    const taskId = createId();
    const taskTitle = title?.trim() || `${clientName || hostName || 'Shoot'} · ${new Date(shootDate).toLocaleDateString()}`;

    const [createdTask] = await db.insert(taskTable).values({
      id: taskId,
      title: taskTitle,
      description: notes || `Shoot day${location ? ` at ${location}` : ''}`,
      assignedTo: assignedVideographerId,
      videographer: assignedVideographerId,
      createdBy: user.id,
      clientId: clientId || null,
      status: shootStatus,
      dueDate: new Date(shootDate).toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    const [createdShootDetail] = await db.insert(shootDetailTable).values({
      id: createId(),
      taskId,
      location: location || null,
      shootDate: new Date(shootDate).toISOString(),
      camera: camera || null,
      quality: quality || null,
      frameRate: frameRate || null,
      lighting: lighting || null,
      exclusions: exclusions || null,
      hostName: hostName || null,
      equipmentIds: Array.isArray(equipmentIds) ? equipmentIds : [],
      scriptContent: writeShootScriptDocument({ version: 1, videosPlanned: Math.max(1, Number(videosPlanned) || 1), scripts: [] }),
      videographerId: assignedVideographerId,
      plannedStartTime: plannedStartTime ? new Date(plannedStartTime).toISOString() : null,
      plannedEndTime: plannedEndTime ? new Date(plannedEndTime).toISOString() : null,
      actualStartTime: actualStartTime ? new Date(actualStartTime).toISOString() : null,
      actualEndTime: actualEndTime ? new Date(actualEndTime).toISOString() : null,
      updatedAt: new Date().toISOString(),
    }).returning();

    if (clientId) {
      const window = resolveShootWindow({
        shootDate: createdShootDetail.shootDate,
        plannedStartTime: createdShootDetail.plannedStartTime,
        plannedEndTime: createdShootDetail.plannedEndTime,
      });
      if (window) {
        await notifyClientShootScheduled({
          taskId,
          clientId,
          taskTitle: taskTitle,
          location: createdShootDetail.location,
          hostName: createdShootDetail.hostName,
          start: window.start,
          end: window.end,
        });
      }
    }

    return NextResponse.json({ task: createdTask, shootDetail: createdShootDetail }, { status: 201 });
  } catch (error: unknown) {
    console.error('[Shoots] POST error:', error);
    return NextResponse.json({ error: 'Failed to create shoot' }, { status: 500 });
  }
}