export const dynamic = 'force-dynamic';
// GET /api/sales-manager/visible-reps
// Returns the list of sales reps the current user is allowed to assign leads to.
// admin: every sales rep. sales_manager: only reps an admin has granted them.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
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

    const whereCondition =
      decoded.role === 'sales_manager'
        ? and(
            eq(userTable.role, 'sales'),
            inArray(
              userTable.id,
              (await getVisibleSalesRepIds(Number(decoded.userId))).filter(id => id !== Number(decoded.userId))
            )
          )
        : eq(userTable.role, 'sales');

    const reps = await db.select({ id: userTable.id, name: userTable.name, email: userTable.email })
      .from(userTable)
      .where(whereCondition)
      .orderBy(asc(userTable.name));

    return NextResponse.json({ ok: true, reps });
  } catch (err) {
    console.error('[GET /api/sales-manager/visible-reps]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
