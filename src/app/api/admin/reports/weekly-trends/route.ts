export const dynamic = 'force-dynamic';
// app/api/admin/reports/weekly-trends/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { task } from '@/lib/db/schema';
import { and, eq, gte, lt, inArray, count } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

const TaskStatus = {
  COMPLETED: 'COMPLETED',
  QC_IN_PROGRESS: 'QC_IN_PROGRESS',
  READY_FOR_QC: 'READY_FOR_QC',
  SCHEDULED: 'SCHEDULED',
} as const;

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
      const [{ value: tasksUploaded }] = await db.select({ value: count() }).from(task).where(and(
        gte(task.createdAt, weekStart.toISOString()),
        lt(task.createdAt, weekEnd.toISOString())
      ));

      // Get tasks approved this week
      const [{ value: tasksApproved }] = await db.select({ value: count() }).from(task).where(and(
        eq(task.status, TaskStatus.COMPLETED),
        gte(task.updatedAt, weekStart.toISOString()),
        lt(task.updatedAt, weekEnd.toISOString())
      ));

      // Get QC checks this week
      const [{ value: qcChecks }] = await db.select({ value: count() }).from(task).where(and(
        inArray(task.status, [TaskStatus.QC_IN_PROGRESS, TaskStatus.READY_FOR_QC]),
        gte(task.updatedAt, weekStart.toISOString()),
        lt(task.updatedAt, weekEnd.toISOString())
      ));

      // Get scheduled tasks this week
      const [{ value: schedulingTasks }] = await db.select({ value: count() }).from(task).where(and(
        eq(task.status, TaskStatus.SCHEDULED),
        gte(task.updatedAt, weekStart.toISOString()),
        lt(task.updatedAt, weekEnd.toISOString())
      ));

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

  } finally {
    await closeDb();
  }
}