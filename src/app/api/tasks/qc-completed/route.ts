export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addSignedUrlsToFiles } from '@/lib/s3';

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

        // ✅ Add signed URLs to files
        const tasksWithSignedUrls = await Promise.all(
            completedTasks.map(async (task) => {
                const files = await prisma.file.findMany({
                    where: { taskId: task.id, isActive: true },
                });
                const signedFiles = await addSignedUrlsToFiles(files);
                return { ...task, files: signedFiles };
            })
        );

        return NextResponse.json({
            success: true,
            tasks: tasksWithSignedUrls,
        });
    } catch (error) {
        console.error('[QC COMPLETED] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch completed tasks' },
            { status: 500 }
        );
    }
}
