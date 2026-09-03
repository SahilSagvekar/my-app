export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { equipment as equipmentTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, asc } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

const CAN_MANAGE = ['admin', 'manager', 'videographer'];

// GET — list equipment (active by default; ?includeInactive=1 for all)
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === '1';

    const rows = includeInactive
      ? await db.select().from(equipmentTable).orderBy(asc(equipmentTable.name))
      : await db.select().from(equipmentTable).where(eq(equipmentTable.isActive, true)).orderBy(asc(equipmentTable.name));

    return NextResponse.json({ equipment: rows });
  } catch (error: any) {
    console.error('[Equipment] GET error:', error);
    return NextResponse.json({ error: 'Failed to load equipment' }, { status: 500 });
  }
}

// POST — add a new piece of equipment
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_MANAGE.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, category, notes } = body;
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Equipment name is required' }, { status: 400 });
    }

    const [created] = await db.insert(equipmentTable).values({
      id: createId(),
      name: String(name).trim(),
      category: category || null,
      notes: notes || null,
      isActive: true,
      createdById: user.id,
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({ equipment: created }, { status: 201 });
  } catch (error: any) {
    console.error('[Equipment] POST error:', error);
    return NextResponse.json({ error: 'Failed to add equipment' }, { status: 500 });
  }
}