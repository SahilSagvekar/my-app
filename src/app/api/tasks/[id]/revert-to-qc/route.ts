export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const taskId = params.id;

        if (!taskId) {
            return NextResponse.json(
                { success: false, error: 'Task ID is required' },
                { status: 400 }
            );
        }

        // Update task status back to IN_QC
        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: {
                status: 'READY_FOR_QC',
                qcResult: null,
                // Clear routing info
                nextDestination: null,
                // Keep qcNotes and feedback for reference, but mark as reverted
                updatedAt: new Date(),
            },
        });

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
}
