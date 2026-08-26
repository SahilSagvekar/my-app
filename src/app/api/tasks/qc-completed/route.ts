export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task } from '@/lib/db/schema';
import { and, or, eq, ilike, inArray, desc, count, type SQL } from 'drizzle-orm';

const QC_COMPLETED_STATUSES = ['COMPLETED', 'REJECTED_BY_QC', 'REJECTED_BY_CLIENT', 'CLIENT_REVIEW'] as const;
type QcCompletedStatus = (typeof QC_COMPLETED_STATUSES)[number];

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function buildBaseWhere(
  role: string | null | undefined,
  userId: number
): SQL | null {
  const normalizedRole = role?.toLowerCase();

  if (normalizedRole === 'qc') {
    return and(
      eq(task.qcSpecialist, userId),
      inArray(task.status, [...QC_COMPLETED_STATUSES] as any)
    )!;
  }

  if (normalizedRole === 'admin' || normalizedRole === 'manager') {
    return inArray(task.status, [...QC_COMPLETED_STATUSES] as any);
  }

  return null;
}

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

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const requestedLimit = parsePositiveInt(searchParams.get('limit'), DEFAULT_LIMIT);
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim() || '';

    const conditions: SQL[] = [baseWhere];

    if (status && status !== 'all') {
      const normalizedStatus = status.toUpperCase();
      // Legacy "REJECTED" filter matches both new rejection statuses
      if (normalizedStatus === 'REJECTED') {
        conditions.push(inArray(task.status, ['REJECTED_BY_QC', 'REJECTED_BY_CLIENT'] as any));
      } else if (!QC_COMPLETED_STATUSES.includes(normalizedStatus as QcCompletedStatus)) {
        return NextResponse.json(
          { success: false, error: `Invalid status: ${status}` },
          { status: 400 }
        );
      } else {
        conditions.push(eq(task.status, normalizedStatus as any));
      }
    }

    // Verify the task exists and is in a QC-relevant status
    const [foundTask] = await db.select({ id: task.id, title: task.title, status: task.status, qcSpecialist: task.qcSpecialist })
      .from(task).where(eq(task.id, id)).limit(1);

    if (!foundTask) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    const where = and(...conditions)!;

    const [[{ value: total }], rawTasks, [{ value: totalReviewed }], [{ value: approvedCount }], [{ value: rejectedCount }]] = await Promise.all([
      db.select({ value: count() }).from(task).where(where),
      db.query.task.findMany({
        where,
        orderBy: [desc(task.updatedAt), desc(task.qcReviewedAt), desc(task.createdAt)],
        offset: (page - 1) * limit,
        limit,
        columns: {
          id: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
          dueDate: true,
          clientId: true,
          taskCategory: true,
          nextDestination: true,
          qcNotes: true,
          feedback: true,
          priority: true,
          qcResult: true,
          qcReviewedAt: true,
        },
        with: {
          user_qcReviewedBy: {
            columns: { id: true, name: true },
          },
        },
      }),
      db.select({ value: count() }).from(task).where(baseWhere),
      db.select({ value: count() }).from(task).where(and(baseWhere, eq(task.status, 'COMPLETED'))!),
      db.select({ value: count() }).from(task).where(and(baseWhere, inArray(task.status, ['REJECTED_BY_QC', 'REJECTED_BY_CLIENT']))!),
    ]);

    const tasks = rawTasks.map(({ user_qcReviewedBy, ...t }: any) => ({ ...t, qcReviewer: user_qcReviewedBy }));

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      message: `Task reassigned to ${targetUser.name}`,
      task: updated,
    });
  } catch (err: any) {
    console.error('❌ QC reassign error:', err.message);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}