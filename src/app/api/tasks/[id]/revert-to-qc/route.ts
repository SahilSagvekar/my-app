export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { task } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
  const { db, closeDb } = getDb();
  try {
    try {
        const taskId = params.id;

        if (!taskId) {
            return NextResponse.json(
                { success: false, error: 'Task ID is required' },
                { status: 400 }
            );
        }

        // Update task status back to IN_QC
        const [updatedTask] = await db.update(task).set({
            status: 'READY_FOR_QC',
            qcResult: null,
            // Clear routing info
            nextDestination: null,
            // Keep qcNotes and feedback for reference, but mark as reverted
            updatedAt: new Date().toISOString(),
        }).where(eq(task.id, taskId)).returning();

        return NextResponse.json({
            success: true,
            task: updatedTask,
        });
    } catch (error) {
        console.error('[REVERT TO QC] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to revert task to QC' },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}
