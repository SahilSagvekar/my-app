import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getVisibleSalesRepIds } from '@/lib/salesManagerPermissions';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// PATCH /api/affiliate/commissions/[id] — admin/sales_manager: approve / mark paid / cancel
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || (decoded.role !== 'admin' && decoded.role !== 'sales_manager')) {
            return NextResponse.json({ ok: false, message: 'Admin only' }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { status, notes, amount, bonusAmount, reason } = body;

        // PAID / PAYOUT_PENDING / FAILED are system-controlled — they only change via
        // the Stripe transfer + webhook flow (src/lib/stripe-payouts.ts), never by
        // direct admin PATCH, so a manual status update can never desync from real
        // money movement.
        const validStatuses = ['PENDING', 'APPROVED', 'CANCELLED'];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json({ ok: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        const existing = await (prisma as any).affiliateCommission.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json({ ok: false, message: 'Commission not found' }, { status: 404 });
        }

        if (decoded.role === 'sales_manager') {
            const visibleRepIds = await getVisibleSalesRepIds(Number(decoded.userId));
            if (!visibleRepIds.includes(existing.salesUserId)) {
                return NextResponse.json({ ok: false, message: 'This commission is outside your permitted reps' }, { status: 403 });
            }
        }

        if (status === 'APPROVED' && existing.holdUntil && new Date(existing.holdUntil) > new Date()) {
            return NextResponse.json({
                ok: false,
                message: `Still in hold window until ${new Date(existing.holdUntil).toLocaleDateString()} (refund/dispute protection)`,
            }, { status: 400 });
        }

        // Never approve a payout for a deal the client hasn't actually paid on.
        if (status === 'APPROVED') {
            const lead = await prisma.salesLead.findUnique({
                where: { id: existing.leadId },
                select: { convertedToClientId: true },
            });
            if (!lead?.convertedToClientId) {
                return NextResponse.json({
                    ok: false,
                    message: 'This lead has not been converted to a client yet — no invoice to confirm payment against',
                }, { status: 400 });
            }
            const paidInvoice = await prisma.invoice.findFirst({
                where: { status: 'PAID', stripeCustomer: { clientId: lead.convertedToClientId } },
            });
            if (!paidInvoice) {
                return NextResponse.json({
                    ok: false,
                    message: 'Client has not paid an invoice yet — cannot approve commission until payment is received',
                }, { status: 400 });
            }
        }

        // Amount edit / bonus addition — both write an audit row before touching
        // the commission amount, per the dev doc's audit trail requirement.
        const adjustments: { commissionId: string; editedById: number; adjustmentType: string; previousAmount: any; newAmount: any; reason: string | null }[] = [];
        let newCommissionAmt: number | undefined;

        if (amount !== undefined) {
            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                return NextResponse.json({ ok: false, message: 'amount must be a positive number' }, { status: 400 });
            }
            adjustments.push({
                commissionId: id,
                editedById: decoded.userId,
                adjustmentType: 'EDIT',
                previousAmount: existing.commissionAmt,
                newAmount: parsedAmount,
                reason: reason ?? null,
            });
            newCommissionAmt = parsedAmount;
        }

        if (bonusAmount !== undefined) {
            const parsedBonus = parseFloat(bonusAmount);
            if (isNaN(parsedBonus) || parsedBonus <= 0) {
                return NextResponse.json({ ok: false, message: 'bonusAmount must be a positive number' }, { status: 400 });
            }
            const base = newCommissionAmt ?? parseFloat(existing.commissionAmt);
            const withBonus = base + parsedBonus;
            adjustments.push({
                commissionId: id,
                editedById: decoded.userId,
                adjustmentType: 'BONUS',
                previousAmount: base,
                newAmount: withBonus,
                reason: reason ?? null,
            });
            newCommissionAmt = withBonus;
        }

        const updateData: any = {};
        if (status) {
            updateData.status = status;
            if (status === 'APPROVED') {
                updateData.approvedAt = new Date();
                updateData.approvedBy = decoded.userId;
            }
        }
        if (notes !== undefined) {
            updateData.notes = notes;
        }
        if (newCommissionAmt !== undefined) {
            updateData.commissionAmt = newCommissionAmt;
        }

        const [commission] = await prisma.$transaction([
            (prisma as any).affiliateCommission.update({
                where: { id },
                data: updateData,
                include: {
                    user: { select: { id: true, name: true, email: true, image: true } },
                    lead: { select: { id: true, name: true, company: true, status: true, value: true } },
                },
            }),
            ...adjustments.map(a => (prisma as any).commissionAdjustment.create({ data: a })),
        ]);

        return NextResponse.json({ ok: true, commission });
    } catch (err) {
        console.error('[PATCH /api/affiliate/commissions/:id]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}

// DELETE /api/affiliate/commissions/[id] — cancel/remove commission (when lead status changes away from WON)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || (decoded.role !== 'sales' && decoded.role !== 'admin')) {
            return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;

        // Only allow deleting PENDING commissions (not approved/paid ones)
        const existing = await (prisma as any).affiliateCommission.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json({ ok: true, message: 'Already deleted' });
        }

        if (existing.status !== 'PENDING' && decoded.role !== 'admin') {
            return NextResponse.json({ ok: false, message: 'Cannot delete non-pending commission' }, { status: 400 });
        }

        await (prisma as any).affiliateCommission.delete({ where: { id } });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/affiliate/commissions/:id]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}
