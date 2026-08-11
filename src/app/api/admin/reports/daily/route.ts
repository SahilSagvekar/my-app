export const dynamic = 'force-dynamic';
// app/api/admin/reports/daily/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, task } from '@/lib/db/schema';
import { and, eq, ne, gte, lte, inArray, count } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

const TaskStatus = {
  COMPLETED: 'COMPLETED',
  QC_IN_PROGRESS: 'QC_IN_PROGRESS',
  READY_FOR_QC: 'READY_FOR_QC',
  SCHEDULED: 'SCHEDULED',
} as const;

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
    const employeeId = url.searchParams.get('employeeId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Build date filter
    let dateFilter: { gte: Date; lte?: Date };
    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = {
        gte: thirtyDaysAgo
      };
    }
    const dateRange = (col: typeof task.createdAt) =>
      dateFilter.lte
        ? and(gte(col, dateFilter.gte.toISOString()), lte(col, dateFilter.lte.toISOString()))
        : gte(col, dateFilter.gte.toISOString());

    // Build employee filter
    const employeeConditions = [ne(user.role, 'client')];
    if (employeeId && employeeId !== 'all') {
      employeeConditions.push(eq(user.id, parseInt(employeeId)));
    }

    // Get all employees matching filter
    const employees = await db
      .select({ id: user.id, name: user.name, email: user.email, role: user.role })
      .from(user)
      .where(and(...employeeConditions));

    // Get daily task activity for each employee
    const dailyReports = await Promise.all(
      employees.map(async (employee) => {
        // Get tasks created by this employee (uploaded)
        const tasksCreated = await db
          .select({ createdAt: task.createdAt, _count: count() })
          .from(task)
          .where(and(eq(task.createdBy, employee.id), dateRange(task.createdAt)))
          .groupBy(task.createdAt);

        // Get tasks completed/approved by this employee
        const tasksCompleted = await db
          .select({ updatedAt: task.updatedAt, _count: count() })
          .from(task)
          .where(and(eq(task.assignedTo, employee.id), eq(task.status, TaskStatus.COMPLETED), dateRange(task.updatedAt)))
          .groupBy(task.updatedAt);

        // Get QC tasks (for QC specialists)
        const qcTasks = employee.role === 'qc' ? await db
          .select({ updatedAt: task.updatedAt, _count: count() })
          .from(task)
          .where(and(
            eq(task.qcSpecialist, employee.id),
            inArray(task.status, [TaskStatus.QC_IN_PROGRESS, TaskStatus.READY_FOR_QC]),
            dateRange(task.updatedAt)
          ))
          .groupBy(task.updatedAt) : [];

        // Get scheduled tasks (for schedulers)
        const scheduledTasks = employee.role === 'scheduler' ? await db
          .select({ updatedAt: task.updatedAt, _count: count() })
          .from(task)
          .where(and(eq(task.scheduler, employee.id), eq(task.status, TaskStatus.SCHEDULED), dateRange(task.updatedAt)))
          .groupBy(task.updatedAt) : [];

        // Aggregate by date
        const dailyData = new Map();

        // Process created tasks
        tasksCreated.forEach(item => {
          const date = new Date(item.createdAt).toISOString().split('T')[0];
          if (!dailyData.has(date)) {
            dailyData.set(date, {
              date,
              employee: employee.name,
              role: employee.role,
              tasksUploaded: 0,
              tasksApproved: 0,
              qcChecks: 0,
              schedulingTasks: 0,
              totalOutput: 0
            });
          }
          dailyData.get(date).tasksUploaded += item._count;
        });

        // Process completed tasks
        tasksCompleted.forEach(item => {
          const date = new Date(item.updatedAt).toISOString().split('T')[0];
          if (!dailyData.has(date)) {
            dailyData.set(date, {
              date,
              employee: employee.name,
              role: employee.role,
              tasksUploaded: 0,
              tasksApproved: 0,
              qcChecks: 0,
              schedulingTasks: 0,
              totalOutput: 0
            });
          }
          dailyData.get(date).tasksApproved += item._count;
        });

        // Process QC tasks
        qcTasks.forEach(item => {
          const date = new Date(item.updatedAt).toISOString().split('T')[0];
          if (!dailyData.has(date)) {
            dailyData.set(date, {
              date,
              employee: employee.name,
              role: employee.role,
              tasksUploaded: 0,
              tasksApproved: 0,
              qcChecks: 0,
              schedulingTasks: 0,
              totalOutput: 0
            });
          }
          dailyData.get(date).qcChecks += item._count;
        });

        // Process scheduled tasks
        scheduledTasks.forEach(item => {
          const date = new Date(item.updatedAt).toISOString().split('T')[0];
          if (!dailyData.has(date)) {
            dailyData.set(date, {
              date,
              employee: employee.name,
              role: employee.role,
              tasksUploaded: 0,
              tasksApproved: 0,
              qcChecks: 0,
              schedulingTasks: 0,
              totalOutput: 0
            });
          }
          dailyData.get(date).schedulingTasks += item._count;
        });

        // Calculate total output for each day
        dailyData.forEach(day => {
          day.totalOutput = day.tasksUploaded + day.tasksApproved + day.qcChecks + day.schedulingTasks;
        });

        return Array.from(dailyData.values());
      })
    );

    // Flatten and sort by date
    const allReports = dailyReports
      .flat()
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      ok: true,
      reports: allReports,
      total: allReports.length
    });

  } catch (error) {
    console.error('Error fetching daily reports:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}