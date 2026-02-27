export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    const existing = await prisma.salesDashboardColumn.findFirst({
      where: { id, userId: decoded.userId }
    });
    if (!existing) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    const body = await req.json();
    const column = await prisma.salesDashboardColumn.update({
      where: { id },
      data: {
        label: body.label ?? existing.label,
        width: body.width ?? existing.width,
        order: body.order ?? existing.order,
        isVisible: body.isVisible !== undefined ? body.isVisible : existing.isVisible,
      }
    });

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

    const existing = await prisma.salesDashboardColumn.findFirst({
      where: { id, userId: decoded.userId }
    });
    if (!existing || !existing.isCustom) return NextResponse.json({ ok: false, message: 'Cannot delete core column' }, { status: 400 });

    await prisma.salesDashboardColumn.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/sales-columns/[id]]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
