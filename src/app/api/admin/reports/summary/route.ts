export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task } from '@/lib/db/schema';
import { and, eq, gte, lte, lt, inArray, count } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

const TaskStatus = {
  COMPLETED: 'COMPLETED',
  QC_IN_PROGRESS: 'QC_IN_PROGRESS',
  READY_FOR_QC: 'READY_FOR_QC',
  SCHEDULED: 'SCHEDULED',
} as const;

export async function GET(req: NextRequest) {
  const db = getDbHttp();
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
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    let dateFilter: { gte: Date; lte?: Date };
    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = {
        gte: thirtyDaysAgo,
      };
    }
    const dateRange = (col: typeof task.createdAt, filter: { gte: Date; lte?: Date; lt?: Date }) => {
      const conditions = [gte(col, filter.gte.toISOString())];
      if (filter.lte) conditions.push(lte(col, filter.lte.toISOString()));
      if (filter.lt) conditions.push(lt(col, filter.lt.toISOString()));
      return and(...conditions);
    };

    // Calculate current period metrics
    const [tasksUploaded, tasksApproved, qcChecks, schedulingTasks] =
      await Promise.all([
        db.select({ value: count() }).from(task).where(dateRange(task.createdAt, dateFilter)),
        db.select({ value: count() }).from(task).where(and(
          eq(task.status, TaskStatus.COMPLETED),
          dateRange(task.updatedAt, dateFilter),
        )),
        db.select({ value: count() }).from(task).where(and(
          inArray(task.status, [TaskStatus.QC_IN_PROGRESS, TaskStatus.READY_FOR_QC]),
          dateRange(task.updatedAt, dateFilter),
        )),
        db.select({ value: count() }).from(task).where(and(
          eq(task.status, TaskStatus.SCHEDULED),
          dateRange(task.updatedAt, dateFilter),
        )),
      ]).then(rows => rows.map(r => r[0].value));

    // Calculate previous period for comparison
    const start = new Date(dateFilter.gte);
    const end = dateFilter.lte ? new Date(dateFilter.lte) : new Date();
    const daysDiff = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - daysDiff);

    const previousDateFilter = {
      gte: previousStart,
      lt: start,
    };

    const [
      prevTasksUploaded,
      prevTasksApproved,
      prevQcChecks,
      prevSchedulingTasks,
    ] = await Promise.all([
      db.select({ value: count() }).from(task).where(dateRange(task.createdAt, previousDateFilter)),
      db.select({ value: count() }).from(task).where(and(
        eq(task.status, TaskStatus.COMPLETED),
        dateRange(task.updatedAt, previousDateFilter),
      )),
      db.select({ value: count() }).from(task).where(and(
        inArray(task.status, [TaskStatus.QC_IN_PROGRESS, TaskStatus.READY_FOR_QC]),
        dateRange(task.updatedAt, previousDateFilter),
      )),
      db.select({ value: count() }).from(task).where(and(
        eq(task.status, TaskStatus.SCHEDULED),
        dateRange(task.updatedAt, previousDateFilter),
      )),
    ]).then(rows => rows.map(r => r[0].value));

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): string => {
      if (previous === 0) {
        return current > 0 ? "100.0" : "0.0";
      }
      return (((current - previous) / previous) * 100).toFixed(1);
    };

   return NextResponse.json({
  ok: true,
  summary: {
    tasksUploaded: {
      value: tasksUploaded,
      change: `${parseFloat(calculateChange(tasksUploaded, prevTasksUploaded)) >= 0 ? '+' : ''}${calculateChange(tasksUploaded, prevTasksUploaded)}%`
    },
    tasksApproved: {
      value: tasksApproved,
      change: `${parseFloat(calculateChange(tasksApproved, prevTasksApproved)) >= 0 ? '+' : ''}${calculateChange(tasksApproved, prevTasksApproved)}%`
    },
    qcChecks: {
      value: qcChecks,
      change: `${parseFloat(calculateChange(qcChecks, prevQcChecks)) >= 0 ? '+' : ''}${calculateChange(qcChecks, prevQcChecks)}%`
    },
    schedulingTasks: {
      value: schedulingTasks,
      change: `${parseFloat(calculateChange(schedulingTasks, prevSchedulingTasks)) >= 0 ? '+' : ''}${calculateChange(schedulingTasks, prevSchedulingTasks)}%`
    }
  }
});
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}