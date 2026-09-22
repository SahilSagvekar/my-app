export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { and, eq, or, arrayContains } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// GET — list active videographers, for the "who is doing it" picker on the
// Shooting Schedule create/edit form. Deliberately lighter-weight than
// /api/employee/management (which is admin-only) since videographers
// themselves need to read this list too.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['admin', 'manager', 'videographer'].includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Primary role OR videographer as a secondary role (switch-role users
    // like admins/managers who also shoot) — was only matching primary
    // role before, so anyone with videographer as a secondary role never
    // showed up in this picker.
    const videographers = await db.select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
    }).from(userTable).where(and(
      or(eq(userTable.role, 'videographer'), arrayContains(userTable.roles, ['videographer'])),
      eq(userTable.employeeStatus, 'ACTIVE')
    ));

    return NextResponse.json({ videographers });
  } catch (error: any) {
    console.error('[Videographers] GET error:', error);
    return NextResponse.json({ error: 'Failed to load videographers' }, { status: 500 });
  }
}