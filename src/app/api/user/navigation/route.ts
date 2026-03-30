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

        // 🔥 Additional filtering for client role based on hasPostingServices
        let finalItems = [...allItems];
        if (role === 'client') {
            const user = await prisma.user.findFirst({
                where: { id: Number(decoded.userId) },
                include: { client: { select: { hasPostingServices: true } } }
            });

            const hasPosting = (user as any)?.client?.hasPostingServices ?? true;
            if (!hasPosting) {
                const forbiddenIds = ['posted', 'monthly-overview', 'youtube-analytics', 'instagram-analytics', 'archive', 'feedback'];
                finalItems = finalItems.filter(item => !forbiddenIds.includes(item.id));
            }
        }

        // 🔥 Dynamically inject 'logins' nav item for users who have login access
        // but whose role doesn't include it in the default nav config
        const hasLoginsInNav = finalItems.some(item => item.id === 'logins');
        if (!hasLoginsInNav) {
            const userId = Number(decoded.userId);
            const userRole = (decoded.role as string).toLowerCase();
            
            const hasLoginAccess = await prisma.socialLogin.findFirst({
                where: {
                    OR: [
                        { allowedRoles: { has: userRole } },
                        { allowedUserIds: { has: userId } },
                    ],
                },
                select: { id: true },
            });

            if (hasLoginAccess) {
                // Insert 'logins' before 'feedback' if it exists, otherwise at the end
                const feedbackIndex = finalItems.findIndex(item => item.id === 'feedback');
                const loginsItem = { id: 'logins', label: 'Logins', icon: 'LogIn' };
                if (feedbackIndex !== -1) {
                    finalItems.splice(feedbackIndex, 0, loginsItem as any);
                } else {
                    finalItems.push(loginsItem as any);
                }
            }
        }

        // Track which items were dynamically injected (not in the original nav config)
        const staticItemIds = new Set(allItems.map(item => item.id));
        const dynamicallyInjectedIds = new Set(
            finalItems.filter(item => !staticItemIds.has(item.id)).map(item => item.id)
        );

        if (!permissions) {
            // Default to filtered items if no record exists
            return NextResponse.json(finalItems);
        }

        const enabledIds = permissions.navigationItems as string[];
        // Keep dynamically injected items (they were granted via allowedUserIds/allowedRoles)
        const filteredItems = finalItems.filter(item =>
            enabledIds.includes(item.id) || dynamicallyInjectedIds.has(item.id)
        );

        // Safety: if permissions filter wiped all items (stale/wrong DB record), return the full role nav
        return NextResponse.json(filteredItems.length > 0 ? filteredItems : finalItems);

    } catch (error: any) {
        console.error('Error fetching user navigation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
