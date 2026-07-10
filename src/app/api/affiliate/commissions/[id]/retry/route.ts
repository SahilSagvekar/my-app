import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { sendCommissionTransfer, PayoutError } from '@/lib/stripe-payouts';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// POST /api/affiliate/commissions/[id]/retry — admin-only.
// Resets a FAILED commission to APPROVED and immediately retries the Stripe
// transfer, rather than waiting for the next weekly batch run.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || decoded.role !== 'admin') {
            return NextResponse.json({ ok: false, message: 'Admin only' }, { status: 403 });
        }

        const { id } = await params;
        const existing = await prisma.affiliateCommission.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ ok: false, message: 'Commission not found' }, { status: 404 });
        }
        if (existing.status !== 'FAILED') {
            return NextResponse.json({ ok: false, message: `Can only retry FAILED commissions (found ${existing.status})` }, { status: 400 });
        }

        await prisma.affiliateCommission.update({ where: { id }, data: { status: 'APPROVED' } });

        try {
            const result = await sendCommissionTransfer(id);
            return NextResponse.json({ ok: true, result });
        } catch (err: any) {
            const message = err instanceof PayoutError ? err.message : 'Retry failed — commission left in FAILED state';
            return NextResponse.json({ ok: false, message }, { status: 502 });
        }
    } catch (err) {
        console.error('[POST /api/affiliate/commissions/:id/retry]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}
