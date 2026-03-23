export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// Helper to get month key (YYYY-MM format)
function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Helper to get month name
function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

    const url = new URL(req.url);
    const selectedMonth = url.searchParams.get('month'); // YYYY-MM format
    const view = url.searchParams.get('view') || 'clients'; // 'clients' or 'employees'

    // Get date range for the last 12 months if no specific month selected
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Fetch all active clients with their deliverables
    const clients = await prisma.client.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        companyName: true,
        monthlyDeliverables: {
          select: {
            id: true,
            type: true,
            quantity: true,
            platforms: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Fetch all completed/posted tasks grouped by client and month
    const tasks = await prisma.task.findMany({
      where: {
        createdAt: { gte: twelveMonthsAgo },
        status: {
          in: ['COMPLETED', 'POSTED', 'SCHEDULED'],
        },
      },
      select: {
        id: true,
        clientId: true,
        assignedTo: true,
        qc_specialist: true,
        scheduler: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deliverableType: true,
        monthlyDeliverableId: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    });

    // Fetch all employees
    const employees = await prisma.user.findMany({
      where: {
        role: {
          in: ['editor', 'qc', 'scheduler', 'videographer', 'manager', 'admin'],
        },
        employeeStatus: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });

    // Process client deliverables data
    const clientDeliverables: Record<string, {
      clientId: string;
      clientName: string;
      companyName: string | null;
      targetMonthly: number;
      months: Record<string, { completed: number; posted: number; scheduled: number; total: number }>;
    }> = {};

    // Initialize client data
    for (const client of clients) {
      const totalTarget = client.monthlyDeliverables.reduce((sum, d) => sum + d.quantity, 0);
      clientDeliverables[client.id] = {
        clientId: client.id,
        clientName: client.name,
        companyName: client.companyName,
        targetMonthly: totalTarget,
        months: {},
      };
    }

    // Process tasks for client view
    for (const task of tasks) {
      if (!task.clientId || !clientDeliverables[task.clientId]) continue;

      const monthKey = getMonthKey(new Date(task.createdAt));

      if (!clientDeliverables[task.clientId].months[monthKey]) {
        clientDeliverables[task.clientId].months[monthKey] = {
          completed: 0,
          posted: 0,
          scheduled: 0,
          total: 0,
        };
      }

      const monthData = clientDeliverables[task.clientId].months[monthKey];
      monthData.total++;

      if (task.status === 'COMPLETED') monthData.completed++;
      if (task.status === 'POSTED') monthData.posted++;
      if (task.status === 'SCHEDULED') monthData.scheduled++;
    }

    // Process employee productivity data
    const employeeProductivity: Record<number, {
      employeeId: number;
      employeeName: string;
      role: string;
      months: Record<string, {
        tasksCompleted: number;
        clientBreakdown: Record<string, { clientName: string; companyName: string | null; count: number }>;
      }>;
    }> = {};

    // Initialize employee data
    for (const emp of employees) {
      employeeProductivity[emp.id] = {
        employeeId: emp.id,
        employeeName: emp.name || 'Unknown',
        role: emp.role || 'Unknown',
        months: {},
      };
    }

    // Process tasks for employee view
    for (const task of tasks) {
      const employeeId = task.assignedTo;
      if (!employeeId || !employeeProductivity[employeeId]) continue;

      const monthKey = getMonthKey(new Date(task.createdAt));

      if (!employeeProductivity[employeeId].months[monthKey]) {
        employeeProductivity[employeeId].months[monthKey] = {
          tasksCompleted: 0,
          clientBreakdown: {},
        };
      }

      const monthData = employeeProductivity[employeeId].months[monthKey];
      monthData.tasksCompleted++;

      // Track client breakdown
      if (task.client) {
        const clientId = task.client.id;
        if (!monthData.clientBreakdown[clientId]) {
          monthData.clientBreakdown[clientId] = {
            clientName: task.client.name,
            companyName: task.client.companyName,
            count: 0,
          };
        }
        monthData.clientBreakdown[clientId].count++;
      }
    }

    // Also track QC work
    for (const task of tasks) {
      const qcId = task.qc_specialist;
      if (!qcId || !employeeProductivity[qcId]) continue;

      const monthKey = getMonthKey(new Date(task.updatedAt));

      if (!employeeProductivity[qcId].months[monthKey]) {
        employeeProductivity[qcId].months[monthKey] = {
          tasksCompleted: 0,
          clientBreakdown: {},
        };
      }

      // Only count if this is a QC user reviewing
      const employee = employees.find(e => e.id === qcId);
      if (employee?.role === 'qc') {
        employeeProductivity[qcId].months[monthKey].tasksCompleted++;

        if (task.client) {
          const clientId = task.client.id;
          if (!employeeProductivity[qcId].months[monthKey].clientBreakdown[clientId]) {
            employeeProductivity[qcId].months[monthKey].clientBreakdown[clientId] = {
              clientName: task.client.name,
              companyName: task.client.companyName,
              count: 0,
            };
          }
          employeeProductivity[qcId].months[monthKey].clientBreakdown[clientId].count++;
        }
      }
    }

    // Track Scheduler work
    for (const task of tasks) {
      const schedulerId = task.scheduler;
      if (!schedulerId || !employeeProductivity[schedulerId]) continue;

      if (task.status === 'SCHEDULED' || task.status === 'POSTED') {
        const monthKey = getMonthKey(new Date(task.updatedAt));

        if (!employeeProductivity[schedulerId].months[monthKey]) {
          employeeProductivity[schedulerId].months[monthKey] = {
            tasksCompleted: 0,
            clientBreakdown: {},
          };
        }

        const employee = employees.find(e => e.id === schedulerId);
        if (employee?.role === 'scheduler') {
          employeeProductivity[schedulerId].months[monthKey].tasksCompleted++;

          if (task.client) {
            const clientId = task.client.id;
            if (!employeeProductivity[schedulerId].months[monthKey].clientBreakdown[clientId]) {
              employeeProductivity[schedulerId].months[monthKey].clientBreakdown[clientId] = {
                clientName: task.client.name,
                companyName: task.client.companyName,
                count: 0,
              };
            }
            employeeProductivity[schedulerId].months[monthKey].clientBreakdown[clientId].count++;
          }
        }
      }
    }

    // Generate list of last 12 months
    const monthsList: { key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = getMonthKey(date);
      monthsList.push({
        key,
        label: getMonthName(key),
      });
    }

    // Calculate summary stats
    const currentMonthKey = getMonthKey(now);
    const previousMonthKey = getMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    let totalCurrentMonth = 0;
    let totalPreviousMonth = 0;
    let totalTarget = 0;

    for (const client of Object.values(clientDeliverables)) {
      totalTarget += client.targetMonthly;
      totalCurrentMonth += client.months[currentMonthKey]?.total || 0;
      totalPreviousMonth += client.months[previousMonthKey]?.total || 0;
    }

    const summary = {
      totalClients: clients.length,
      totalActiveEmployees: employees.length,
      totalTargetDeliverables: totalTarget,
      currentMonthCompleted: totalCurrentMonth,
      previousMonthCompleted: totalPreviousMonth,
      completionRate: totalTarget > 0 ? Math.round((totalCurrentMonth / totalTarget) * 100) : 0,
      monthOverMonthChange: totalPreviousMonth > 0 
        ? Math.round(((totalCurrentMonth - totalPreviousMonth) / totalPreviousMonth) * 100) 
        : 0,
    };

    return NextResponse.json({
      ok: true,
      summary,
      monthsList,
      clientDeliverables: Object.values(clientDeliverables),
      employeeProductivity: Object.values(employeeProductivity),
    });

  } catch (error) {
    console.error('Error fetching monthly deliverables:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}