// app/api/admin/dashboard/overview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TaskStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
// import { getUserFromToken, requireAdmin } from 'D:\E8 Productions\my-app\src\lib\auth-helpers';

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
      getProjectHealthData(),
      getRecentActivity(),
      getSystemStatus()
    ]);

    return NextResponse.json({
      ok: true,
      kpi: kpiData,
      pipeline: pipelineData,
      projectHealth: projectHealthData,
      recentActivity: recentActivity,
      systemStatus: systemStatus
    });

  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getKPIData() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Total Revenue (from completed tasks/projects this month)
//   const currentMonthRevenue = await prisma.task.aggregate({
//     where: {
//       status: 'COMPLETED',
//       completedAt: {
//         gte: thisMonth
//       }
//     },
//     _sum: {
//       budget: true
//     }
//   });

//   const lastMonthRevenue = await prisma.task.aggregate({
//     where: {
//       status: 'COMPLETED',
//       completedAt: {
//         gte: lastMonth,
//         lt: thisMonth
//       }
//     },
//     _sum: {
//       budget: true
//     }
//   });

//   const currentRevenue = currentMonthRevenue._sum.budget || 0;
//   const previousRevenue = lastMonthRevenue._sum.budget || 0;
//   const revenueChange = previousRevenue > 0 
//     ? ((currentRevenue - previousRevenue) / previousRevenue * 100).toFixed(1)
//     : '0.0';

  // Active Projects (projects with status IN_PROGRESS)
  const activeProjects = await prisma.client.count({
    where: {
      status: 'active'
    }
  });

  const lastMonthActiveProjects = await prisma.client.count({
    where: {
      status: 'active',
      createdAt: {
        lt: thisMonth
      }
    }
  });

  const projectChange = activeProjects - lastMonthActiveProjects;

  // Team Members (active users)
  const teamMembers = await prisma.user.count({
    where: {
      employeeStatus: 'ACTIVE',
      role: {
        not: 'client'
      }
    }
  });

  const lastMonthTeamMembers = await prisma.user.count({
    where: {
      employeeStatus: 'ACTIVE',
      role: {
        not: 'client'
      },
      createdAt: {
        lt: thisMonth
      }
    }
  });

  const teamChange = teamMembers - lastMonthTeamMembers;

  // Average Completion Time (in days)
  const completedTasks = await prisma.task.findMany({
    where: {
      status: 'COMPLETED',
      updatedAt: {
        gte: thisMonth
      }
    },
    select: {
      createdAt: true,
      updatedAt: true
    }
  });

  let avgCompletionDays = 0;
  if (completedTasks.length > 0) {
    const totalDays = completedTasks.reduce((sum, task) => {
      if (task.updatedAt) {
        const days = Math.abs(
          (task.updatedAt.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }
      return sum;
    }, 0);
    avgCompletionDays = totalDays / completedTasks.length;
  }

  // Previous month average
  const lastMonthCompletedTasks = await prisma.task.findMany({
    where: {
      status: 'COMPLETED',
      updatedAt: {
        gte: lastMonth,
        lt: thisMonth
      }
    },
    select: {
      createdAt: true,
      updatedAt: true
    }
  });

  let lastMonthAvgDays = 0;
  if (lastMonthCompletedTasks.length > 0) {
    const totalDays = lastMonthCompletedTasks.reduce((sum, task) => {
      if (task.updatedAt) {
        const days = Math.abs(
          (task.updatedAt.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }
      return sum;
    }, 0);
    lastMonthAvgDays = totalDays / lastMonthCompletedTasks.length;
  }

  const completionChange = (lastMonthAvgDays - avgCompletionDays).toFixed(1);

  return {
    // totalRevenue: {
    //   value: `₹${currentRevenue.toLocaleString('en-IN')}`,
    //   change: `${parseFloat(revenueChange) > 0 ? '+' : ''}${revenueChange}%`,
    //   trend: parseFloat(revenueChange) >= 0 ? 'up' : 'down'
    // },
    activeProjects: {
      value: activeProjects.toString(),
      change: `${projectChange > 0 ? '+' : ''}${projectChange}`,
      trend: projectChange >= 0 ? 'up' : 'down'
    },
    teamMembers: {
      value: teamMembers.toString(),
      change: `${teamChange > 0 ? '+' : ''}${teamChange}`,
      trend: teamChange >= 0 ? 'up' : 'down'
    },
    avgCompletion: {
      value: `${avgCompletionDays.toFixed(1)} days`,
      change: `${parseFloat(completionChange) > 0 ? '-' : '+'}${Math.abs(parseFloat(completionChange))} days`,
      trend: parseFloat(completionChange) >= 0 ? 'up' : 'down'
    }
  };
}

// Pipeline Data: Projects by stage
async function getPipelineData() {
  const stages = ['PENDING', 'IN_PROGRESS', 'READY_FOR_QC', 'QC_IN_PROGRESS', 'COMPLETED'] as const;
  
  const pipelineData = await Promise.all(
    stages.map(async (stage) => {
      const count = await prisma.task.count({
        where: { status: stage as any } // Type cast to bypass strict typing
      });

      return {
        name: stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
        projects: count,
        revenue: 0
      };
    })
  );

  return pipelineData;
}

// Project Health: On Track, At Risk, Critical
async function getProjectHealthData() {
  const now = new Date();
  
  // Get all active clients with their tasks
  const allActiveClients = await prisma.client.findMany({
    where: {
      status: 'active'
    },
    include: {
      tasks: {
        where: {
          status: {
            not: TaskStatus.COMPLETED
          }
        }
      }
    }
  });

  let onTrack = 0;
  let atRisk = 0;
  let critical = 0;

  allActiveClients.forEach(client => {
    // If client has no active tasks, consider them on track
    if (!client.tasks || client.tasks.length === 0) {
      onTrack++;
      return;
    }

    // Count overdue tasks
    const overdueTasks = client.tasks.filter(task => {
      if (!task.dueDate) return false;
      return new Date(task.dueDate) < now;
    }).length;

    // Count tasks due soon (within 3 days)
    const tasksDueSoon = client.tasks.filter(task => {
      if (!task.dueDate) return false;
      const daysUntilDue = Math.ceil(
        (new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilDue > 0 && daysUntilDue <= 3;
    }).length;

    const totalActiveTasks = client.tasks.length;
    const overduePercentage = (overdueTasks / totalActiveTasks) * 100;
    const dueSoonPercentage = (tasksDueSoon / totalActiveTasks) * 100;

    // Determine client health status
    if (overdueTasks > 0 && overduePercentage >= 50) {
      // More than 50% tasks are overdue - CRITICAL
      critical++;
    } else if (overdueTasks > 0 || dueSoonPercentage >= 30) {
      // Has overdue tasks or 30%+ tasks due soon - AT RISK
      atRisk++;
    } else {
      // All good - ON TRACK
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

// Recent Activity Feed
async function getRecentActivity() {
  // Get recent audit logs
  const recentLogs = await prisma.auditLog.findMany({
    take: 10,
    orderBy: {
      timestamp: 'desc'
    },
    include: {
      user: {
        select: {
          name: true
        }
      }
    }
  });

  const activities = recentLogs.map(log => {
    let type = 'info';
    let status = 'info';

    // Determine activity type and status based on action
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
      user: log.user?.name || 'System'
    };
  });

  return activities;
}

// app/api/admin/dashboard/overview/route.ts

async function getSystemStatus() {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  
  // Active users based on recent audit log activity
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

  // Calculate average API response time from recent audit logs
  const recentLogs = await prisma.auditLog.findMany({
    take: 100,
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

  let avgResponseTime = 125; // Default fallback
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

  // Get total database size (PostgreSQL specific)
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

  // Get table row counts for monitoring
  const [taskCount, userCount, clientCount, auditLogCount] = await Promise.all([
    prisma.task.count(),
    prisma.user.count(),
    prisma.client.count(),
    prisma.auditLog.count()
  ]);

  // Memory usage (if available)
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

// Helper function to format uptime
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