export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task, user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// 🔥 Role-switch support — mirrors src/app/api/tasks/route.ts and
// src/app/api/tasks/qc-completed/route.ts. A multi-role account (e.g.
// Daena: editor + scheduler + qc) previewing the QC tab needs this endpoint
// to honor x-viewing-as instead of only checking their primary role, which
// otherwise 403s here for anyone whose primary role isn't already
// qc/admin/manager.
const LEGACY_ROLE_SWITCH_EMAILS = new Set([
  'eric@e8productions.com',
  'sahilsagvekar230@gmail.com',
]);
const DEFAULT_ADMIN_SWITCH_ROLES = ['qc', 'sales', 'sales_manager', 'scheduler'];

function resolveEffectiveRole(
  role: string | null | undefined,
  roles: string[] | null | undefined,
  email: string | null | undefined,
  viewingAs: string | null
): string | null | undefined {
  const baseRole = role?.toLowerCase() || null;
  if (!viewingAs || viewingAs === baseRole) return role;

  const authorizedSwitchRoles = new Set<string>([
    ...(Array.isArray(roles) ? roles.map((r) => r.toLowerCase()) : []),
    ...(email && LEGACY_ROLE_SWITCH_EMAILS.has(email.toLowerCase())
      ? DEFAULT_ADMIN_SWITCH_ROLES
      : []),
    ...(baseRole === 'admin' ? DEFAULT_ADMIN_SWITCH_ROLES : []),
  ]);

  if (!authorizedSwitchRoles.has(viewingAs)) return role;

  // Viewing as QC is treated as admin-level access, same as tasks/route.ts
  // and qc-completed/route.ts, so the viewer can reassign any QC task
  // rather than only ones assigned to them.
  return viewingAs === 'qc' ? 'admin' : viewingAs;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = getDbHttp();
  try {
    const { id } = params;

    const user = await getCurrentUser2(req as any);
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const viewingAs = (req as any).headers?.get?.('x-viewing-as')?.toLowerCase() || null;
    const role = resolveEffectiveRole(
      user.role,
      (user as any).roles,
      user.email,
      viewingAs
    )?.toLowerCase();

    if (!['qc', 'admin', 'manager'].includes(role || '')) {
      return NextResponse.json({ message: 'Forbidden — QC, Admin, or Manager only' }, { status: 403 });
    }

    const body = await req.json();
    const { newQcSpecialistId } = body;

    if (!newQcSpecialistId) {
      return NextResponse.json({ message: 'newQcSpecialistId is required' }, { status: 400 });
    }

    // Verify the target user exists and is a QC specialist
    const [targetUser] = await db.select({ id: userTable.id, name: userTable.name, role: userTable.role, employeeStatus: userTable.employeeStatus })
      .from(userTable).where(eq(userTable.id, Number(newQcSpecialistId))).limit(1);

    if (!targetUser) {
      return NextResponse.json({ message: 'Target user not found' }, { status: 404 });
    }

    if (targetUser.role?.toLowerCase() !== 'qc') {
      return NextResponse.json({ message: 'Target user is not a QC specialist' }, { status: 400 });
    }

    if (targetUser.employeeStatus !== 'ACTIVE') {
      return NextResponse.json({ message: 'Target QC specialist is not active' }, { status: 400 });
    }

    // Verify the task exists and is in a QC-relevant status
    const [foundTask] = await db.select({ id: task.id, title: task.title, status: task.status, qcSpecialist: task.qcSpecialist })
      .from(task).where(eq(task.id, id)).limit(1);

    if (!foundTask) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    // If QC role (not admin/manager), ensure they are the current qc_specialist
    if (role === 'qc' && foundTask.qcSpecialist !== user.id) {
      return NextResponse.json(
        { message: 'You can only reassign tasks assigned to you' },
        { status: 403 }
      );
    }

    const [updated] = await db.update(task).set({
      qcSpecialist: Number(newQcSpecialistId),
      updatedAt: new Date().toISOString(),
    }).where(eq(task.id, id)).returning({
      id: task.id,
      title: task.title,
      status: task.status,
      qcSpecialist: task.qcSpecialist,
    });

    return NextResponse.json({
      message: `Task reassigned to ${targetUser.name}`,
      task: updated,
    });
  } catch (err: any) {
    console.error('❌ QC reassign error:', err.message);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}