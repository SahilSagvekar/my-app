export const dynamic = 'force-dynamic';
// PATCH /api/admin/payouts/commission-rate/[userId] — set a rep's commission % override.
// Admin only — compensation, not something a sales_manager can self-serve.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || decoded.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Admin only' }, { status: 403 });
    }

    const { userId } = await params;
    const targetId = Number(userId);

    const body = await req.json().catch(() => ({}));
    const { rate } = body;
    const parsedRate = parseFloat(rate);
    if (isNaN(parsedRate) || parsedRate <= 0 || parsedRate > 1) {
      return NextResponse.json(
        { ok: false, message: 'rate must be a number between 0 and 1 (e.g. 0.15 for 15%)' },
        { status: 400 }
      );
    }

    await prisma.salesRepPayoutProfile.upsert({
      where: { userId: targetId },
      update: { commissionRate: parsedRate },
      create: { userId: targetId, commissionRate: parsedRate },
    });

    return NextResponse.json({ ok: true, rate: parsedRate });
  } catch (err) {
    console.error('[PATCH /api/admin/payouts/commission-rate/[userId]]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
