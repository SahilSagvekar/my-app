export const dynamic = 'force-dynamic';
// app/api/admin/reports/performance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { user, task } from '@/lib/db/schema';
import { and, or, eq, ne, gte, lte, lt, count } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

const TaskStatus = { COMPLETED: 'COMPLETED' } as const;

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
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = {
        gte: thirtyDaysAgo
      };
    }
    const dateRange = (col: typeof task.createdAt, filter: { gte: Date; lte?: Date; lt?: Date }) => {
      const conditions = [gte(col, filter.gte.toISOString())];
      if (filter.lte) conditions.push(lte(col, filter.lte.toISOString()));
      if (filter.lt) conditions.push(lt(col, filter.lt.toISOString()));
      return and(...conditions);
    };

    // Get all active employees
    const employees = await db
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(and(ne(user.role, 'client'), eq(user.employeeStatus, 'ACTIVE')));

    const performanceData = await Promise.all(
      employees.map(async (employee) => {
        // Get total tasks for this employee
        const [{ value: totalTasks }] = await db.select({ value: count() }).from(task).where(and(
          or(
            eq(task.assignedTo, employee.id),
            eq(task.createdBy, employee.id),
            eq(task.qcSpecialist, employee.id),
            eq(task.scheduler, employee.id)
          ),
          dateRange(task.createdAt, dateFilter)
        ));

        // Get completed tasks
        const [{ value: completedTasks }] = await db.select({ value: count() }).from(task).where(and(
          eq(task.assignedTo, employee.id),
          eq(task.status, TaskStatus.COMPLETED),
          dateRange(task.updatedAt, dateFilter)
        ));

        // Calculate working days in period
        const start = new Date(dateFilter.gte);
        const end = dateFilter.lte ? new Date(dateFilter.lte) : new Date();
        const workingDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate daily average
        const avgDaily = workingDays > 0 ? totalTasks / workingDays : 0;

        // Calculate efficiency (completed / assigned * 100)
        const [{ value: assignedTasks }] = await db.select({ value: count() }).from(task).where(and(
          eq(task.assignedTo, employee.id),
          dateRange(task.createdAt, dateFilter)
        ));

        const efficiency = assignedTasks > 0
          ? Math.round((completedTasks / assignedTasks) * 100)
          : 0;

        // Calculate trend (compare with previous period)
        const previousPeriodStart = new Date(start);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - workingDays);

        const [{ value: previousTasks }] = await db.select({ value: count() }).from(task).where(and(
          or(
            eq(task.assignedTo, employee.id),
            eq(task.createdBy, employee.id)
          ),
          gte(task.createdAt, previousPeriodStart.toISOString()),
          lt(task.createdAt, start.toISOString())
        ));

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (totalTasks > previousTasks * 1.1) trend = 'up';
        else if (totalTasks < previousTasks * 0.9) trend = 'down';

        return {
          employee: employee.name,
          role: employee.role,
          totalTasks,
          avgDaily: parseFloat(avgDaily.toFixed(1)),
          efficiency: Math.min(efficiency, 100),
          trend
        };
      })
    );

    // Sort by total tasks descending
    performanceData.sort((a, b) => b.totalTasks - a.totalTasks);

    return NextResponse.json({
      ok: true,
      performance: performanceData
    });

  } catch (error) {
    console.error('Error fetching performance data:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}