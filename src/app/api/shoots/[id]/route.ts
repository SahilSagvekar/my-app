export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable } from '@/lib/db/schema';
import { readShootScriptDocument, writeShootScriptDocument } from '@/lib/shoot-scripts';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await props.params;
  const body = await req.json();
  const db = getDbHttp();
  const now = new Date().toISOString();
  const [updatedTask] = await db.update(taskTable).set({
    ...(body.title !== undefined ? { title: String(body.title).trim() || null } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.notes !== undefined ? { description: body.notes || '' } : {}),
    ...(body.shootDate ? { dueDate: new Date(body.shootDate).toISOString() } : {}),
    updatedAt: now,
  }).where(eq(taskTable.id, id)).returning({ id: taskTable.id });
  if (!updatedTask) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
  const [currentShoot] = body.videosPlanned !== undefined
    ? await db.select({ scriptContent: shootDetailTable.scriptContent }).from(shootDetailTable).where(eq(shootDetailTable.taskId, id)).limit(1)
    : [undefined];
  const existingDocument = currentShoot ? readShootScriptDocument(currentShoot.scriptContent) : null;
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
    ...(existingDocument ? { scriptContent: writeShootScriptDocument({ ...existingDocument, videosPlanned: Math.max(1, Math.min(99, Number(body.videosPlanned) || 1)) }) } : {}),
    updatedAt: now,
  }).where(eq(shootDetailTable.taskId, id));
  return NextResponse.json({ ok: true });
}
