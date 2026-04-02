export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NAVIGATION_ITEMS, type NavigationRole } from '@/components/constants/navigation';
import { getCurrentUser2 } from '@/lib/auth';

type NavigationItem = (typeof NAVIGATION_ITEMS)[NavigationRole][number];

// GET /api/user/navigation - Fetch navigation items permitted for the current user's role
export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const requestedRole = searchParams.get('role')?.toLowerCase() as NavigationRole | null;

        let role = (user.role as string).toLowerCase() as NavigationRole;

        // 🔥 If user is admin or manager, they can request navigation for other roles (for View As feature)
        if ((role === 'admin' || role === 'manager') && requestedRole && NAVIGATION_ITEMS[requestedRole as NavigationRole]) {
            role = requestedRole as NavigationRole;
        }

        if (!NAVIGATION_ITEMS[role]) {
            return NextResponse.json([], { status: 200 }); // No items for this role
        }

        // Get permissions from DB manually to bypass Prisma client generation issues
        const permissionsList = await prisma.$queryRaw<Array<{ navigationItems: string[] | null }>>`
            SELECT "navigationItems" FROM "RolePermission" WHERE "role"::text = ${role} LIMIT 1
        `;
        const permissions = permissionsList[0];
        const allItems = NAVIGATION_ITEMS[role];

        // 🔥 Additional filtering for client role based on hasPostingServices
        let finalItems = [...allItems];
        if (role === 'client') {
            const clientUser = await prisma.user.findFirst({
                where: { id: Number(user.id) },
                include: { client: { select: { hasPostingServices: true } } }
            });

            const hasPosting = clientUser?.client?.hasPostingServices ?? true;
            if (!hasPosting) {
                const forbiddenIds = ['posted', 'monthly-overview', 'youtube-analytics', 'instagram-analytics', 'archive', 'feedback'];
                finalItems = finalItems.filter(item => !forbiddenIds.includes(item.id));
            }
        }

        // 🔥 Dynamically inject 'logins' nav item for users who have login access
        // but whose role doesn't include it in the default nav config
        const hasLoginsInNav = finalItems.some(item => item.id === 'logins');
        if (!hasLoginsInNav) {
            const userId = Number(user.id);
            const userRole = (user.role as string).toLowerCase();
            
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
                const loginsItem = { id: 'logins', label: 'Logins', icon: 'LogIn' } as NavigationItem;
                if (feedbackIndex !== -1) {
                    finalItems.splice(feedbackIndex, 0, loginsItem);
                } else {
                    finalItems.push(loginsItem);
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

        const enabledIds = permissions.navigationItems ?? [];
        // Keep dynamically injected items (they were granted via allowedUserIds/allowedRoles)
        const filteredItems = finalItems.filter(item => 
            enabledIds.includes(item.id) || dynamicallyInjectedIds.has(item.id)
        );

        return NextResponse.json(filteredItems);

    } catch (error: unknown) {
        console.error('Error fetching user navigation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
