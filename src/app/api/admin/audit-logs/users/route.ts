export const dynamic = 'force-dynamic';
// app/api/admin/audit-logs/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { auditLog as auditLogTable, user as userTable } from '@/lib/db/schema';
import { isNotNull, inArray, asc } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    
    if (authError) {
      return NextResponse.json(
        { ok: false, message: authError.error },
        { status: authError.status }
      );
    }

    // Get all users who have audit log entries
    const usersWithLogs = await db.selectDistinct({ userId: auditLogTable.userId })
      .from(auditLogTable)
      .where(isNotNull(auditLogTable.userId));

    const userIds = usersWithLogs.map(u => u.userId).filter(id => id !== null) as number[];

    const users = userIds.length > 0
      ? await db.select({ id: userTable.id, name: userTable.name, role: userTable.role })
          .from(userTable)
          .where(inArray(userTable.id, userIds))
          .orderBy(asc(userTable.name))
      : [];

    const formattedUsers = users.map(user => ({
      id: user.id.toString(),
      name: `${user.name} (${user.role})`
    }));

    return NextResponse.json({
      ok: true,
      users: [
        { id: 'all', name: 'All Users' },
        ...formattedUsers,
        { id: 'system', name: 'System' }
      ]
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}