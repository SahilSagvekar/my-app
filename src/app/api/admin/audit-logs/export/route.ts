export const dynamic = 'force-dynamic';
// app/api/admin/audit-logs/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { auditLog as auditLogTable, user as userTable } from '@/lib/db/schema';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { startDate, endDate, format = 'csv' } = body;

    // Build where clause
    const conditions = [];
    if (startDate && endDate) {
      conditions.push(gte(auditLogTable.timestamp, new Date(startDate).toISOString()));
      conditions.push(lte(auditLogTable.timestamp, new Date(endDate).toISOString()));
    }
    const where = conditions.length ? and(...conditions) : undefined;

    // Fetch all logs for export
    const rows = await db.select({
      log: auditLogTable,
      User: { name: userTable.name, email: userTable.email, role: userTable.role },
    })
      .from(auditLogTable)
      .leftJoin(userTable, eq(auditLogTable.userId, userTable.id))
      .where(where)
      .orderBy(desc(auditLogTable.timestamp));

    const logs = rows.map(r => ({ ...r.log, User: r.User }));

    if (format === 'csv') {
      // Generate CSV
      let csv = 'Timestamp,Action,User,User Role,Description,Entity,Entity ID,IP Address,User Agent\n';

      logs.forEach(log => {
        const timestamp = new Date(log.timestamp).toISOString();
        const action = log.action;
        const user = log.User?.name || 'System';
        const userRole = log.User?.role || 'System';
        const description = (log.details || '').replace(/,/g, ';').replace(/\n/g, ' ');
        const entity = log.entity || 'N/A';
        const entityId = log.entityId || 'N/A';
        const ipAddress = log.ipAddress || 'N/A';
        const userAgent = (log.userAgent || 'N/A').replace(/,/g, ';');
        
        csv += `${timestamp},${action},${user},${userRole},"${description}",${entity},${entityId},${ipAddress},"${userAgent}"\n`;
      });

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json({
      ok: false,
      message: 'Format not supported'
    }, { status: 400 });

  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}