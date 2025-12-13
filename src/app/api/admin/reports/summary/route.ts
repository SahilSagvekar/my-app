import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { TaskStatus } from '@prisma/client';

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
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    let dateFilter: any = {};
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

    // Calculate current period metrics
    const [tasksUploaded, tasksApproved, qcChecks, schedulingTasks] =
      await Promise.all([
        prisma.task.count({
          where: { createdAt: dateFilter },
        }),
        prisma.task.count({
          where: {
            status: TaskStatus.COMPLETED,
            updatedAt: dateFilter,
          },
        }),
        prisma.task.count({
          where: {
            status: {
              in: [TaskStatus.QC_IN_PROGRESS, TaskStatus.READY_FOR_QC],
            },
            updatedAt: dateFilter,
          },
        }),
        prisma.task.count({
          where: {
            status: TaskStatus.SCHEDULED,
            updatedAt: dateFilter,
          },
        }),
      ]);

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
      prisma.task.count({
        where: { createdAt: previousDateFilter },
      }),
      prisma.task.count({
        where: {
          status: TaskStatus.COMPLETED,
          updatedAt: previousDateFilter,
        },
      }),
      prisma.task.count({
        where: {
          status: {
            in: [TaskStatus.QC_IN_PROGRESS, TaskStatus.READY_FOR_QC],
          },
          updatedAt: previousDateFilter,
        },
      }),
      prisma.task.count({
        where: {
          status: TaskStatus.SCHEDULED,
          updatedAt: previousDateFilter,
        },
      }),
    ]);

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