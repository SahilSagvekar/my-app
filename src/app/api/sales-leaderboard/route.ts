export const dynamic = 'force-dynamic';
// GET /api/sales-leaderboard
// Returns today's call/dealClosed/meeting counts for every sales rep (whole team,
// visible to any sales/sales_manager/admin viewer — non-sensitive aggregate counts).

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { user as userTable, salesActivityLog } from '@/lib/db/schema';
import { asc, eq, gte } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { getESTDate } from '@/lib/est-date';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || !['sales', 'admin', 'sales_manager'].includes(decoded.role)) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const reps = await db.select({ id: userTable.id, name: userTable.name, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.role, 'sales'))
      .orderBy(asc(userTable.name));

    // Midnight Eastern, not server-local midnight (Cloudflare Workers run in UTC, which
    // reset the board at ~8 PM ET).
    const startOfToday = getESTDate().start;

    const events = await db.select({ userId: salesActivityLog.userId, type: salesActivityLog.type })
      .from(salesActivityLog)
      .where(gte(salesActivityLog.createdAt, startOfToday.toISOString()));

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
