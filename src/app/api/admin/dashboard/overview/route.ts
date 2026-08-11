// app/api/admin/dashboard/overview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  user as userTable,
  task as taskTable,
  auditLog as auditLogTable,
  client as clientTable,
  taskStatus as taskStatusEnum,
} from '@/lib/db/schema';
import { and, or, eq, ne, gte, lte, lt, inArray, isNotNull, ilike, desc, count, sql as drizzleSql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

type TaskStatus = typeof taskStatusEnum.enumValues[number];

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export interface JWTUser {
  userId: number;
  id: number;
  email: string;
  role: string;
  name?: string;
}

export function getUserFromToken(req: NextRequest): JWTUser | null {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return null;
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.user || decoded.currentUser || decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export function requireAdmin(user: JWTUser | null) {
  if (!user) return { error: 'Unauthorized', status: 401 };
  if (user.role !== 'ADMIN' && user.role !== 'admin') {
    return { error: 'Access denied. Admin only.', status: 403 };
  }
  return null;
}

import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: any) {
  const startTime = Date.now();

  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Access denied. Admin only.' }, { status: 403 });
    }

    const [
      kpiData,
      pipelineData,
      projectHealthData,
      recentActivity,
      systemStatus,
      clientDeliverablesProgress
    ] = await Promise.all([
      getKPIData(),
      getPipelineData(),
      getProjectHealthData(),
      getRecentActivity(),
      getSystemStatus(),
      getClientDeliverablesProgress()
    ]);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      kpi: kpiData,
      pipeline: pipelineData,
      projectHealth: projectHealthData,
      recentActivity: recentActivity,
      systemStatus: systemStatus,
      clientDeliverablesProgress,
      _debug: {
        responseTime: duration
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[ADMIN DASHBOARD] Error after', duration, 'ms:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getKPIData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const activeStatuses: TaskStatus[] = [
    'PENDING',
    'IN_PROGRESS',
    'READY_FOR_QC',
    'QC_IN_PROGRESS',
    'CLIENT_REVIEW',
    'VIDEOGRAPHER_ASSIGNED'
  ];

  // Wrap independent queries in Promise.all for speed
  const [
    [{ value: currentTeamCount }],
    [{ value: prevTeamCount }],
    [{ value: currentActiveTasks }],
    [{ value: prevActiveTasks }],
    avgResultRaw,
    prevAvgResultRaw
  ] = await Promise.all([
    db.select({ value: count() }).from(userTable).where(and(
      eq(userTable.employeeStatus, 'ACTIVE'),
      ne(userTable.role, 'client' as any)
    )),
    db.select({ value: count() }).from(userTable).where(and(
      eq(userTable.employeeStatus, 'ACTIVE'),
      ne(userTable.role, 'client' as any),
      lt(userTable.createdAt, thirtyDaysAgo.toISOString())
    )),
    db.select({ value: count() }).from(taskTable).where(inArray(taskTable.status, activeStatuses as any)),
    db.select({ value: count() }).from(taskTable).where(and(
      inArray(taskTable.status, activeStatuses as any),
      lt(taskTable.createdAt, thirtyDaysAgo.toISOString())
    )),
    db.execute(drizzleSql`
      SELECT AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt")) / 86400) as avg
      FROM "Task" t
      WHERE t.status = 'COMPLETED'
      AND t."updatedAt" >= ${thirtyDaysAgo}
    `),
    db.execute(drizzleSql`
      SELECT AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt")) / 86400) as avg
      FROM "Task" t
      WHERE t.status = 'COMPLETED'
      AND t."updatedAt" BETWEEN ${sixtyDaysAgo} AND ${thirtyDaysAgo}
    `)
  ]);

  const avgResult = avgResultRaw.rows as Array<{ avg: number | null }>;
  const prevAvgResult = prevAvgResultRaw.rows as Array<{ avg: number | null }>;
  const currentAvg = Number(avgResult[0]?.avg || 0);
  const prevAvg = Number(prevAvgResult[0]?.avg || 0);

  // Calculate changes
  const teamChange = currentTeamCount - prevTeamCount;
  const tasksChange = currentActiveTasks - prevActiveTasks;
  const avgChange = currentAvg - prevAvg;

  return {
    totalRevenue: {
      value: '$0',
      change: '+0%',
      trend: 'up' as const
    },
    activeProjects: {
      value: currentActiveTasks.toString(),
      change: `${tasksChange >= 0 ? '+' : ''}${tasksChange}`,
      trend: tasksChange >= 0 ? 'up' as const : 'down' as const
    },
    teamMembers: {
      value: currentTeamCount.toString(),
      change: `${teamChange >= 0 ? '+' : ''}${teamChange}`,
      trend: teamChange >= 0 ? 'up' as const : 'down' as const
    },
    avgCompletion: {
      value: `${currentAvg.toFixed(1)} days`,
      change: `${avgChange.toFixed(1)} days`,
      trend: avgChange <= 0 ? 'up' as const : 'down' as const // Lower completion time is "up" trend
    }
  };
}

async function getPipelineData() {
  const statusCounts = await db.select({ status: taskTable.status, cnt: count() })
    .from(taskTable)
    .groupBy(taskTable.status);

  const countMap = new Map(
    statusCounts.map(item => [item.status, item.cnt])
  );

  const stages = ['PENDING', 'IN_PROGRESS', 'READY_FOR_QC', 'QC_IN_PROGRESS', 'COMPLETED'] as const;

  return stages.map(stage => ({
    name: stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    projects: countMap.get(stage) || 0,
    revenue: 0
  }));
}

async function getProjectHealthData() {
  const statsResult = await db.execute<{
    client_id: string;
    total_tasks: bigint;
    overdue_tasks: bigint;
    due_soon_tasks: bigint;
  }>(drizzleSql`
    SELECT
      c.id as client_id,
      COUNT(t.id) as total_tasks,
      COUNT(CASE WHEN t."dueDate" < NOW() THEN 1 END) as overdue_tasks,
      COUNT(CASE
        WHEN t."dueDate" BETWEEN NOW() AND NOW() + INTERVAL '3 days'
        THEN 1
      END) as due_soon_tasks
    FROM "Client" c
    LEFT JOIN "Task" t ON t."clientId" = c.id
    WHERE c.status = 'active'
      AND (t.status IS NULL OR t.status != 'COMPLETED')
    GROUP BY c.id
  `);
  const stats = statsResult.rows;

  let onTrack = 0;
  let atRisk = 0;
  let critical = 0;

  stats.forEach(stat => {
    const totalTasks = Number(stat.total_tasks);
    const overdueTasks = Number(stat.overdue_tasks);
    const dueSoonTasks = Number(stat.due_soon_tasks);

    if (totalTasks === 0) {
      onTrack++;
      return;
    }

    const overduePercentage = (overdueTasks / totalTasks) * 100;
    const dueSoonPercentage = (dueSoonTasks / totalTasks) * 100;

    if (overdueTasks > 0 && overduePercentage >= 50) {
      critical++;
    } else if (overdueTasks > 0 || dueSoonPercentage >= 30) {
      atRisk++;
    } else {
      onTrack++;
    }
  });

  const total = onTrack + atRisk + critical || 1;

  return [
    { name: 'On Track', value: Math.round((onTrack / total) * 100), count: onTrack, color: '#22c55e' },
    { name: 'At Risk', value: Math.round((atRisk / total) * 100), count: atRisk, color: '#f59e0b' },
    { name: 'Critical', value: Math.round((critical / total) * 100), count: critical, color: '#ef4444' }
  ];
}

async function getRecentActivity() {
  const rows = await db.select({
    id: auditLogTable.id,
    action: auditLogTable.action,
    details: auditLogTable.details,
    User: { name: userTable.name },
  })
    .from(auditLogTable)
    .leftJoin(userTable, eq(auditLogTable.userId, userTable.id))
    .orderBy(desc(auditLogTable.timestamp))
    .limit(10);

  const recentLogs = rows;

  return recentLogs.map(log => {
    let type = 'info';
    let status = 'info';

    if (log.action.includes('COMPLETED') || log.action.includes('APPROVED')) {
      type = 'success'; status = 'success';
    } else if (log.action.includes('REJECTED') || log.action.includes('FAILED')) {
      type = 'error'; status = 'error';
    } else if (log.action.includes('DEADLINE') || log.action.includes('OVERDUE')) {
      type = 'warning'; status = 'warning';
    } else if (log.action.includes('CREATED') || log.action.includes('ASSIGNED')) {
      type = 'new'; status = 'info';
    }

    return {
      id: log.id,
      type,
      message: `${log.action}${log.details ? ' - ' + log.details : ''}`,
      time: '',
      status,
      user: log.User?.name || 'System'
    };
  });
}

async function getSystemStatus() {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const activeUserIds = await db.selectDistinct({ userId: auditLogTable.userId })
    .from(auditLogTable)
    .where(and(
      gte(auditLogTable.timestamp, fifteenMinutesAgo.toISOString()),
      isNotNull(auditLogTable.userId)
    ));

  const activeUsers = activeUserIds.length;

  let dbHealthy = true;
  let dbResponseTime = 0;
  try {
    const startTime = Date.now();
    await db.execute(drizzleSql`SELECT 1`);
    dbResponseTime = Date.now() - startTime;
  } catch {
    dbHealthy = false;
  }

  const recentLogsResult = await db.select({ metadata: auditLogTable.metadata })
    .from(auditLogTable)
    .where(drizzleSql`${auditLogTable.metadata} -> 'responseTime' IS NOT NULL`)
    .orderBy(desc(auditLogTable.timestamp))
    .limit(20);
  const recentLogs = recentLogsResult;

  let avgResponseTime = 125;
  if (recentLogs.length > 0) {
    const responseTimes = recentLogs
      .map(log => (log.metadata as any)?.responseTime || 0)
      .filter(time => time > 0);

    if (responseTimes.length > 0) {
      avgResponseTime = Math.round(
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      );
    }
  }

  let dbSize = 'N/A';
  try {
    const result = await db.execute<{ size: string }>(drizzleSql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    if (result.rows?.[0]) dbSize = result.rows[0].size;
  } catch (error) {
    console.error('Failed to get database size:', error);
  }

  const [[{ value: taskCount }], [{ value: userCount }], [{ value: clientCount }], [{ value: auditLogCount }]] = await Promise.all([
    db.select({ value: count() }).from(taskTable),
    db.select({ value: count() }).from(userTable),
    db.select({ value: count() }).from(clientTable),
    db.select({ value: count() }).from(auditLogTable)
  ]);

  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024)
  };

  const uptimeSeconds = process.uptime();
  const uptimeFormatted = formatUptime(uptimeSeconds);

  return {
    serverStatus: 'Online',
    databaseStatus: dbHealthy ? 'Healthy' : 'Issues Detected',
    databaseResponseTime: `${dbResponseTime}ms`,
    databaseSize: dbSize,
    activeUsers,
    apiResponseTime: `${avgResponseTime}ms`,
    serverUptime: uptimeFormatted,
    memoryUsage: memoryUsageMB,
    statistics: {
      totalTasks: taskCount,
      totalUsers: userCount,
      totalClients: clientCount,
      totalAuditLogs: auditLogCount
    }
  };
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function getClientDeliverablesProgress() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

  // Get active clients with their monthly deliverables
  const clients = await db.query.client.findMany({
    where: eq(clientTable.status, 'active'),
    columns: { id: true, companyName: true },
    with: {
      monthlyDeliverables: {
        columns: { id: true, type: true, quantity: true, platforms: true },
      },
      tasks: {
        where: and(gte(taskTable.dueDate, monthStart.toISOString()), lte(taskTable.dueDate, monthEnd.toISOString())),
        columns: { id: true, status: true, monthlyDeliverableId: true },
      },
    },
    orderBy: (c, { asc }) => asc(c.companyName),
  });

  return clients
    .filter(c => c.monthlyDeliverables.length > 0)
    .map(client => {
      const deliverables = client.monthlyDeliverables.map(d => {
        const tasks = client.tasks.filter(t => t.monthlyDeliverableId === d.id);
        const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'POSTED').length;
        const totalTasks = tasks.length;
        const expectedQuantity = d.quantity || 0;

        return {
          id: d.id,
          type: d.type,
          quantity: expectedQuantity,
          platforms: d.platforms,
          completedTasks,
          totalTasks,
          progress: expectedQuantity > 0
            ? Math.round((completedTasks / expectedQuantity) * 100)
            : totalTasks > 0
              ? Math.round((completedTasks / totalTasks) * 100)
              : 0,
        };
      });

      const totalExpected = deliverables.reduce((sum, d) => sum + (d.quantity || d.totalTasks), 0);
      const totalCompleted = deliverables.reduce((sum, d) => sum + d.completedTasks, 0);

      return {
        clientId: client.id,
        clientName: client.companyName,
        deliverables,
        totalExpected,
        totalCompleted,
        overallProgress: totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0,
      };
    });
}