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
        company: body.company ?? existing.company,
        email: body.email ?? existing.email,
        phone: body.phone ?? existing.phone,
        socials: body.socials ?? existing.socials,
        status: body.status ?? existing.status,
        source: body.source ?? existing.source,
        value: body.value !== undefined ? (body.value ? parseFloat(body.value) : null) : existing.value,
        priority: body.priority ?? existing.priority,
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

    // ─── Affiliate Commission Logic ──────────────────────────────────────
    const newStatus = lead.status;
    const oldStatus = existing.status;
    const dealValue = lead.value;

    // Status changed TO "WON" — auto-create commission
    if (newStatus === 'WON' && oldStatus !== 'WON' && dealValue && dealValue > 0) {
      try {
        const existingCommission = await (prisma as any).affiliateCommission.findUnique({
          where: { leadId: lead.id },
        });
        if (!existingCommission) {
          const commissionAmt = dealValue * 0.15;
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          await (prisma as any).affiliateCommission.create({
            data: {
              salesUserId: decoded.userId,
              leadId: lead.id,
              clientName: lead.company || lead.name || '',
              dealValue,
              commissionRate: 0.15,
              commissionAmt,
              month: monthStart,
              status: 'PENDING',
            },
          });
          console.log(`[AFFILIATE] Created commission for lead ${lead.id}: $${commissionAmt}`);
        }
      } catch (err) {
        console.error('[AFFILIATE] Failed to create commission:', err);
      }
    }

    // Status changed AWAY from "WON" — remove pending commission
    if (oldStatus === 'WON' && newStatus !== 'WON') {
      try {
        const existingCommission = await (prisma as any).affiliateCommission.findUnique({
          where: { leadId: lead.id },
        });
        if (existingCommission && existingCommission.status === 'PENDING') {
          await (prisma as any).affiliateCommission.delete({
            where: { id: existingCommission.id },
          });
          console.log(`[AFFILIATE] Removed pending commission for lead ${lead.id}`);
        }
      } catch (err) {
        console.error('[AFFILIATE] Failed to remove commission:', err);
      }
    }
    // ─────────────────────────────────────────────────────────────────────

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
