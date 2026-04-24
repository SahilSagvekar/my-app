export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: { employeeId: string } }) {
  try {
    const adminUser = await requireAdmin(req as any);
    const resolvedParams = await Promise.resolve(params);
    const id = Number(resolvedParams.employeeId);
    const body = await req.json();

    const { reassignments, reassignAllTo } = body;
    // reassignments: [{ taskId: string, newAssigneeId: number }]
    // reassignAllTo: number (assign all tasks to this single user)

    if (!reassignments && !reassignAllTo) {
      return NextResponse.json(
        { ok: false, message: 'Provide either reassignments array or reassignAllTo' },
        { status: 400 }
      );
    }

    // Get user being deactivated
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, employeeStatus: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: 'User not found' }, { status: 404 });
    }

    // Active statuses
    const activeStatuses = ['PENDING', 'IN_PROGRESS', 'REJECTED', 'READY_FOR_QC'];

    // Get all active tasks for this user
    const activeTasks = await prisma.task.findMany({
      where: {
        assignedTo: id,
        status: { in: activeStatuses },
      },
      select: { id: true, title: true, status: true },
    });

    if (activeTasks.length === 0) {
      // No active tasks — just deactivate
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { employeeStatus: 'INACTIVE' },
      });

      const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
      await createAuditLog({
        userId: id,
        action: AuditAction.USER_UPDATED,
        entity: 'User',
        entityId: id,
        details: `User account deactivated by admin (no active tasks)`,
        metadata: { userId: id, newStatus: 'INACTIVE' },
      });

      return NextResponse.json({ ok: true, user: updatedUser, reassignedCount: 0 });
    }

    // Build reassignment map
    let taskReassignments: { taskId: string; newAssigneeId: number }[] = [];

    if (reassignAllTo) {
      // Validate the target user exists and is active
      const targetUser = await prisma.user.findUnique({
        where: { id: Number(reassignAllTo) },
        select: { id: true, name: true, employeeStatus: true },
      });

      if (!targetUser || targetUser.employeeStatus !== 'ACTIVE') {
        return NextResponse.json(
          { ok: false, message: 'Target user is not active' },
          { status: 400 }
        );
      }

      taskReassignments = activeTasks.map(t => ({
        taskId: t.id,
        newAssigneeId: Number(reassignAllTo),
      }));
    } else if (reassignments && Array.isArray(reassignments)) {
      // Validate all task IDs belong to the deactivated user's active tasks
      const activeTaskIds = new Set(activeTasks.map(t => t.id));
      for (const r of reassignments) {
        if (!activeTaskIds.has(r.taskId)) {
          return NextResponse.json(
            { ok: false, message: `Task ${r.taskId} is not an active task for this user` },
            { status: 400 }
          );
        }
      }

      // Validate all new assignees exist and are active
      const assigneeIds = [...new Set(reassignments.map((r: any) => Number(r.newAssigneeId)))];
      const assignees = await prisma.user.findMany({
        where: { id: { in: assigneeIds }, employeeStatus: 'ACTIVE' },
        select: { id: true },
      });
      const activeAssigneeIds = new Set(assignees.map(a => a.id));

      for (const r of reassignments) {
        if (!activeAssigneeIds.has(Number(r.newAssigneeId))) {
          return NextResponse.json(
            { ok: false, message: `Assignee ${r.newAssigneeId} is not active` },
            { status: 400 }
          );
        }
      }

      taskReassignments = reassignments.map((r: any) => ({
        taskId: r.taskId,
        newAssigneeId: Number(r.newAssigneeId),
      }));

      // Check all active tasks are covered
      const reassignedTaskIds = new Set(taskReassignments.map(r => r.taskId));
      const unassigned = activeTasks.filter(t => !reassignedTaskIds.has(t.id));
      if (unassigned.length > 0) {
        return NextResponse.json(
          { ok: false, message: `${unassigned.length} task(s) not assigned to anyone` },
          { status: 400 }
        );
      }
    }

    // Execute in transaction: reassign all tasks + deactivate user
    // Group tasks by new assignee for bulk updates (avoid timeout)
    const tasksByAssignee = new Map<number, string[]>();
    for (const r of taskReassignments) {
      const existing = tasksByAssignee.get(r.newAssigneeId) || [];
      existing.push(r.taskId);
      tasksByAssignee.set(r.newAssigneeId, existing);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Bulk reassign per assignee (1 query per unique assignee instead of 1 per task)
      for (const [assigneeId, taskIds] of tasksByAssignee) {
        await tx.task.updateMany({
          where: { id: { in: taskIds } },
          data: { assignedTo: assigneeId },
        });
      }

      // Deactivate user
      const updatedUser = await tx.user.update({
        where: { id },
        data: { employeeStatus: 'INACTIVE' },
      });

      return updatedUser;
    });

    // Audit log (outside transaction — non-critical)
    try {
      const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');

      // Log deactivation
      await createAuditLog({
        userId: id,
        action: AuditAction.USER_UPDATED,
        entity: 'User',
        entityId: id,
        details: `User account deactivated by admin. ${taskReassignments.length} task(s) reassigned.`,
        metadata: {
          userId: id,
          newStatus: 'INACTIVE',
          reassignedTasks: taskReassignments.length,
          reassignments: taskReassignments.map(r => ({
            taskId: r.taskId,
            newAssigneeId: r.newAssigneeId,
          })),
        },
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-critical):', auditErr);
    }

    return NextResponse.json({
      ok: true,
      user: result,
      reassignedCount: taskReassignments.length,
    });
  } catch (err: any) {
    console.error('Error in deactivate-with-reassign:', err);
    return NextResponse.json({ ok: false, message: err?.message || 'error' }, { status: 500 });
  }
}