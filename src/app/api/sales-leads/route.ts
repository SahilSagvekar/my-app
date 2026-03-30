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

// GET /api/sales-leads — sales user fetches their own rows
export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'sales' && decoded.role !== 'admin')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const [leads, columns] = await Promise.all([
      prisma.salesLead.findMany({
        where: { userId: decoded.userId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.salesDashboardColumn.findMany({
        where: { userId: decoded.userId },
        orderBy: { order: 'asc' },
      }),
    ]);

    return NextResponse.json({ ok: true, leads, columns }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (err) {
    console.error('[GET /api/sales-leads]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

// POST /api/sales-leads — create a new lead row
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'sales' && decoded.role !== 'admin')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    const lead = await prisma.salesLead.create({
      data: {
        userId: decoded.userId,
        name: body.name ?? '',
        company: body.company ?? '',
        email: body.email ?? '',
        phone: body.phone ?? '',
        socials: body.socials ?? '',
        instagram: !!body.instagram,
        facebook: !!body.facebook,
        linkedin: !!body.linkedin,
        twitter: !!body.twitter,
        tiktok: !!body.tiktok,
        status: body.status ?? 'NEW',
        source: body.source ?? '',
        value: body.value !== undefined ? parseFloat(body.value) : null,
        priority: body.priority ?? '',
        meetingBooked: !!body.meetingBooked,
        emailed: !!body.emailed,
        called: !!body.called,
        texted: !!body.texted,
        notes: body.notes ?? '',
        emailTemplate: body.emailTemplate ?? '',
        dmAt: body.dmAt ? new Date(body.dmAt) : null,
        meetingAt: body.meetingAt ? new Date(body.meetingAt) : null,
        emailedAt: body.emailedAt ? new Date(body.emailedAt) : null,
        calledAt: body.calledAt ? new Date(body.calledAt) : null,
        textedAt: body.textedAt ? new Date(body.textedAt) : null,
      },
    });

    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    console.error('[POST /api/sales-leads]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}