// app/api/admin/audit-logs/stats/route.ts
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
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Build date filter
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Get total logs
    const totalLogs = await prisma.auditLog.count({
      where: dateFilter.gte ? { timestamp: dateFilter } : {}
    });

    // Get today's logs
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayLogs = await prisma.auditLog.count({
      where: {
        timestamp: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    });

    // Get high severity events (deletions, failures, errors)
    const highSeverityLogs = await prisma.auditLog.count({
      where: {
        action: {
          in: ['USER_DELETED', 'TASK_DELETED', 'CLIENT_DELETED', 'LOGIN_FAILED', 'PERMISSION_DENIED']
        },
        ...(dateFilter.gte ? { timestamp: dateFilter } : {})
      }
    });

    // Get security events
    const securityLogs = await prisma.auditLog.count({
      where: {
        action: {
          contains: 'LOGIN'
        },
        ...(dateFilter.gte ? { timestamp: dateFilter } : {})
      }
    });

    // Get action type breakdown
    const actionBreakdown = await prisma.auditLog.groupBy({
      by: ['action'],
      _count: {
        action: true
      },
      where: dateFilter.gte ? { timestamp: dateFilter } : {},
      orderBy: {
        _count: {
          action: 'desc'
        }
      },
      take: 10
    });

    // Get user activity breakdown
    const userActivity = await prisma.auditLog.groupBy({
      by: ['userId'],
      _count: {
        userId: true
      },
      where: {
        userId: { not: null },
        ...(dateFilter.gte ? { timestamp: dateFilter } : {})
      },
      orderBy: {
        _count: {
          userId: 'desc'
        }
      },
      take: 10
    });

    // Get user details
    const userIds = userActivity.map(u => u.userId).filter(id => id !== null) as number[];
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        name: true,
        role: true
      }
    });

    const userActivityWithDetails = userActivity.map(activity => {
      const user = users.find(u => u.id === activity.userId);
      return {
        userId: activity.userId,
        userName: user?.name || 'Unknown',
        userRole: user?.role || 'Unknown',
        count: activity._count.userId
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
          count: a._count.action
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
}