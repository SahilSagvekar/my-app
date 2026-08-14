export const dynamic = 'force-dynamic';
// app/api/admin/audit-logs/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auditLog as auditLogTable, user as userTable } from '@/lib/db/schema';
import { and, eq, gte, lte, ilike, inArray, isNotNull, desc, count } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    
    if (authError) {
      return NextResponse.json(
        { ok: false, message: authError.error },
        { status: authError.status }
      );
    }

    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Build date filter
    const dateConditions = [];
    if (startDate && endDate) {
      dateConditions.push(gte(auditLogTable.timestamp, new Date(startDate).toISOString()));
      dateConditions.push(lte(auditLogTable.timestamp, new Date(endDate).toISOString()));
    }
    const dateWhere = dateConditions.length ? and(...dateConditions) : undefined;

    // Get total logs
    const [{ value: totalLogs }] = await db.select({ value: count() })
      .from(auditLogTable)
      .where(dateWhere);

    // Get today's logs
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [{ value: todayLogs }] = await db.select({ value: count() })
      .from(auditLogTable)
      .where(and(
        gte(auditLogTable.timestamp, todayStart.toISOString()),
        lte(auditLogTable.timestamp, todayEnd.toISOString())
      ));

    // Get high severity events (deletions, failures, errors)
    const [{ value: highSeverityLogs }] = await db.select({ value: count() })
      .from(auditLogTable)
      .where(and(
        inArray(auditLogTable.action, ['USER_DELETED', 'TASK_DELETED', 'CLIENT_DELETED', 'LOGIN_FAILED', 'PERMISSION_DENIED']),
        dateWhere
      ));

    // Get security events
    const [{ value: securityLogs }] = await db.select({ value: count() })
      .from(auditLogTable)
      .where(and(
        ilike(auditLogTable.action, '%LOGIN%'),
        dateWhere
      ));

    // Get action type breakdown
    const actionBreakdown = await db.select({ action: auditLogTable.action, cnt: count() })
      .from(auditLogTable)
      .where(dateWhere)
      .groupBy(auditLogTable.action)
      .orderBy(desc(count()))
      .limit(10);

    // Get user activity breakdown
    const userActivity = await db.select({ userId: auditLogTable.userId, cnt: count() })
      .from(auditLogTable)
      .where(and(isNotNull(auditLogTable.userId), dateWhere))
      .groupBy(auditLogTable.userId)
      .orderBy(desc(count()))
      .limit(10);

    // Get user details
    const userIds = userActivity.map(u => u.userId).filter(id => id !== null) as number[];
    const users = userIds.length > 0
      ? await db.select({ id: userTable.id, name: userTable.name, role: userTable.role })
          .from(userTable)
          .where(inArray(userTable.id, userIds))
      : [];

    const userActivityWithDetails = userActivity.map(activity => {
      const user = users.find(u => u.id === activity.userId);
      return {
        userId: activity.userId,
        userName: user?.name || 'Unknown',
        userRole: user?.role || 'Unknown',
        count: activity.cnt
      };
    });

    return NextResponse.json({
      ok: true,
      stats: {
        totalLogs,
        todayLogs,
        highSeverity: highSeverityLogs,
        securityEvents: securityLogs,
        actionBreakdown: actionBreakdown.map(a => ({
          action: a.action,
          count: a.cnt
        })),
        userActivity: userActivityWithDetails
      }
    });

  } catch (error) {
    console.error('Error fetching audit log stats:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}