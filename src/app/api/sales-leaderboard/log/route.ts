export const dynamic = 'force-dynamic';
// POST /api/sales-leaderboard/log — log a call/dealClosed/meeting for the current user

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

const VALID_TYPES = ['call', 'dealClosed', 'meeting'];

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || !['sales', 'admin', 'sales_manager'].includes(decoded.role)) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const { type } = await req.json();
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ ok: false, message: 'Invalid type' }, { status: 400 });
    }

    await (prisma as any).salesActivityLog.create({
      data: { userId: decoded.userId, type },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/sales-leaderboard/log]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
