// app/api/admin/tasks/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// import { getServerSession } from 'next-auth';
// import { authOptions } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
    try {
        // const session = await getServerSession(authOptions);
        
        // if (!session || session.user.role !== 'admin') {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const body = await req.json();
        const { taskIds, updates } = body;

        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
            return NextResponse.json({ error: 'No tasks selected' }, { status: 400 });
        }

        if (!updates || Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
        }

        // Validate allowed fields
        const allowedFields = ['status', 'assignedTo', 'qc_specialist', 'scheduler', 'videographer', 'priority'];
        const updateData: any = {};

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                updateData[key] = value;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
        }

        // Perform bulk update
        const result = await prisma.task.updateMany({
            where: {
                id: { in: taskIds }
            },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            updated: result.count,
            message: `Updated ${result.count} tasks`
        });

    } catch (error: any) {
        console.error('Bulk update error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update tasks' },
            { status: 500 }
        );
    }
}