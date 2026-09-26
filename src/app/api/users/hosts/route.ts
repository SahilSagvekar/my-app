export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// GET — active host accounts, for the "Host" picker on the Shooting Schedule
// create/edit form. Same audience as /api/users/videographers (whoever can
// create shoots). Returns only what the picker needs — no rates, no contact
// details beyond email.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const callerRoles = [(user.role || '').toLowerCase(), ...((user as any).roles || []).map((r: string) => r.toLowerCase())];
    if (!callerRoles.some((r) => ['admin', 'manager', 'videographer'].includes(r))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Compared as text so this keeps working whether or not the `host` value has been
    // added to the Role enum yet (a direct enum comparison would error before that).
    const hosts = await db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email })
      .from(userTable)
      .where(
        and(
          sql`(${userTable.role}::text = 'host' OR 'host' = ANY(${userTable.roles}::text[]))`,
          eq(userTable.employeeStatus, 'ACTIVE')
        )
      );

    return NextResponse.json({ hosts });
  } catch (error: any) {
    console.error('[Hosts] GET error:', error);
    return NextResponse.json({ error: 'Failed to load hosts' }, { status: 500 });
  }
}
