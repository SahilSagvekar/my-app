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

// POST /api/sales-columns — add a new custom column
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'sales' && decoded.role !== 'admin')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { label, type, name } = body;

    if (!label || !type || !name) {
      return NextResponse.json({ ok: false, message: 'Missing fields' }, { status: 400 });
    }

    // Get max order
    const lastCol = await prisma.salesDashboardColumn.findFirst({
        where: { userId: decoded.userId },
        orderBy: { order: 'desc' }
    });
    const nextOrder = (lastCol?.order ?? 0) + 1;

    const column = await prisma.salesDashboardColumn.create({
      data: {
        userId: decoded.userId,
        name,
        label,
        type,
        order: nextOrder,
        isCustom: true,
      }
    });

    return NextResponse.json({ ok: true, column });
  } catch (err) {
    console.error('[POST /api/sales-columns]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
