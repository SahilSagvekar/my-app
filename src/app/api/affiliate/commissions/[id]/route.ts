import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// PATCH /api/affiliate/commissions/[id] — admin: approve / mark paid / cancel
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || decoded.role !== 'admin') {
            return NextResponse.json({ ok: false, message: 'Admin only' }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { status, notes } = body;

        const validStatuses = ['PENDING', 'APPROVED', 'PAID', 'CANCELLED'];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json({ ok: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        const existing = await (prisma as any).affiliateCommission.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json({ ok: false, message: 'Commission not found' }, { status: 404 });
        }

        const updateData: any = {};
        if (status) {
            updateData.status = status;
            if (status === 'APPROVED') {
                updateData.approvedAt = new Date();
                updateData.approvedBy = decoded.userId;
            }
            if (status === 'PAID') {
                updateData.paidAt = new Date();
                if (!existing.approvedAt) {
                    updateData.approvedAt = new Date();
                    updateData.approvedBy = decoded.userId;
                }
            }
        }
        if (notes !== undefined) {
            updateData.notes = notes;
        }

        const commission = await (prisma as any).affiliateCommission.update({
            where: { id },
            data: updateData,
            include: {
                user: { select: { id: true, name: true, email: true, image: true } },
                lead: { select: { id: true, name: true, company: true, status: true, value: true } },
            },
        });

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
