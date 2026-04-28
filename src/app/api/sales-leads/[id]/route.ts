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

// PATCH /api/sales-leads/[id] — update a lead (ownership enforced)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'sales' && decoded.role !== 'admin')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.salesLead.findFirst({
      where: { id, userId: decoded.userId },
    });
    if (!existing) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    const body = await req.json();

    const lead = await prisma.salesLead.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        company: body.company ?? existing.company,
        email: body.email ?? existing.email,
        phone: body.phone ?? existing.phone,
        profileUrl: body.profileUrl !== undefined ? body.profileUrl || null : existing.profileUrl,
        postUrl: body.postUrl !== undefined ? body.postUrl || null : existing.postUrl,
        socials: body.socials ?? (existing as any).socials,
        instagram: body.instagram !== undefined ? !!body.instagram : (existing as any).instagram,
        facebook: body.facebook !== undefined ? !!body.facebook : (existing as any).facebook,
        linkedin: body.linkedin !== undefined ? !!body.linkedin : (existing as any).linkedin,
        twitter: body.twitter !== undefined ? !!body.twitter : (existing as any).twitter,
        tiktok: body.tiktok !== undefined ? !!body.tiktok : (existing as any).tiktok,
        status: body.status ?? existing.status,
        source: body.source ?? existing.source,
        value: body.value !== undefined ? (body.value ? parseFloat(body.value) : null) : existing.value,
        priority: body.priority ?? existing.priority,
        meetingBooked: body.meetingBooked !== undefined ? !!body.meetingBooked : existing.meetingBooked,
        emailed: body.emailed !== undefined ? !!body.emailed : existing.emailed,
        called: body.called !== undefined ? !!body.called : existing.called,
        texted: body.texted !== undefined ? !!body.texted : existing.texted,
        notes: body.notes ?? existing.notes,
        emailTemplate: body.emailTemplate ?? existing.emailTemplate,
        metadata: body.metadata !== undefined ? body.metadata : existing.metadata,
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
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    // Allow sales rep to delete their own, or admin to delete any
    if (!decoded?.userId || (decoded.role !== 'sales' && decoded.role !== 'admin')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.salesLead.findFirst({
      where: decoded.role === 'admin' ? { id } : { id, userId: decoded.userId },
    });
    if (!existing) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    // Handle foreign key constraint for commissions
    await (prisma as any).affiliateCommission.deleteMany({
      where: { leadId: id }
    });

    await prisma.salesLead.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/sales-leads/:id]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
