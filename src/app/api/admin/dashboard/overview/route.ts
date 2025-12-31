// app/api/admin/dashboard/overview/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TaskStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';

export const maxDuration = 60; // ✅ Set timeout limit
export const dynamic = 'force-dynamic'; // ✅ Disable caching

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
    
    if (!token) {
      return null;
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.user || decoded.currentUser || decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export function requireAdmin(user: JWTUser | null) {
  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  if (user.role !== 'ADMIN' && user.role !== 'admin') {
    return { error: 'Access denied. Admin only.', status: 403 };
  }
  
  return null;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const startMem = process.memoryUsage().heapUsed;
  
  console.log('═══════════════════════════════════════');
  console.log('[ADMIN DASHBOARD] Request started');
  console.log('[ADMIN DASHBOARD] Memory at start:', Math.round(startMem / 1024 / 1024), 'MB');
  
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    
    if (authError) {
      return NextResponse.json(
        { ok: false, message: authError.error },
        { status: authError.status }
      );
    }

    const [
      kpiData,
      pipelineData,
      projectHealthData,
      recentActivity,
      systemStatus
    ] = await Promise.all([
      getKPIData(),
      getPipelineData(),
      getProjectHealthData(), // ✅ FIXED - No longer loads everything into memory
      getRecentActivity(),
      getSystemStatus()
    ]);

    const endTime = Date.now();
    const endMem = process.memoryUsage().heapUsed;
    const duration = endTime - startTime;
    const memDelta = Math.round((endMem - startMem) / 1024 / 1024);
    
    console.log('[ADMIN DASHBOARD] Completed in', duration, 'ms');
    console.log('[ADMIN DASHBOARD] Memory delta:', memDelta, 'MB');
    console.log('[ADMIN DASHBOARD] Total memory now:', Math.round(endMem / 1024 / 1024), 'MB');
    
    if (memDelta > 20) {
      console.error('⚠️⚠️⚠️ HIGH MEMORY USAGE:', memDelta, 'MB - This needs investigation! ⚠️⚠️⚠️');
    }
    
    if (duration > 3000) {
      console.error('⚠️⚠️⚠️ SLOW REQUEST:', duration, 'ms - Dashboard taking too long! ⚠️⚠️⚠️');
    }
    
    console.log('═══════════════════════════════════════');

    return NextResponse.json({
      ok: true,
      kpi: kpiData,
      pipeline: pipelineData,
      projectHealth: projectHealthData,
      recentActivity: recentActivity,
      systemStatus: systemStatus,
      _debug: {
        responseTime: duration,
        memoryDelta: memDelta
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

// ✅ OPTIMIZED - Batch queries instead of separate ones
async function getKPIData() {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // ✅ Single query to get all KPI data at once
  const stats = await prisma.$queryRaw<Array<{
    active_projects: bigint;
    active_team: bigint;
    completed_this_month: bigint;
    avg_completion_days: number | null;
  }>>`
    SELECT 
      COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as active_projects,
      COUNT(DISTINCT CASE 
        WHEN u."employeeStatus" = 'ACTIVE' 
        AND u.role != 'client' 
        THEN u.id 
      END) as active_team,
      COUNT(DISTINCT CASE 
        WHEN t.status = 'COMPLETED' 
        AND t."updatedAt" >= ${thisMonth}
        THEN t.id 
      END) as completed_this_month,
      AVG(CASE 
        WHEN t.status = 'COMPLETED' 
        AND t."updatedAt" >= ${thisMonth}
        THEN EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt")) / 86400
      END) as avg_completion_days
    FROM "Client" c
    CROSS JOIN "User" u
    CROSS JOIN "Task" t
  `;

  const data = stats[0];

  return {
    activeProjects: {
      value: Number(data.active_projects).toString(),
      change: '+0',
      trend: 'up' as const
    },
    teamMembers: {
      value: Number(data.active_team).toString(),
      change: '+0',
      trend: 'up' as const
    },
    avgCompletion: {
      value: `${(data.avg_completion_days || 0).toFixed(1)} days`,
      change: '0 days',
      trend: 'up' as const
    }
  };
}

// ✅ OPTIMIZED - Use groupBy instead of multiple counts
async function getPipelineData() {
  // Single query to get counts by status
  const statusCounts = await prisma.task.groupBy({
    by: ['status'],
    _count: {
      id: true
    }
  });

  // Create a map for easy lookup
  const countMap = new Map(
    statusCounts.map(item => [item.status, item._count.id])
  );

  // Format the response
  const stages = ['PENDING', 'IN_PROGRESS', 'READY_FOR_QC', 'QC_IN_PROGRESS', 'COMPLETED'] as const;
  
  return stages.map(stage => ({
    name: stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    projects: countMap.get(stage) || 0,
    revenue: 0
  }));
}

// ✅ FIXED - This was the MAIN memory leak!
// OLD: Loaded ALL clients with ALL their tasks into memory
// NEW: Let database do the calculation
async function getProjectHealthData() {
  const now = new Date();
  
  // ✅ Use SQL aggregation instead of loading everything into memory
  const stats = await prisma.$queryRaw<Array<{
    client_id: string;
    total_tasks: bigint;
    overdue_tasks: bigint;
    due_soon_tasks: bigint;
  }>>`
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
  `;
  
  let onTrack = 0;
  let atRisk = 0;
  let critical = 0;
  
  // Calculate health status (lightweight - just counting)
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
    {
      name: 'On Track',
      value: Math.round((onTrack / total) * 100),
      count: onTrack,
      color: '#22c55e'
    },
    {
      name: 'At Risk',
      value: Math.round((atRisk / total) * 100),
      count: atRisk,
      color: '#f59e0b'
    },
    {
      name: 'Critical',
      value: Math.round((critical / total) * 100),
      count: critical,
      color: '#ef4444'
    }
  ];
}

// ✅ Already optimized (just takes 10 logs)
async function getRecentActivity() {
  const recentLogs = await prisma.auditLog.findMany({
    take: 10,
    orderBy: {
      timestamp: 'desc'
    },
    select: {
      id: true,
      action: true,
      details: true,
      User: {
        select: {
          name: true
        }
      }
    }
  });

  const activities = recentLogs.map(log => {
    let type = 'info';
    let status = 'info';

    if (log.action.includes('COMPLETED') || log.action.includes('APPROVED')) {
      type = 'success';
      status = 'success';
    } else if (log.action.includes('REJECTED') || log.action.includes('FAILED')) {
      type = 'error';
      status = 'error';
    } else if (log.action.includes('DEADLINE') || log.action.includes('OVERDUE')) {
      type = 'warning';
      status = 'warning';
    } else if (log.action.includes('CREATED') || log.action.includes('ASSIGNED')) {
      type = 'new';
      status = 'info';
    }

    return {
      id: log.id,
      type: type,
      message: `${log.action}${log.details ? ' - ' + log.details : ''}`,
      time: '',
      status: status,
      user: log.User?.name || 'System'
    };
  });

  return activities;
}

async function getSystemStatus() {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  
  // ✅ This is fine - already aggregated
  const activeUserIds = await prisma.auditLog.groupBy({
    by: ['userId'],
    where: {
      timestamp: {
        gte: fifteenMinutesAgo
      },
      userId: {
        not: null
      }
    },
    _count: {
      userId: true
    }
  });

  const activeUsers = activeUserIds.length;

  // Database health check with timing
  let dbHealthy = true;
  let dbResponseTime = 0;
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbResponseTime = Date.now() - startTime;
  } catch {
    dbHealthy = false;
  }

  // ✅ Reduce this from 100 to 20 logs
  const recentLogs = await prisma.auditLog.findMany({
    take: 20, // ✅ Reduced from 100
    orderBy: {
      timestamp: 'desc'
    },
    where: {
      metadata: {
        path: ['responseTime'],
        not: null
      }
    },
    select: {
      metadata: true
    }
  });

  let avgResponseTime = 125;
  if (recentLogs.length > 0) {
    const responseTimes = recentLogs
      .map(log => {
        const metadata = log.metadata as any;
        return metadata?.responseTime || 0;
      })
      .filter(time => time > 0);
    
    if (responseTimes.length > 0) {
      avgResponseTime = Math.round(
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      );
    }
  }

  // Get total database size
  let dbSize = 'N/A';
  try {
    const result = await prisma.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;
    if (result && result[0]) {
      dbSize = result[0].size;
    }
  } catch (error) {
    console.error('Failed to get database size:', error);
  }

  // ✅ Batch counts in parallel (this is fine)
  const [taskCount, userCount, clientCount, auditLogCount] = await Promise.all([
    prisma.task.count(),
    prisma.user.count(),
    prisma.client.count(),
    prisma.auditLog.count()
  ]);

  // Memory usage
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024)
  };

  // Server uptime
  const uptimeSeconds = process.uptime();
  const uptimeFormatted = formatUptime(uptimeSeconds);

  return {
    serverStatus: 'Online',
    databaseStatus: dbHealthy ? 'Healthy' : 'Issues Detected',
    databaseResponseTime: `${dbResponseTime}ms`,
    databaseSize: dbSize,
    activeUsers: activeUsers,
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
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}