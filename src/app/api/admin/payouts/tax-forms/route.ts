export const dynamic = 'force-dynamic';
// GET /api/admin/payouts/tax-forms — list all sales reps + their tax form status
// admin: everyone. sales_manager: only their visible reps.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
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
  const db = getDbHttp();
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'admin' && decoded.role !== 'sales_manager')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const whereClause =
      decoded.role === 'sales_manager'
        ? and(
            eq(userTable.role, 'sales'),
            inArray(
              userTable.id,
              (await getVisibleSalesRepIds(Number(decoded.userId))).filter(
                (id) => id !== Number(decoded.userId)
              )
            )
          )
        : eq(userTable.role, 'sales');

    const reps = await db.query.user.findMany({
      where: whereClause,
      columns: { id: true, name: true, email: true },
      with: { salesRepPayoutProfiles: true },
      orderBy: asc(userTable.name),
    });

    const data = reps.map((r) => {
      // salesRepPayoutProfile has a unique userId FK (1:1), but drizzle-kit
      // introspection mislabels it many() — take the first (only) entry.
      const payoutProfile = r.salesRepPayoutProfiles[0];
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        taxFormSubmitted: !!payoutProfile?.taxFormCollectedAt,
        taxFormType: payoutProfile?.taxFormType ?? null,
        taxFormSubmittedAt: payoutProfile?.taxFormCollectedAt ?? null,
        hasDocument: !!payoutProfile?.taxFormS3Key,
        commissionRate:
          payoutProfile?.commissionRate != null
            ? Number(payoutProfile.commissionRate)
            : DEFAULT_COMMISSION_RATE,
      };
    });

    return NextResponse.json({ ok: true, reps: data });
  } catch (err) {
    console.error('[GET /api/admin/payouts/tax-forms]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
