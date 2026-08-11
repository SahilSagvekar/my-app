export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { salesDashboardColumn } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// PATCH /api/sales-columns/[id] — update column (rename, width, order, visible)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const [existing] = await db.select().from(salesDashboardColumn)
      .where(and(eq(salesDashboardColumn.id, id), eq(salesDashboardColumn.userId, decoded.userId)))
      .limit(1);
    if (!existing) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    const body = await req.json();
    const [column] = await db.update(salesDashboardColumn).set({
      label: body.label ?? existing.label,
      width: body.width ?? existing.width,
      order: body.order ?? existing.order,
      isVisible: body.isVisible !== undefined ? body.isVisible : existing.isVisible,
      updatedAt: new Date().toISOString(),
    }).where(eq(salesDashboardColumn.id, id)).returning();

    return NextResponse.json({ ok: true, column });
  } catch (err) {
    console.error('[PATCH /api/sales-columns/[id]]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/sales-columns/[id] — permanently remove a custom column
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const [existing] = await db.select().from(salesDashboardColumn)
      .where(and(eq(salesDashboardColumn.id, id), eq(salesDashboardColumn.userId, decoded.userId)))
      .limit(1);
    if (!existing || !existing.isCustom) return NextResponse.json({ ok: false, message: 'Cannot delete core column' }, { status: 400 });

    await db.delete(salesDashboardColumn).where(eq(salesDashboardColumn.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/sales-columns/[id]]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
