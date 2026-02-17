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

// GET /api/user/navigation - Fetch navigation items permitted for the current user's role
export async function GET(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId || !decoded.role) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const requestedRole = searchParams.get('role')?.toLowerCase() as NavigationRole | null;

        let role = (decoded.role as string).toLowerCase() as NavigationRole;

        // 🔥 If user is admin or manager, they can request navigation for other roles (for View As feature)
        if ((role === 'admin' || role === 'manager') && requestedRole && NAVIGATION_ITEMS[requestedRole as NavigationRole]) {
            role = requestedRole as NavigationRole;
        }

        if (!NAVIGATION_ITEMS[role]) {
            return NextResponse.json([], { status: 200 }); // No items for this role
        }

        // Get permissions from DB manually to bypass Prisma client generation issues
        const permissionsList: any[] = await prisma.$queryRaw`SELECT "navigationItems" FROM "RolePermission" WHERE "role"::text = ${role} LIMIT 1`;
        const permissions = permissionsList[0];

        const allItems = NAVIGATION_ITEMS[role];

        if (!permissions) {
            // Default to all items if no record exists
            return NextResponse.json(allItems);
        }

        const enabledIds = permissions.navigationItems as string[];
        const filteredItems = allItems.filter(item => enabledIds.includes(item.id));

        return NextResponse.json(filteredItems);

    } catch (error: any) {
        console.error('Error fetching user navigation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
