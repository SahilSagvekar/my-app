export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { salesLead, affiliateCommission } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, inArray } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { getVisibleSalesRepIds } from '@/lib/salesManagerPermissions';
import { getCommissionRateForUser } from '@/lib/payout-config';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// PATCH /api/sales-leads/[id] — update a lead
// admin: any lead. sales_manager: own leads + permitted reps' leads. sales: own leads only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || !['sales', 'admin', 'sales_manager'].includes(decoded.role)) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const whereCondition =
      decoded.role === 'admin'
        ? eq(salesLead.id, id)
        : decoded.role === 'sales_manager'
          ? and(eq(salesLead.id, id), inArray(salesLead.userId, await getVisibleSalesRepIds(Number(decoded.userId))))
          : and(eq(salesLead.id, id), eq(salesLead.userId, decoded.userId));

    const [existing] = await db.select().from(salesLead).where(whereCondition).limit(1);
    if (!existing) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    const body = await req.json();

    const [lead] = await db.update(salesLead).set({
      name: body.name ?? existing.name,
      company: body.company ?? existing.company,
      email: body.email ?? existing.email,
      phone: body.phone ?? existing.phone,
      profileUrl: body.profileUrl !== undefined ? body.profileUrl || null : existing.profileUrl,
      postUrl: body.postUrl !== undefined ? body.postUrl || null : existing.postUrl,
      socials: body.socials ?? existing.socials,
      instagram: body.instagram !== undefined ? !!body.instagram : existing.instagram,
      facebook: body.facebook !== undefined ? !!body.facebook : existing.facebook,
      linkedin: body.linkedin !== undefined ? !!body.linkedin : existing.linkedin,
      twitter: body.twitter !== undefined ? !!body.twitter : existing.twitter,
      tiktok: body.tiktok !== undefined ? !!body.tiktok : existing.tiktok,
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
      dmAt: body.dmAt !== undefined ? (body.dmAt ? new Date(body.dmAt).toISOString() : null) : existing.dmAt,
      meetingAt: body.meetingAt !== undefined ? (body.meetingAt ? new Date(body.meetingAt).toISOString() : null) : existing.meetingAt,
      emailedAt: body.emailedAt !== undefined ? (body.emailedAt ? new Date(body.emailedAt).toISOString() : null) : existing.emailedAt,
      calledAt: body.calledAt !== undefined ? (body.calledAt ? new Date(body.calledAt).toISOString() : null) : existing.calledAt,
      textedAt: body.textedAt !== undefined ? (body.textedAt ? new Date(body.textedAt).toISOString() : null) : existing.textedAt,
      updatedAt: new Date().toISOString(),
    }).where(eq(salesLead.id, id)).returning();

    // ─── Affiliate Commission Logic ──────────────────────────────────────
    const newStatus = lead.status;
    const oldStatus = existing.status;
    const dealValue = lead.value;

    // Status changed TO "WON" — auto-create commission
    if (newStatus === 'WON' && oldStatus !== 'WON' && dealValue && dealValue > 0) {
      try {
        const [existingCommission] = await db.select().from(affiliateCommission)
          .where(eq(affiliateCommission.leadId, lead.id)).limit(1);
        if (!existingCommission) {
          const commissionRate = await getCommissionRateForUser(decoded.userId);
          const commissionAmt = dealValue * commissionRate;
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          await db.insert(affiliateCommission).values({
            id: createId(),
            salesUserId: decoded.userId,
            leadId: lead.id,
            clientName: lead.company || lead.name || '',
            dealValue: String(dealValue),
            commissionRate: String(commissionRate),
            commissionAmt: String(commissionAmt),
            month: monthStart.toISOString(),
            status: 'PENDING',
            updatedAt: new Date().toISOString(),
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
        const [existingCommission] = await db.select().from(affiliateCommission)
          .where(eq(affiliateCommission.leadId, lead.id)).limit(1);
        if (existingCommission && existingCommission.status === 'PENDING') {
          await db.delete(affiliateCommission).where(eq(affiliateCommission.id, existingCommission.id));
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
  const db = getDbHttp();
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    // Allow sales rep to delete their own, or admin to delete any
    if (!decoded?.userId || !['sales', 'admin', 'sales_manager'].includes(decoded.role)) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const [existing] = await db.select().from(salesLead)
      .where(decoded.role === 'admin' ? eq(salesLead.id, id) : and(eq(salesLead.id, id), eq(salesLead.userId, decoded.userId)))
      .limit(1);
    if (!existing) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    // Handle foreign key constraint for commissions
    await db.delete(affiliateCommission).where(eq(affiliateCommission.leadId, id));

    await db.delete(salesLead).where(eq(salesLead.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/sales-leads/:id]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
