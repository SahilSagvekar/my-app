export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// GET /api/admin/sales-leads — fetch all leads across all sales reps
export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || decoded.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const leads = await prisma.salesLead.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ ok: true, leads });
  } catch (err) {
    console.error('[GET /api/admin/sales-leads]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
