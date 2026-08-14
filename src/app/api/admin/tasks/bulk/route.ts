export const dynamic = 'force-dynamic';
// app/api/admin/tasks/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task as taskTable } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { notifyEditorTaskAssignment } from '@/lib/notify';
// import { getServerSession } from 'next-auth';
// import { authOptions } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  const db = getDbHttp();
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
        // Prisma field name -> Drizzle schema.ts property name (only differs
        // for qc_specialist, which maps to the DB column "qc_specialist").
        const fieldNameMap: Record<string, string> = { qc_specialist: 'qcSpecialist' };
        const updateData: any = {};

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                updateData[fieldNameMap[key] || key] = value;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
        }

        // If assignedTo is part of this bulk update, work out which of the
        // selected tasks actually change editor — only those should trigger
        // a Slack notification, not tasks already assigned to that editor.
        let reassignedTaskIds: string[] = [];
        if (updateData.assignedTo !== undefined && updateData.assignedTo) {
            const existingTasks = await db.select({ id: taskTable.id, assignedTo: taskTable.assignedTo })
                .from(taskTable)
                .where(inArray(taskTable.id, taskIds));
            reassignedTaskIds = existingTasks
                .filter((t) => t.assignedTo !== updateData.assignedTo)
                .map((t) => t.id);
        }

        // Perform bulk update
        const updatedRows = await db.update(taskTable)
            .set({ ...updateData, updatedAt: new Date().toISOString() })
            .where(inArray(taskTable.id, taskIds))
            .returning({ id: taskTable.id });
        const result = { count: updatedRows.length };

        // 🔔 Notify the editor once with a grouped list of all reassigned tasks
        if (reassignedTaskIds.length > 0) {
            try {
                await notifyEditorTaskAssignment(updateData.assignedTo, reassignedTaskIds);
            } catch (err) {
                console.error('Failed to send bulk assignment notification:', err);
            }
        }

        // 🔥 Audit bulk update
        const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
        await createAuditLog({
            action: AuditAction.TASK_UPDATED,
            entity: 'Task',
            entityId: 'multiple',
            details: `Bulk updated ${result.count} tasks with fields: ${Object.keys(updateData).join(', ')}`,
            metadata: {
                taskIds,
                updates: updateData,
                count: result.count
            }
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