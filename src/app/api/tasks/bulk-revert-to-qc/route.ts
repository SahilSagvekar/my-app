import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
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
        const updatedTasks = await prisma.task.updateMany({
            where: {
                id: { in: taskIds },
            },
            data: {
                status: 'READY_FOR_QC',
                qcResult: null,
                nextDestination: null,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            count: updatedTasks.count,
            message: `${updatedTasks.count} task(s) reverted to QC review`,
        });
    } catch (error) {
        console.error('[BULK REVERT TO QC] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to revert tasks to QC' },
            { status: 500 }
        );
    }
}
