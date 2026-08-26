export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { user, task } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

// Bulk version of deactivate-with-reassign, but sets employeeStatus to
// TERMINATED instead of INACTIVE. TERMINATED is treated as a hard-delete
// substitute — /api/employee/list excludes it by default, so terminated
// people disappear from pickers/dropdowns app-wide without breaking the
// 35+ foreign keys that reference user.id (most of which are RESTRICT
// constraints — an actual DELETE would fail for anyone with real history).
//
// For each employee id:
//   - No active tasks (PENDING/IN_PROGRESS/REJECTED/READY_FOR_QC)  -> terminate immediately
//   - Has active tasks, reassignAllTo given                        -> reassign all to that user, then terminate
//   - Has active tasks, no reassignAllTo given                     -> skip, report back for the caller to handle
const ACTIVE_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'REJECTED', 'READY_FOR_QC'];

export async function POST(req: Request) {
  const { db, closeDb } = getDbPool();
  try {
    await requireAdmin(req as any);

    const body = await req.json();
    const employeeIds: number[] = Array.isArray(body.employeeIds)
      ? body.employeeIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
      : [];
    const reassignAllTo: number | null = body.reassignAllTo ? Number(body.reassignAllTo) : null;

    if (employeeIds.length === 0) {
      return NextResponse.json({ ok: false, message: 'employeeIds is required' }, { status: 400 });
    }

    // If a fallback assignee was given, confirm they're real, active, and
    // not one of the people being terminated in this same batch.
    if (reassignAllTo) {
      const [target] = await db.select({ id: user.id, employeeStatus: user.employeeStatus })
        .from(user).where(eq(user.id, reassignAllTo)).limit(1);
      if (!target || target.employeeStatus !== 'ACTIVE') {
        return NextResponse.json({ ok: false, message: 'Reassignment target is not an active user' }, { status: 400 });
      }
      if (employeeIds.includes(reassignAllTo)) {
        return NextResponse.json({ ok: false, message: 'Reassignment target cannot be one of the people being terminated' }, { status: 400 });
      }
    }

    const targets = await db.select({ id: user.id, name: user.name, employeeStatus: user.employeeStatus })
      .from(user).where(inArray(user.id, employeeIds));

    const terminated: { id: number; name: string | null }[] = [];
    const alreadyTerminated: { id: number; name: string | null }[] = [];
    const needsReassignment: { id: number; name: string | null; activeTaskCount: number }[] = [];

    const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');

    for (const t of targets) {
      if (t.employeeStatus === 'TERMINATED') {
        alreadyTerminated.push({ id: t.id, name: t.name });
        continue;
      }

      const activeTasks = await db.select({ id: task.id })
        .from(task).where(and(eq(task.assignedTo, t.id), inArray(task.status, ACTIVE_TASK_STATUSES as any)));

      if (activeTasks.length > 0 && !reassignAllTo) {
        needsReassignment.push({ id: t.id, name: t.name, activeTaskCount: activeTasks.length });
        continue;
      }

      await db.transaction(async (tx) => {
        if (activeTasks.length > 0 && reassignAllTo) {
          await tx.update(task).set({
            assignedTo: reassignAllTo,
            updatedAt: new Date().toISOString(),
          }).where(inArray(task.id, activeTasks.map(at => at.id)));
        }

        await tx.update(user).set({
          employeeStatus: 'TERMINATED',
          updatedAt: new Date().toISOString(),
        }).where(eq(user.id, t.id));
      });

      try {
        await createAuditLog({
          userId: t.id,
          action: AuditAction.USER_UPDATED,
          entity: 'User',
          entityId: t.id,
          details: `User account terminated by admin (bulk action). ${activeTasks.length} active task(s) ${activeTasks.length > 0 ? `reassigned to user ${reassignAllTo}` : ''}.`,
          metadata: {
            userId: t.id,
            newStatus: 'TERMINATED',
            reassignedTaskCount: activeTasks.length,
            reassignedTo: activeTasks.length > 0 ? reassignAllTo : null,
          },
        });
      } catch (auditErr) {
        console.error('Audit log failed (non-critical):', auditErr);
      }

      terminated.push({ id: t.id, name: t.name });
    }

    return NextResponse.json({
      ok: true,
      terminated,
      alreadyTerminated,
      needsReassignment,
    });
  } catch (err: any) {
    console.error('Error in bulk-terminate:', err);
    return NextResponse.json({ ok: false, message: err?.message || 'error' }, { status: 500 });
  } finally {
    await closeDb();
  }
}