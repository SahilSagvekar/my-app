export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { salesLead } from '@/lib/db/schema';
import { inArray, asc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { getVisibleSalesRepIds } from '@/lib/salesManagerPermissions';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// GET /api/admin/sales-leads — fetch all leads across all sales reps (admin),
// or leads for permitted sales reps only (sales_manager)
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'admin' && decoded.role !== 'sales_manager')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const where =
      decoded.role === 'sales_manager'
        ? inArray(salesLead.userId, await getVisibleSalesRepIds(Number(decoded.userId)))
        : undefined;

    const leads = await db.query.salesLead.findMany({
      where,
      with: {
        user: {
          columns: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: [asc(salesLead.userId), asc(salesLead.createdAt)],
    });

    return NextResponse.json({ ok: true, leads });
  } catch (err) {
    console.error('[GET /api/admin/sales-leads]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
