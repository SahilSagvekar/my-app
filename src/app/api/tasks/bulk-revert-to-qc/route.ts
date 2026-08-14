export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { task } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const { db, closeDb } = getDb();
  try {
    try {
        const body = await request.json();
        const { taskIds } = body;

        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Task IDs array is required' },
                { status: 400 }
            );
        }

        // Update all selected tasks back to IN_QC status
        const updatedTasks = await db.update(task).set({
            status: 'READY_FOR_QC',
            qcResult: null,
            nextDestination: null,
            updatedAt: new Date().toISOString(),
        }).where(inArray(task.id, taskIds)).returning({ id: task.id });

        return NextResponse.json({
            success: true,
            count: updatedTasks.length,
            message: `${updatedTasks.length} task(s) reverted to QC review`,
        });
    } catch (error) {
        console.error('[BULK REVERT TO QC] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to revert tasks to QC' },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}
