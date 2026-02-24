import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// GET /api/affiliate/commissions — fetch commissions
export async function GET(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId) {
            return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const all = searchParams.get('all') === 'true';
        const monthParam = searchParams.get('month'); // e.g. "2026-02"

        // Admin can fetch all commissions
        const isAdmin = decoded.role === 'admin';

        let where: any = {};

        if (all && isAdmin) {
            // Admin fetching all commissions
        } else {
            where.salesUserId = decoded.userId;
        }

        if (monthParam) {
            const [year, month] = monthParam.split('-').map(Number);
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
            where.month = { gte: startOfMonth, lte: endOfMonth };
        }

        const commissions = await (prisma as any).affiliateCommission.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true, image: true } },
                lead: { select: { id: true, name: true, company: true, status: true, value: true } },
            },
        });

        // Calculate summary stats
        const totalEarned = commissions
            .filter((c: any) => c.status === 'PAID')
            .reduce((sum: number, c: any) => sum + parseFloat(c.commissionAmt), 0);

        const totalPending = commissions
            .filter((c: any) => c.status === 'PENDING')
            .reduce((sum: number, c: any) => sum + parseFloat(c.commissionAmt), 0);

        const totalApproved = commissions
            .filter((c: any) => c.status === 'APPROVED')
            .reduce((sum: number, c: any) => sum + parseFloat(c.commissionAmt), 0);

        // This month stats
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const thisMonth = commissions
            .filter((c: any) => {
                const m = new Date(c.month);
                return m >= thisMonthStart && m <= thisMonthEnd;
            })
            .reduce((sum: number, c: any) => sum + parseFloat(c.commissionAmt), 0);

        return NextResponse.json({
            ok: true,
            commissions,
            summary: {
                totalEarned,
                totalPending,
                totalApproved,
                thisMonth,
                commissionRate: 0.15,
            },
        });
    } catch (err) {
        console.error('[GET /api/affiliate/commissions]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}

// POST /api/affiliate/commissions — auto-create on WON
export async function POST(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || (decoded.role !== 'sales' && decoded.role !== 'admin')) {
            return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { leadId, clientName, dealValue } = body;

        if (!leadId || !dealValue) {
            return NextResponse.json({ ok: false, message: 'leadId and dealValue are required' }, { status: 400 });
        }

        // Check if commission already exists for this lead
        const existing = await (prisma as any).affiliateCommission.findUnique({
            where: { leadId },
        });

        if (existing) {
            // Update the existing commission if deal value changed
            const commissionAmt = parseFloat(dealValue) * 0.15;
            const updated = await (prisma as any).affiliateCommission.update({
                where: { leadId },
                data: {
                    dealValue: parseFloat(dealValue),
                    commissionAmt,
                    clientName: clientName || '',
                },
            });
            return NextResponse.json({ ok: true, commission: updated, action: 'updated' });
        }

        const commissionAmt = parseFloat(dealValue) * 0.15;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const commission = await (prisma as any).affiliateCommission.create({
            data: {
                salesUserId: decoded.userId,
                leadId,
                clientName: clientName || '',
                dealValue: parseFloat(dealValue),
                commissionRate: 0.15,
                commissionAmt,
                month: monthStart,
                status: 'PENDING',
            },
        });

        return NextResponse.json({ ok: true, commission, action: 'created' });
    } catch (err) {
        console.error('[POST /api/affiliate/commissions]', err);
        return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
}
