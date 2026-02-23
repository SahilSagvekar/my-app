import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// PATCH /api/sales-leads/[id] — update a lead (ownership enforced)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'sales' && decoded.role !== 'admin')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.salesLead.findFirst({
      where: { id: params.id, userId: decoded.userId },
    });
    if (!existing) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    const body = await req.json();

    const lead = await prisma.salesLead.update({
      where: { id: params.id },
      data: {
        name: body.name ?? existing.name,
        email: body.email ?? existing.email,
        socials: body.socials ?? existing.socials,
        snapchatShow: body.snapchatShow ?? existing.snapchatShow,
        igDm: body.igDm ?? existing.igDm,
        dmPlatform: body.dmPlatform ?? existing.dmPlatform,
        meetingBooked: body.meetingBooked ?? existing.meetingBooked,
        emailed: body.emailed ?? existing.emailed,
        called: body.called ?? existing.called,
        texted: body.texted ?? existing.texted,
        notes: body.notes ?? existing.notes,
        emailTemplate: body.emailTemplate ?? existing.emailTemplate,
        dmAt: body.dmAt !== undefined ? (body.dmAt ? new Date(body.dmAt) : null) : existing.dmAt,
        meetingAt: body.meetingAt !== undefined ? (body.meetingAt ? new Date(body.meetingAt) : null) : existing.meetingAt,
        emailedAt: body.emailedAt !== undefined ? (body.emailedAt ? new Date(body.emailedAt) : null) : existing.emailedAt,
        calledAt: body.calledAt !== undefined ? (body.calledAt ? new Date(body.calledAt) : null) : existing.calledAt,
        textedAt: body.textedAt !== undefined ? (body.textedAt ? new Date(body.textedAt) : null) : existing.textedAt,
      },
    });

    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    console.error('[PATCH /api/sales-leads/:id]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/sales-leads/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || decoded.role !== 'sales') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.salesLead.findFirst({
      where: { id: params.id, userId: decoded.userId },
    });
    if (!existing) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    await prisma.salesLead.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/sales-leads/:id]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
