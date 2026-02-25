export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NAVIGATION_ITEMS, type NavigationRole } from '@/components/constants/navigation';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// GET /api/admin/permissions - Fetch all role permissions
export async function GET(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || decoded.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
        }

        // Use raw query to bypass Prisma client generation issues
        const dbPermissions: any[] = await prisma.$queryRaw`SELECT * FROM "RolePermission"`;

        // Map of DB permissions for quick lookup
        const permissionMap = new Map(dbPermissions.map((p: any) => [p.role, p.navigationItems]));

        // Prepare response with ALL roles from NAVIGATION_ITEMS
        const roles = Object.keys(NAVIGATION_ITEMS) as NavigationRole[];

        const result = roles.map(role => {
            const enabledItems = permissionMap.get(role as any);
            const allPossibleItems = NAVIGATION_ITEMS[role as NavigationRole].map(item => ({
                id: item.id,
                label: item.label
            }));

            return {
                role,
                enabledItems: enabledItems || allPossibleItems.map(i => i.id),
                allPossibleItems
            };
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Error fetching permissions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST /api/admin/permissions - Update permissions for a role
export async function POST(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || decoded.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
        }

        const { role, enabledItems } = await req.json();

        if (!role || !Array.isArray(enabledItems)) {
            return NextResponse.json({ error: 'Missing role or enabledItems' }, { status: 400 });
        }

        // Use raw SQL to upsert permissions
        const itemsJson = JSON.stringify(enabledItems);
        const now = new Date();
        const id = `perm_${Date.now()}`;

        // Postgres Upsert logic
        await prisma.$executeRaw`
            INSERT INTO "RolePermission" ("id", "role", "navigationItems", "createdAt", "updatedAt")
            VALUES (${id}, ${role}::"Role", ${itemsJson}::jsonb, ${now}, ${now})
            ON CONFLICT ("role") 
            DO UPDATE SET "navigationItems" = ${itemsJson}::jsonb, "updatedAt" = ${now}
        `;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error updating permissions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
