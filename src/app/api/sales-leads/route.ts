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
    if (!decoded?.userId || decoded.role !== 'sales') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const leads = await prisma.salesLead.findMany({
      where: { userId: decoded.userId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ ok: true, leads });
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
    if (!decoded?.userId || decoded.role !== 'sales') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    const lead = await prisma.salesLead.create({
      data: {
        userId: decoded.userId,
        name: body.name ?? '',
        email: body.email ?? '',
        socials: body.socials ?? '',
        snapchatShow: body.snapchatShow ?? '',
        igDm: body.igDm ?? false,
        dmPlatform: body.dmPlatform ?? '',
        meetingBooked: body.meetingBooked ?? false,
        emailed: body.emailed ?? false,
        called: body.called ?? false,
        texted: body.texted ?? false,
        notes: body.notes ?? '',
        emailTemplate: body.emailTemplate ?? '',
      },
    });

    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    console.error('[POST /api/sales-leads]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
