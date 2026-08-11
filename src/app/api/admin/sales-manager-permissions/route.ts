export const dynamic = 'force-dynamic';
// src/app/api/admin/sales-manager-permissions/route.ts
//
// GET  - list all sales managers with their permitted sales reps
// POST - grant permission  { managerId: number, salesRepId: number }
// DELETE - revoke permission { managerId: number, salesRepId: number }
//
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
    user as userTable,
    salesManagerPermission as salesManagerPermissionTable,
} from '@/lib/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import { createId } from '@/lib/db/id';
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
        const rawManagers = await db.query.user.findMany({
            where: eq(userTable.role, 'sales_manager' as any),
            columns: { id: true, name: true, email: true, image: true },
            with: {
                salesManagerPermissions_managerId: {
                    columns: { salesRepId: true, id: true },
                },
            },
            orderBy: asc(userTable.name),
        });
        const managers = rawManagers.map((m: any) => {
            const { salesManagerPermissions_managerId, ...rest } = m;
            return { ...rest, salesManagerPermissions: salesManagerPermissions_managerId };
        });

        const salesReps = await db.select({ id: userTable.id, name: userTable.name, email: userTable.email })
            .from(userTable)
            .where(eq(userTable.role, 'sales' as any))
            .orderBy(asc(userTable.name));

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

        const [manager] = await db.select().from(userTable)
            .where(and(eq(userTable.id, Number(managerId)), eq(userTable.role, 'sales_manager' as any)))
            .limit(1);
        if (!manager) {
            return NextResponse.json({ error: 'Sales manager not found' }, { status: 404 });
        }

        const [salesRep] = await db.select().from(userTable)
            .where(and(eq(userTable.id, Number(salesRepId)), eq(userTable.role, 'sales' as any)))
            .limit(1);
        if (!salesRep) {
            return NextResponse.json({ error: 'Sales rep not found' }, { status: 404 });
        }

        await db.insert(salesManagerPermissionTable)
            .values({ id: createId(), managerId: Number(managerId), salesRepId: Number(salesRepId) })
            .onConflictDoNothing({ target: [salesManagerPermissionTable.managerId, salesManagerPermissionTable.salesRepId] });

        const [permission] = await db.select().from(salesManagerPermissionTable)
            .where(and(eq(salesManagerPermissionTable.managerId, Number(managerId)), eq(salesManagerPermissionTable.salesRepId, Number(salesRepId))))
            .limit(1);

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

        await db.delete(salesManagerPermissionTable)
            .where(and(eq(salesManagerPermissionTable.managerId, Number(managerId)), eq(salesManagerPermissionTable.salesRepId, Number(salesRepId))));

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[sales-manager-permissions] DELETE error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
