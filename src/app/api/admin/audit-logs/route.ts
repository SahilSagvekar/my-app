export const dynamic = 'force-dynamic';
// app/api/admin/audit-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auditLog as auditLogTable, user as userTable } from '@/lib/db/schema';
import { and, or, eq, gte, lte, ilike, desc, count } from 'drizzle-orm';
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
    
    // Get query parameters
    const search = url.searchParams.get('search') || '';
    const actionType = url.searchParams.get('actionType') || 'all';
    const userId = url.searchParams.get('userId') || 'all';
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    // Build where clause
    const conditions = [];

    // Search filter
    if (search) {
      conditions.push(or(
        ilike(auditLogTable.action, `%${search}%`),
        ilike(auditLogTable.details, `%${search}%`),
        ilike(auditLogTable.entity, `%${search}%`),
        ilike(userTable.name, `%${search}%`)
      ));
    }

    // Action type filter (map to your action naming convention)
    if (actionType && actionType !== 'all') {
      // You can map frontend action types to your backend action types
      conditions.push(ilike(auditLogTable.action, `%${actionType.toUpperCase()}%`));
    }

    // User filter
    if (userId && userId !== 'all') {
      conditions.push(eq(auditLogTable.userId, parseInt(userId)));
    }

    // Date range filter
    if (startDate && endDate) {
      conditions.push(gte(auditLogTable.timestamp, new Date(startDate).toISOString()));
      conditions.push(lte(auditLogTable.timestamp, new Date(endDate).toISOString()));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    // Get total count for pagination
    const [{ value: total }] = await db.select({ value: count() })
      .from(auditLogTable)
      .leftJoin(userTable, eq(auditLogTable.userId, userTable.id))
      .where(where);

    // Fetch audit logs with pagination
    const rows = await db.select({
      log: auditLogTable,
      User: { id: userTable.id, name: userTable.name, email: userTable.email, role: userTable.role },
    })
      .from(auditLogTable)
      .leftJoin(userTable, eq(auditLogTable.userId, userTable.id))
      .where(where)
      .orderBy(desc(auditLogTable.timestamp))
      .offset((page - 1) * limit)
      .limit(limit);

    const logs = rows.map(r => ({ ...r.log, User: r.User }));

    // Format logs for frontend
    const formattedLogs = logs.map(log => {
      // Determine action type based on action string
      let actionType = 'update';
      let severity = 'low';

      if (log.action.includes('CREATED')) actionType = 'creation';
      else if (log.action.includes('UPDATED')) actionType = 'update';
      else if (log.action.includes('DELETED')) actionType = 'deletion';
      else if (log.action.includes('APPROVED')) actionType = 'approval';
      else if (log.action.includes('REJECTED')) actionType = 'rejection';
      else if (log.action.includes('LOGIN') || log.action.includes('LOGOUT')) actionType = 'security';
      else if (log.action.includes('PERMISSION') || log.action.includes('ROLE')) actionType = 'security';

      // Determine severity
      if (log.action.includes('DELETED') || log.action.includes('FAILED') || log.action.includes('ERROR')) {
        severity = 'high';
      } else if (log.action.includes('UPDATED') || log.action.includes('MODIFIED')) {
        severity = 'medium';
      }

      return {
        id: log.id,
        timestamp: new Date(log.timestamp).toISOString(),
        action: log.action,
        actionType,
        user: log.User?.name || 'System',
        userId: log.userId,
        userRole: log.User?.role || 'System',
        description: log.details || log.action,
        target: log.entity ? `${log.entity} #${log.entityId}` : 'N/A',
        targetType: log.entity?.toLowerCase() || 'unknown',
        entity: log.entity,
        entityId: log.entityId,
        severity,
        ipAddress: log.ipAddress || 'N/A',
        userAgent: log.userAgent || 'N/A',
        metadata: log.metadata
      };
    });

    return NextResponse.json({
      ok: true,
      logs: formattedLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}