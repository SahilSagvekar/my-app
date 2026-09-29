export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { equipment as equipmentTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// Anyone on the team can add equipment (see POST in ../route.ts), but the
// destructive/administrative actions are locked down:
//   - Edit   → admin + manager (unchanged)
//   - Delete → admin ONLY
const CAN_EDIT = ['admin', 'manager'];
const CAN_DELETE = ['admin'];

// PATCH — edit an equipment item
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

    const body = await req.json();
    const { name, category, notes, isActive } = body;

    const update: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) {
      if (!String(name).trim()) {
        return NextResponse.json({ error: 'Equipment name cannot be empty' }, { status: 400 });
      }
      update.name = String(name).trim();
    }
    if (category !== undefined) update.category = category || null;
    if (notes !== undefined) update.notes = notes || null;
    if (isActive !== undefined) update.isActive = !!isActive;

    const [updated] = await db.update(equipmentTable).set(update).where(eq(equipmentTable.id, params.id)).returning();
    if (!updated) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    return NextResponse.json({ equipment: updated });
  } catch (error: any) {
    console.error('[Equipment] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update equipment' }, { status: 500 });
  }
}

// DELETE — remove an equipment item (admin only). Past shoots keep
// referencing this id in ShootDetail.equipmentIds (a plain text array, no FK)
// — their history stays intact; the frontend just won't be able to resolve
// the name for a deleted item on old shoots, so it can label it "(removed)"
// if not found.
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const params = await props.params;
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_DELETE.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Only an admin can delete equipment' }, { status: 403 });
    }

    const [deleted] = await db.delete(equipmentTable).where(eq(equipmentTable.id, params.id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Equipment] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete equipment' }, { status: 500 });
  }
}