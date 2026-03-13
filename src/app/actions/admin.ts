'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { TaskStatus } from '@prisma/client';
import { createClientFolders } from '@/lib/s3';
import { createRecurringTasksForClient } from '@/app/api/clients/recurring';
import { redis } from '@/lib/redis';
import { revalidatePath } from 'next/cache';
import { createAuditLog, AuditAction } from '@/lib/audit-logger';

// --- Dashboard Interfaces ---
export interface KPIData {
  totalRevenue: { value: string; change: string; trend: 'up' | 'down' };
  activeProjects: { value: string; change: string; trend: 'up' | 'down' };
  teamMembers: { value: string; change: string; trend: 'up' | 'down' };
  avgCompletion: { value: string; change: string; trend: 'up' | 'down' };
}

export interface PipelineData {
  name: string;
  projects: number;
  revenue: number;
}

export interface ProjectHealthData {
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface ActivityData {
  id: number;
  type: string;
  message: string;
  time: string;
  status: 'success' | 'error' | 'warning' | 'info';
  user?: string;
}

export interface SystemStatusData {
  serverStatus: string;
  databaseStatus: string;
  databaseResponseTime: string;
  databaseSize: string;
  activeUsers: number;
  activeUserList?: Array<{ name: string; role: string; lastActive?: Date }>;
  apiResponseTime: string;
  serverUptime: string;
  memoryUsage: { rss: number; heapTotal: number; heapUsed: number; external: number };
  statistics: { totalTasks: number; totalUsers: number; totalClients: number; totalAuditLogs: number };
}

// --- Auth Helper ---
async function validateAdmin() {
  const user = await getCurrentUser2();
  if (!user || user.role?.toLowerCase() !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  return user;
}

// --- Actions ---

/**
 * Fetches all dashboard overview data in one server-side call.
 */
export async function getDashboardOverviewAction() {
  await validateAdmin();

  const [
    kpi,
    pipeline,
    projectHealth,
    recentActivity,
    systemStatus
  ] = await Promise.all([
    getKPIData(),
    getPipelineData(),
    getProjectHealthData(),
    getRecentActivity(),
    getSystemStatus()
  ]);

  return { kpi, pipeline, projectHealth, recentActivity, systemStatus };
}

/**
 * Creates a new client and all associated resources.
 */
export async function createClientAction(body: any) {
  const currentUser = await validateAdmin();

  const {
    name,
    email,
    emails,
    phone,
    phones,
    companyName,
    accountManagerId,
    monthlyDeliverables,
    oneOffDeliverables,
    brandGuidelines,
    projectSettings,
    billing,
    postingSchedule,
    clientReviewRequired,
    videographerRequired,
    hasPostingServices,
  } = body;

  if (!name || !email) {
    throw new Error('Name and email are required');
  }

  const clientReview = clientReviewRequired === "yes";
  const videographer = videographerRequired === "yes";
  const additionalEmails = (emails || []).filter((e: string) => e.trim() !== "");
  const additionalPhones = (phones || []).filter((p: string) => p.trim() !== "");

  const folders = await createClientFolders(companyName);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create User
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: null,
        role: "client",
      }
    });

    // 2. Create Client
    const client = await tx.client.create({
      data: {
        name,
        email,
        emails: additionalEmails,
        companyName: companyName || null,
        phone,
        phones: additionalPhones,
        createdBy: currentUser.id.toString(),
        user: { connect: { id: user.id } },
        accountManagerId,
        status: "active",
        startDate: new Date(),
        renewalDate: null,
        lastActivity: new Date(),
        driveFolderId: folders.mainFolderId,
        rawFootageFolderId: folders.rawFolderId,
        essentialsFolderId: folders.elementsFolderId,
        outputsFolderId: folders.outputsFolderId,
        brandGuidelines,
        projectSettings,
        billing,
        postingSchedule,
        requiresClientReview: clientReview,
        requiresVideographer: videographer,
        hasPostingServices: hasPostingServices ?? true,
        currentProgress: { completed: 0, total: 0 },
      },
    });

    // 3. Create Monthly Deliverables
    await Promise.all(
      (monthlyDeliverables || []).map((d: any) =>
        tx.monthlyDeliverable.create({
          data: {
            clientId: client.id,
            type: d.type,
            quantity: d.quantity,
            videosPerDay: d.videosPerDay,
            postingSchedule: d.postingSchedule,
            postingDays: d.postingDays,
            postingTimes: d.postingTimes,
            platforms: d.platforms,
            description: d.description,
          },
        })
      )
    );

    // 4. Create One-Offs
    await Promise.all(
      (oneOffDeliverables || []).map((d: any) =>
        tx.oneOffDeliverable.create({
          data: {
            clientId: client.id,
            type: d.type,
            quantity: d.quantity,
            videosPerDay: d.videosPerDay,
            postingSchedule: "one-off",
            postingDays: d.postingDays,
            postingTimes: d.postingTimes,
            platforms: d.platforms,
            description: d.description,
            status: "PENDING",
          },
        })
      )
    );

    // 5. Create Recurring Tasks
    await createRecurringTasksForClient(client.id, tx);

    return client;
  });

  // 6. Cache Invalidation
  await redis.del("clients:all");
  revalidatePath('/dashboard');

  return result;
}

// --- Internal Helper Functions (ported from API) ---

async function getKPIData(): Promise<KPIData> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const activeStatuses: TaskStatus[] = [
    'PENDING', 'IN_PROGRESS', 'READY_FOR_QC', 'QC_IN_PROGRESS', 'CLIENT_REVIEW', 'VIDEOGRAPHER_ASSIGNED'
  ];

  const [
    currentTeamCount,
    prevTeamCount,
    currentActiveTasks,
    prevActiveTasks,
    avgResult,
    prevAvgResult
  ] = await Promise.all([
    prisma.user.count({ where: { employeeStatus: 'ACTIVE', role: { not: 'client' } } }),
    prisma.user.count({ where: { employeeStatus: 'ACTIVE', role: { not: 'client' }, createdAt: { lt: thirtyDaysAgo } } }),
    prisma.task.count({ where: { status: { in: activeStatuses } } }),
    prisma.task.count({ where: { status: { in: activeStatuses }, createdAt: { lt: thirtyDaysAgo } } }),
    prisma.$queryRaw<Array<{ avg: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt")) / 86400) as avg
      FROM "Task" t
      WHERE t.status = 'COMPLETED' AND t."updatedAt" >= ${thirtyDaysAgo}
    `,
    prisma.$queryRaw<Array<{ avg: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt")) / 86400) as avg
      FROM "Task" t
      WHERE t.status = 'COMPLETED' AND t."updatedAt" BETWEEN ${sixtyDaysAgo} AND ${thirtyDaysAgo}
    `
  ]);

  const currentAvg = Number(avgResult[0]?.avg || 0);
  const prevAvg = Number(prevAvgResult[0]?.avg || 0);
  const teamChange = currentTeamCount - prevTeamCount;
  const tasksChange = currentActiveTasks - prevActiveTasks;
  const avgChange = currentAvg - prevAvg;

  return {
    totalRevenue: { value: '$0', change: '+0%', trend: 'up' },
    activeProjects: { 
        value: currentActiveTasks.toString(), 
        change: `${tasksChange >= 0 ? '+' : ''}${tasksChange}`,
        trend: tasksChange >= 0 ? 'up' : 'down' 
    },
    teamMembers: { 
        value: currentTeamCount.toString(), 
        change: `${teamChange >= 0 ? '+' : ''}${teamChange}`,
        trend: teamChange >= 0 ? 'up' : 'down' 
    },
    avgCompletion: { 
        value: `${currentAvg.toFixed(1)} days`, 
        change: `${avgChange.toFixed(1)} days`,
        trend: avgChange <= 0 ? 'up' : 'down'
    }
  };
}

async function getPipelineData(): Promise<PipelineData[]> {
  const statusCounts = await prisma.task.groupBy({
    by: ['status'],
    _count: { id: true }
  });

  const countMap = new Map(statusCounts.map(item => [item.status, item._count.id]));
  const stages = ['PENDING', 'IN_PROGRESS', 'READY_FOR_QC', 'QC_IN_PROGRESS', 'COMPLETED'] as const;

  return stages.map(stage => ({
    name: stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    projects: countMap.get(stage) || 0,
    revenue: 0
  }));
}

async function getProjectHealthData(): Promise<ProjectHealthData[]> {
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
      COUNT(CASE WHEN t."dueDate" BETWEEN NOW() AND NOW() + INTERVAL '3 days' THEN 1 END) as due_soon_tasks
    FROM "Client" c
    LEFT JOIN "Task" t ON t."clientId" = c.id
    WHERE c.status = 'active' AND (t.status IS NULL OR t.status != 'COMPLETED')
    GROUP BY c.id
  `;

  let onTrack = 0, atRisk = 0, critical = 0;

  stats.forEach(stat => {
    const total = Number(stat.total_tasks);
    const overdue = Number(stat.overdue_tasks);
    const dueSoon = Number(stat.due_soon_tasks);

    if (total === 0) { onTrack++; return; }
    const overduePct = (overdue / total) * 100;
    const dueSoonPct = (dueSoon / total) * 100;

    if (overdue > 0 && overduePct >= 50) critical++;
    else if (overdue > 0 || dueSoonPct >= 30) atRisk++;
    else onTrack++;
  });

  const total = onTrack + atRisk + critical || 1;

  return [
    { name: 'On Track', value: Math.round((onTrack / total) * 100), count: onTrack, color: '#22c55e' },
    { name: 'At Risk', value: Math.round((atRisk / total) * 100), count: atRisk, color: '#f59e0b' },
    { name: 'Critical', value: Math.round((critical / total) * 100), count: critical, color: '#ef4444' }
  ];
}

async function getRecentActivity(): Promise<ActivityData[]> {
  const logs = await prisma.auditLog.findMany({
    take: 10,
    orderBy: { timestamp: 'desc' },
    include: { User: { select: { name: true } } }
  });

  return logs.map(log => {
    let status: ActivityData['status'] = 'info';
    if (log.action.includes('COMPLETED') || log.action.includes('APPROVED')) status = 'success';
    else if (log.action.includes('REJECTED') || log.action.includes('FAILED')) status = 'error';
    else if (log.action.includes('DEADLINE') || log.action.includes('OVERDUE')) status = 'warning';

    return {
      id: log.id,
      type: status,
      message: `${log.action}${log.details ? ' - ' + log.details : ''}`,
      time: '',
      status,
      user: log.User?.name || 'System'
    };
  });
}

async function getSystemStatus(): Promise<SystemStatusData> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  // Fetch active users from audit logs
  const activeLogs = await prisma.auditLog.findMany({
    where: {
      timestamp: { gte: fifteenMinutesAgo },
      userId: { not: null }
    },
    include: {
      User: {
        select: { name: true, role: true }
      }
    },
    orderBy: { timestamp: 'desc' }
  });

  // Unique active users
  const uniqueUsersMap = new Map();
  activeLogs.forEach(log => {
    if (log.User && !uniqueUsersMap.has(log.userId)) {
      uniqueUsersMap.set(log.userId, {
        name: log.User.name,
        role: log.User.role,
        lastActive: log.timestamp
      });
    }
  });

  const activeUserList = Array.from(uniqueUsersMap.values());
  const activeUsers = activeUserList.length;

  let dbHealthy = true;
  let dbResponseTime = 0;
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbResponseTime = Date.now() - startTime;
  } catch {
    dbHealthy = false;
  }

  let dbSize = 'N/A';
  try {
    const result = await prisma.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;
    if (result?.[0]) dbSize = result[0].size;
  } catch (error) {
    console.error('Failed to get database size:', error);
  }

  const [taskCount, userCount, clientCount, auditLogCount] = await Promise.all([
    prisma.task.count(),
    prisma.user.count(),
    prisma.client.count(),
    prisma.auditLog.count()
  ]);

  const memory = process.memoryUsage();
  
  // Format uptime
  const uptimeSeconds = process.uptime();
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeFormatted = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;

  return {
    serverStatus: 'Online',
    databaseStatus: dbHealthy ? 'Healthy' : 'Issues Detected',
    databaseResponseTime: `${dbResponseTime}ms`,
    databaseSize: dbSize,
    activeUsers,
    activeUserList,
    apiResponseTime: 'N/A',
    serverUptime: uptimeFormatted,
    memoryUsage: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      external: Math.round(memory.external / 1024 / 1024)
    },
    statistics: {
      totalTasks: taskCount,
      totalUsers: userCount,
      totalClients: clientCount,
      totalAuditLogs: auditLogCount
    }
  };
}

/**
 * Fetches filtered and paginated tasks for admin management.
 */
export async function getAdminTasksAction(params: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  editor?: string;
  qc?: string;
  scheduler?: string;
  videographer?: string;
  client?: string;
  status?: string;
  priority?: string;
  deliverableType?: string;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  month?: string;
}) {
  await validateAdmin();

  const {
    page = 1,
    limit = 25,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    editor,
    qc,
    scheduler,
    videographer,
    client,
    status,
    priority,
    deliverableType,
    search,
    dueDateFrom,
    dueDateTo,
    month
  } = params;

  const where: any = {};
  if (editor && editor !== 'all') where.assignedTo = parseInt(editor);
  if (qc && qc !== 'all') where.qc_specialist = parseInt(qc);
  if (scheduler && scheduler !== 'all') where.scheduler = parseInt(scheduler);
  if (videographer && videographer !== 'all') where.videographer = parseInt(videographer);
  if (client && client !== 'all') where.clientId = client;
  if (status && status !== 'all') where.status = status as TaskStatus;
  if (priority && priority !== 'all') where.priority = priority;
  if (month && month !== 'all') where.monthFolder = month;

  if (deliverableType && deliverableType !== 'all') {
    where.monthlyDeliverable = { type: deliverableType };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (dueDateFrom || dueDateTo) {
    where.dueDate = {};
    if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom);
    if (dueDateTo) where.dueDate.lte = new Date(dueDateTo);
  }

  const useSmartSort = sortBy === 'title';
  const orderBy: any = useSmartSort ? { createdAt: 'desc' } : { [sortBy]: sortOrder };

  const [tasks, total, deliverableTypes, distinctMonths] = await Promise.all([
    prisma.task.findMany({
      where,
      take: useSmartSort ? 1000 : limit,
      skip: useSmartSort ? 0 : (page - 1) * limit,
      orderBy,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        client: { select: { id: true, name: true, companyName: true } },
        monthlyDeliverable: { select: { id: true, type: true } },
        oneOffDeliverable: { select: { id: true, type: true } },
      }
    }),
    prisma.task.count({ where }),
    prisma.monthlyDeliverable.findMany({
      select: { type: true },
      distinct: ['type'],
      orderBy: { type: 'asc' }
    }),
    prisma.task.findMany({
      where: { monthFolder: { not: null } },
      select: { monthFolder: true },
      distinct: ['monthFolder'],
      orderBy: { monthFolder: 'desc' }
    })
  ]);

  let sortedTasks = tasks;
  if (useSmartSort) {
      // Helper for smart sorting (LF > SF > SQF)
      const extractParts = (t: string | null) => {
          if (!t) return { c: '', d: '', p: '', n: 0 };
          const m = t.match(/^(.+)_(\d{2}-\d{2}-\d{4})_([a-zA-Z]+)(\d+)$/);
          return m ? { c: m[1].toLowerCase(), d: m[2].split('-').reverse().join(''), p: m[3].toLowerCase(), n: parseInt(m[4]) } 
                   : { c: t.toLowerCase(), d: '', p: '', n: 0 };
      };
      const prio = (p: string) => ({ lf: 1, sf: 2, sqf: 3 }[p] || 99);

      sortedTasks = [...tasks].sort((a, b) => {
          const pA = extractParts(a.title), pB = extractParts(b.title);
          if (pA.c !== pB.c) return pA.c.localeCompare(pB.c);
          if (pA.d !== pB.d) return pA.d.localeCompare(pB.d);
          if (prio(pA.p) !== prio(pB.p)) return prio(pA.p) - prio(pB.p);
          return pA.n - pB.n;
      });
      if (sortOrder === 'desc') sortedTasks.reverse();
      sortedTasks = sortedTasks.slice((page - 1) * limit, page * limit);
  }

  // Enrich with team members
  const userIds = new Set<number>();
  sortedTasks.forEach(t => {
      if (t.qc_specialist) userIds.add(t.qc_specialist);
      if (t.scheduler) userIds.add(t.scheduler);
      if (t.videographer) userIds.add(t.videographer);
  });
  const team = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, role: true }
  });
  const teamMap = new Map(team.map(m => [m.id, m]));

  const enriched = sortedTasks.map(t => ({
      ...t,
      editor: t.user,
      qcSpecialist: t.qc_specialist ? teamMap.get(t.qc_specialist) : null,
      schedulerUser: t.scheduler ? teamMap.get(t.scheduler) : null,
      videographerUser: t.videographer ? teamMap.get(t.videographer) : null,
  }));

  const statusCounts = await prisma.task.groupBy({ by: ['status'], where, _count: { status: true } });
  const overdue = await prisma.task.count({
      where: { ...where, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'SCHEDULED'] } }
  });

  return {
    tasks: enriched,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    deliverableTypes: deliverableTypes.map(d => d.type),
    availableMonths: distinctMonths.map(d => d.monthFolder).filter(Boolean) as string[],
    stats: {
        total,
        byStatus: statusCounts.reduce((acc, i) => { if (i.status) acc[i.status] = i._count.status; return acc; }, {} as any),
        overdue
    }
  };
}

/**
 * Updates a single task.
 */
export async function updateTaskAction(id: string, updates: any) {
  const user = await validateAdmin();
  const existing = await prisma.task.findUnique({ where: { id }, select: { title: true, status: true } });
  if (!existing) throw new Error('Task not found');

  const { dueDate, ...otherUpdates } = updates;
  const data: any = { ...otherUpdates, updatedAt: new Date() };
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

  const updated = await prisma.task.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true, role: true } },
      client: { select: { id: true, name: true, companyName: true } }
    }
  });

  await createAuditLog({
    userId: user.id,
    action: AuditAction.TASK_UPDATED,
    entity: 'Task',
    entityId: id,
    details: `Updated task: ${existing.title || id}`,
    metadata: { taskId: id, previousStatus: existing.status, newStatus: data.status, changes: Object.keys(data) }
  });

  revalidatePath('/dashboard');
  return updated;
}

/**
 * Bulk updates multiple tasks.
 */
export async function bulkUpdateTasksAction(taskIds: string[], updates: any) {
  const user = await validateAdmin();
  if (!taskIds?.length) throw new Error('No tasks selected');

  const allowed = ['status', 'assignedTo', 'qc_specialist', 'scheduler', 'videographer', 'priority', 'dueDate'];
  const filtered: any = {};
  Object.keys(updates).forEach(k => {
    if (allowed.includes(k)) {
      if (k === 'dueDate') filtered[k] = updates[k] ? new Date(updates[k]) : null;
      else filtered[k] = updates[k];
    }
  });

  const result = await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data: filtered
  });

  await createAuditLog({
    userId: user.id,
    action: AuditAction.TASK_UPDATED,
    entity: 'Task',
    entityId: 'multiple',
    details: `Bulk updated ${result.count} tasks`,
    metadata: { taskIds, updates: filtered }
  });

  revalidatePath('/dashboard');
  return { updated: result.count };
}

/**
 * Deletes a task.
 */
export async function deleteTaskAction(id: string) {
  const user = await validateAdmin();
  const existing = await prisma.task.findUnique({ where: { id }, select: { title: true } });
  if (!existing) throw new Error('Task not found');

  await prisma.task.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    action: AuditAction.TASK_DELETED,
    entity: 'Task',
    entityId: id,
    details: `Deleted task: ${existing.title || id}`,
    metadata: { taskId: id }
  });

  revalidatePath('/dashboard');
  return { success: true };
}
