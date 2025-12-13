// app/api/admin/reports/weekly-trends/route.ts
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
    const weeks = parseInt(url.searchParams.get('weeks') || '4');

    const weeklyData = [];
    const today = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7) - 7);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      // Get tasks created this week
      const tasksUploaded = await prisma.task.count({
        where: {
          createdAt: {
            gte: weekStart,
            lt: weekEnd
          }
        }
      });

      // Get tasks approved this week
      const tasksApproved = await prisma.task.count({
        where: {
          status: TaskStatus.COMPLETED,
          updatedAt: {
            gte: weekStart,
            lt: weekEnd
          }
        }
      });

      // Get QC checks this week
      const qcChecks = await prisma.task.count({
        where: {
          status: {
            in: [TaskStatus.QC_IN_PROGRESS, TaskStatus.READY_FOR_QC]
          },
          updatedAt: {
            gte: weekStart,
            lt: weekEnd
          }
        }
      });

      // Get scheduled tasks this week
      const schedulingTasks = await prisma.task.count({
        where: {
          status: TaskStatus.SCHEDULED,
          updatedAt: {
            gte: weekStart,
            lt: weekEnd
          }
        }
      });

      weeklyData.push({
        week: `Week ${weeks - i}`,
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        tasksUploaded,
        tasksApproved,
        qcChecks,
        schedulingTasks
      });
    }

    return NextResponse.json({
      ok: true,
      trends: weeklyData
    });

  } catch (error) {
    console.error('Error fetching weekly trends:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}