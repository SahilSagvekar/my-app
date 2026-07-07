export const dynamic = 'force-dynamic';
// GET /api/sales-manager/visible-reps
// Returns the list of sales reps the current user is allowed to assign leads to.
// admin: every sales rep. sales_manager: only reps an admin has granted them.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getVisibleSalesRepIds } from '@/lib/salesManagerPermissions';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'admin' && decoded.role !== 'sales_manager')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const where =
      decoded.role === 'sales_manager'
        ? { role: 'sales' as const, id: { in: (await getVisibleSalesRepIds(Number(decoded.userId))).filter(id => id !== Number(decoded.userId)) } }
        : { role: 'sales' as const };

    const reps = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ ok: true, reps });
  } catch (err) {
    console.error('[GET /api/sales-manager/visible-reps]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
