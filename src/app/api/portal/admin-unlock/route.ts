export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { clientPortalAccess as clientPortalAccessTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

function requireAdminOrManager(user: { role?: string | null } | null) {
  return !!user && ['admin', 'manager'].includes(user.role?.toLowerCase() ?? '');
}

// POST /api/portal/admin-unlock — admin bypass: force a locked client's portal open
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!requireAdminOrManager(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await req.json();
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const [portalAccess] = await db.update(clientPortalAccessTable).set({
      status: 'ADMIN_UNLOCKED',
      adminUnlockedById: user!.id,
      adminUnlockedAt: new Date().toISOString(),
      lockedAt: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(clientPortalAccessTable.clientId, clientId)).returning();

    return NextResponse.json({ success: true, portalAccess });
  } catch (err: any) {
    console.error('POST /api/portal/admin-unlock error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// DELETE /api/portal/admin-unlock — revert an admin-unlocked client back to locked
export async function DELETE(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!requireAdminOrManager(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await req.json();
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const [portalAccess] = await db.update(clientPortalAccessTable).set({
      status: 'LOCKED',
      lockedAt: new Date().toISOString(),
      adminUnlockedById: null,
      adminUnlockedAt: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(clientPortalAccessTable.clientId, clientId)).returning();

    return NextResponse.json({ success: true, portalAccess });
  } catch (err: any) {
    console.error('DELETE /api/portal/admin-unlock error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
