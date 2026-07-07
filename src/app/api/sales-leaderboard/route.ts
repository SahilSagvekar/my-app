export const dynamic = 'force-dynamic';
// GET /api/sales-leaderboard
// Returns today's call/dealClosed/meeting counts for every sales rep (whole team,
// visible to any sales/sales_manager/admin viewer — non-sensitive aggregate counts).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

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
    if (!decoded?.userId || !['sales', 'admin', 'sales_manager'].includes(decoded.role)) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const reps = await prisma.user.findMany({
      where: { role: 'sales' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const events = await (prisma as any).salesActivityLog.findMany({
      where: { createdAt: { gte: startOfToday } },
      select: { userId: true, type: true },
    });

    const counts: Record<number, { calls: number; dealsClosed: number; meetings: number }> = {};
    for (const rep of reps) counts[rep.id] = { calls: 0, dealsClosed: 0, meetings: 0 };
    for (const e of events) {
      if (!counts[e.userId]) counts[e.userId] = { calls: 0, dealsClosed: 0, meetings: 0 };
      if (e.type === 'call') counts[e.userId].calls++;
      else if (e.type === 'dealClosed') counts[e.userId].dealsClosed++;
      else if (e.type === 'meeting') counts[e.userId].meetings++;
    }

    const rows = reps.map(rep => ({
      userId: rep.id,
      name: rep.name || rep.email,
      ...counts[rep.id],
    }));

    return NextResponse.json({ ok: true, rows, currentUserId: decoded.userId });
  } catch (err) {
    console.error('[GET /api/sales-leaderboard]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
