export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { user as userTable, rolePermission, socialLogin } from '@/lib/db/schema';
import { eq, or, arrayContains } from 'drizzle-orm';
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
  const db = getDbHttp();
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

        // 🔥 If user is admin/manager, OR switching roles via view-as feature,
        // allow them to request navigation for the target role
        const viewingAs = req.headers.get("x-viewing-as")?.toLowerCase() as NavigationRole | null;

        if ((role === 'admin' || role === 'manager') && requestedRole && NAVIGATION_ITEMS[requestedRole as NavigationRole]) {
            role = requestedRole as NavigationRole;
        } else if (viewingAs && requestedRole && viewingAs === requestedRole && NAVIGATION_ITEMS[viewingAs]) {
            // Any role switching via view-as: header + query param must agree
            role = viewingAs;
        }

        if (!NAVIGATION_ITEMS[role]) {
            return NextResponse.json([], { status: 200 }); // No items for this role
        }

        const [permissions] = await db.select({ navigationItems: rolePermission.navigationItems })
            .from(rolePermission).where(eq(rolePermission.role, role as any)).limit(1);
        const allItems = NAVIGATION_ITEMS[role];

        // 🔥 Additional filtering for client role based on hasPostingServices
        let finalItems = [...allItems];

        // 🔥 AI Agent navigation item is strictly restricted to sahilsagvekar230@gmail.com
        const userEmail = (decoded.email as string || '').toLowerCase().trim();
        if (userEmail !== 'sahilsagvekar230@gmail.com') {
            finalItems = finalItems.filter(item => item.id !== 'ai-agent');
        }

        if (role === 'client') {
            // NOTE: Prisma's `include: { client: true }` here is the reverse
            // relation of Client.userId (1:1, unique-indexed) — drizzle-kit
            // mislabeled that reverse relation `clients: many(client, ...)`
            // on userRelations (unique FK mislabeled many()), so fetch it
            // via `with: { clients: true }` and take [0].
            const userRow = await db.query.user.findFirst({
                where: eq(userTable.id, Number(decoded.userId)),
                with: { clients: { columns: { hasPostingServices: true } } }
            });

            const hasPosting = userRow?.clients?.[0]?.hasPostingServices ?? true;
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
            
            const [hasLoginAccess] = await db.select({ id: socialLogin.id }).from(socialLogin).where(or(
                arrayContains(socialLogin.allowedRoles, [userRole]),
                arrayContains(socialLogin.allowedUserIds, [userId]),
            )).limit(1);

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
        // Expenses is a client-facing billing record, scoped server-side to
        // the signed-in client's own account. Existing role-permission rows
        // predate this item, so keep it visible without requiring a manual
        // permission migration for every client role.
        //
        // production-log, scripts, and portfolio are the same situation —
        // brand new nav ids, no existing RolePermission row for 'client'
        // has ever granted them, so without this they're invisible for
        // every client until an admin manually re-saves permissions in
        // PermissionsTab.
        const requiredClientItems = new Set(['expenses', 'production-log', 'scripts', 'portfolio']);
            // Keep dynamically injected items (they were granted via allowedUserIds/allowedRoles)
        const filteredItems = finalItems.filter(item => 
            enabledIds.includes(item.id) ||
            dynamicallyInjectedIds.has(item.id) ||
            (role === 'client' && requiredClientItems.has(item.id))
        );

        return NextResponse.json(filteredItems);

    } catch (error: any) {
        console.error('Error fetching user navigation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}