export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { salesDashboardColumn } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { desc, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// POST /api/sales-columns — add a new custom column
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || !['sales', 'admin', 'sales_manager'].includes(decoded.role)) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { label, type, name } = body;

    if (!label || !type || !name) {
      return NextResponse.json({ ok: false, message: 'Missing fields' }, { status: 400 });
    }

    // Get max order
    const [lastCol] = await db.select().from(salesDashboardColumn)
      .where(eq(salesDashboardColumn.userId, decoded.userId))
      .orderBy(desc(salesDashboardColumn.order))
      .limit(1);
    const nextOrder = (lastCol?.order ?? 0) + 1;

    const [column] = await db.insert(salesDashboardColumn).values({
      id: createId(),
      userId: decoded.userId,
      name,
      label,
      type,
      order: nextOrder,
      isCustom: true,
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({ ok: true, column });
  } catch (err) {
    console.error('[POST /api/sales-columns]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
