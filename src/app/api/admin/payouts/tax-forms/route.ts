export const dynamic = 'force-dynamic';
// GET /api/admin/payouts/tax-forms — list all sales reps + their tax form status
// admin: everyone. sales_manager: only their visible reps.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getVisibleSalesRepIds } from '@/lib/salesManagerPermissions';
import { DEFAULT_COMMISSION_RATE } from '@/lib/payout-config';

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
        ? {
            role: 'sales' as const,
            id: {
              in: (await getVisibleSalesRepIds(Number(decoded.userId))).filter(
                (id) => id !== Number(decoded.userId)
              ),
            },
          }
        : { role: 'sales' as const };

    const reps = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        payoutProfile: {
          select: {
            taxFormType: true,
            taxFormCollectedAt: true,
            taxFormS3Key: true,
            commissionRate: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = reps.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      taxFormSubmitted: !!r.payoutProfile?.taxFormCollectedAt,
      taxFormType: r.payoutProfile?.taxFormType ?? null,
      taxFormSubmittedAt: r.payoutProfile?.taxFormCollectedAt ?? null,
      hasDocument: !!r.payoutProfile?.taxFormS3Key,
      commissionRate:
        r.payoutProfile?.commissionRate != null
          ? Number(r.payoutProfile.commissionRate)
          : DEFAULT_COMMISSION_RATE,
    }));

    return NextResponse.json({ ok: true, reps: data });
  } catch (err) {
    console.error('[GET /api/admin/payouts/tax-forms]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
