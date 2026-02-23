import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        // Fetch tasks that have been completed or rejected by QC
        const completedTasks = await prisma.task.findMany({
            where: {
                OR: [
                    { status: 'COMPLETED', qcResult: 'APPROVED' },
                    { status: 'REJECTED', qcResult: 'REJECTED' },
                ],
            },
            orderBy: {
                updatedAt: 'desc',
            },
            take: 100, // Limit to last 100 completed tasks
        });

        return NextResponse.json({
            success: true,
            tasks: completedTasks,
        });
    } catch (error) {
        console.error('[QC COMPLETED] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch completed tasks' },
            { status: 500 }
        );
    }
}
