import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

function csvEscape(value: string): string {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
}

// GET /api/affiliate/payouts/export — admin-only CSV export for accounting
// reconciliation (matches paid commissions against Stripe balance transactions).
export async function GET(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || decoded.role !== 'admin') {
            return NextResponse.json({ ok: false, message: 'Admin only' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const monthParam = searchParams.get('month'); // e.g. "2026-07"

        const where: any = {};
        if (monthParam) {
            const [year, month] = monthParam.split('-').map(Number);
            where.month = {
                gte: new Date(year, month - 1, 1),
                lte: new Date(year, month, 0, 23, 59, 59, 999),
            };
        }

        const commissions = await prisma.affiliateCommission.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { name: true, email: true } },
                payout: { select: { stripeTransferId: true, status: true, sentAt: true, paidAt: true, failedAt: true, failureReason: true } },
            },
        });

        const headers = [
            'Commission ID', 'Sales Rep', 'Rep Email', 'Client', 'Deal Value', 'Commission Amount',
            'Currency', 'Status', 'Approved At', 'Paid At', 'Stripe Transfer ID', 'Payout Status', 'Failure Reason',
        ];

        const rows = commissions.map((c) => [
            c.id,
            c.user?.name ?? '',
            c.user?.email ?? '',
            c.clientName,
            c.dealValue.toString(),
            c.commissionAmt.toString(),
            c.currency,
            c.status,
            c.approvedAt?.toISOString() ?? '',
            c.paidAt?.toISOString() ?? '',
            c.payout?.stripeTransferId ?? '',
            c.payout?.status ?? '',
            c.payout?.failureReason ?? '',
        ]);

        const csv = [headers, ...rows].map((row) => row.map((v) => csvEscape(String(v))).join(',')).join('\n');

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="commission-payouts${monthParam ? `-${monthParam}` : ''}.csv"`,
            },
        });
    } catch (err) {
        console.error('[GET /api/affiliate/payouts/export]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}
