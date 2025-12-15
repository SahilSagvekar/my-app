// app/api/admin/audit-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
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
    let where: any = {};

    // Search filter
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Action type filter (map to your action naming convention)
    if (actionType && actionType !== 'all') {
      // You can map frontend action types to your backend action types
      where.action = { contains: actionType.toUpperCase() };
    }

    // User filter
    if (userId && userId !== 'all') {
      where.userId = parseInt(userId);
    }

    // Date range filter
    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Get total count for pagination
    const total = await prisma.auditLog.count({ where });

    // Fetch audit logs with pagination
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

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
        timestamp: log.timestamp.toISOString(),
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
}