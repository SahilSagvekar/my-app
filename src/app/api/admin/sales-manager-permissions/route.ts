export const dynamic = 'force-dynamic';
// src/app/api/admin/sales-manager-permissions/route.ts
//
// GET  - list all sales managers with their permitted sales reps
// POST - grant permission  { managerId: number, salesRepId: number }
// DELETE - revoke permission { managerId: number, salesRepId: number }
//
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

function verifyAdmin(req: Request) {
    const token = getTokenFromCookies(req);
    if (!token) return null;
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || decoded.role !== 'admin') return null;
        return decoded;
    } catch {
        return null;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET: Return all sales managers (role=sales_manager) + their permitted rep IDs,
// plus the full list of sales reps (role=sales) for the admin dropdown
// ──────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const managers = await (prisma as any).user.findMany({
            where: { role: 'sales_manager' },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                salesManagerPermissions: {
                    select: { salesRepId: true, id: true },
                },
            },
            orderBy: { name: 'asc' },
        });

        const salesReps = await prisma.user.findMany({
            where: { role: 'sales' },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({ managers, salesReps });
    } catch (err: any) {
        console.error('[sales-manager-permissions] GET error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST: Grant a sales manager visibility into a sales rep's leads/commissions
// ──────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { managerId, salesRepId } = await req.json();

        if (!managerId || !salesRepId) {
            return NextResponse.json({ error: 'managerId and salesRepId are required' }, { status: 400 });
        }

        const manager = await (prisma as any).user.findFirst({
            where: { id: Number(managerId), role: 'sales_manager' },
        });
        if (!manager) {
            return NextResponse.json({ error: 'Sales manager not found' }, { status: 404 });
        }

        const salesRep = await prisma.user.findFirst({
            where: { id: Number(salesRepId), role: 'sales' },
        });
        if (!salesRep) {
            return NextResponse.json({ error: 'Sales rep not found' }, { status: 404 });
        }

        const permission = await (prisma as any).salesManagerPermission.upsert({
            where: { managerId_salesRepId: { managerId: Number(managerId), salesRepId: Number(salesRepId) } },
            create: { managerId: Number(managerId), salesRepId: Number(salesRepId) },
            update: {},
        });

        return NextResponse.json({ success: true, permission });
    } catch (err: any) {
        console.error('[sales-manager-permissions] POST error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// DELETE: Revoke permission
// ──────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { managerId, salesRepId } = await req.json();

        if (!managerId || !salesRepId) {
            return NextResponse.json({ error: 'managerId and salesRepId are required' }, { status: 400 });
        }

        await (prisma as any).salesManagerPermission.deleteMany({
            where: { managerId: Number(managerId), salesRepId: Number(salesRepId) },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[sales-manager-permissions] DELETE error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
