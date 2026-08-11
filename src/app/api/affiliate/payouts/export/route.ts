import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { and, gte, lte, desc } from 'drizzle-orm';
import { affiliateCommission } from '@/lib/db/schema';
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

        let monthFilter;
        if (monthParam) {
            const [year, month] = monthParam.split('-').map(Number);
            monthFilter = and(
                gte(affiliateCommission.month, new Date(year, month - 1, 1).toISOString()),
                lte(affiliateCommission.month, new Date(year, month, 0, 23, 59, 59, 999).toISOString()),
            );
        }

        const commissions = await db.query.affiliateCommission.findMany({
            where: monthFilter,
            orderBy: desc(affiliateCommission.createdAt),
            with: {
                user: { columns: { name: true, email: true } },
                commissionPayout: { columns: { stripeTransferId: true, status: true, sentAt: true, paidAt: true, failedAt: true, failureReason: true } },
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
            c.approvedAt ? new Date(c.approvedAt).toISOString() : '',
            c.paidAt ? new Date(c.paidAt).toISOString() : '',
            c.commissionPayout?.stripeTransferId ?? '',
            c.commissionPayout?.status ?? '',
            c.commissionPayout?.failureReason ?? '',
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
