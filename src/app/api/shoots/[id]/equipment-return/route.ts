export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task as taskTable, shootDetail as shootDetailTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

// Same subset used in ../route.ts's POST — kept in sync manually since
// there's no shared schema-level enum for just these three.
const SHOOT_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;

// PATCH — edit a shoot day's details (location, time, host, equipment, etc.)
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const params = await props.params;
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: taskId } = params;
    const body = await req.json();
    const {
      title, videographerId, location, shootDate, hostName, equipmentIds,
      camera, quality, frameRate, lighting, exclusions, notes, status,
    } = body;

    if (status !== undefined && !SHOOT_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const [existingShoot] = await db.select({ id: shootDetailTable.id })
      .from(shootDetailTable).where(eq(shootDetailTable.taskId, taskId)).limit(1);
    if (!existingShoot) {
      return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
    }

    const taskUpdate: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) taskUpdate.title = title;
    if (videographerId !== undefined) taskUpdate.videographer = Number(videographerId);
    if (shootDate !== undefined) taskUpdate.dueDate = new Date(shootDate).toISOString();
    if (status !== undefined) taskUpdate.status = status;
    const [updatedTask] = await db.update(taskTable).set(taskUpdate).where(eq(taskTable.id, taskId)).returning();

    const shootUpdate: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (location !== undefined) shootUpdate.location = location || null;
    if (shootDate !== undefined) shootUpdate.shootDate = new Date(shootDate).toISOString();
    if (hostName !== undefined) shootUpdate.hostName = hostName || null;
    if (equipmentIds !== undefined) shootUpdate.equipmentIds = Array.isArray(equipmentIds) ? equipmentIds : [];
    if (camera !== undefined) shootUpdate.camera = camera || null;
    if (quality !== undefined) shootUpdate.quality = quality || null;
    if (frameRate !== undefined) shootUpdate.frameRate = frameRate || null;
    if (lighting !== undefined) shootUpdate.lighting = lighting || null;
    if (exclusions !== undefined) shootUpdate.exclusions = exclusions || null;
    if (notes !== undefined) shootUpdate.videographerNotes = notes || null;
    if (videographerId !== undefined) shootUpdate.videographerId = Number(videographerId);

    const [updatedShoot] = await db.update(shootDetailTable).set(shootUpdate)
      .where(eq(shootDetailTable.taskId, taskId)).returning();

    return NextResponse.json({ shootDetail: updatedShoot, task: updatedTask });
  } catch (error: any) {
    console.error('[Shoots] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update shoot' }, { status: 500 });
  }
}