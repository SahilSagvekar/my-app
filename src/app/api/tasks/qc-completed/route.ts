export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser2 } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { task } from '@/lib/db/schema';
import { and, or, eq, ilike, inArray, desc, count, type SQL } from 'drizzle-orm';

const QC_COMPLETED_STATUSES = ['COMPLETED', 'REJECTED', 'CLIENT_REVIEW'] as const;
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

// 🔥 Role-switch support — mirrors src/app/api/tasks/route.ts. A multi-role
// account (e.g. Daena: editor + scheduler + qc) previewing the QC tab needs
// this endpoint to honor x-viewing-as instead of only checking their primary
// role, which otherwise 403s here for anyone whose primary role isn't
// already qc/admin/manager.
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

  // Viewing as QC is treated as admin-level access, same as tasks/route.ts,
  // so the viewer sees ALL completed QC tasks rather than just their own.
  return viewingAs === 'qc' ? 'admin' : viewingAs;
}

export async function GET(request: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const viewingAs = request.headers.get('x-viewing-as')?.toLowerCase() || null;
    const effectiveRole = resolveEffectiveRole(
      user.role,
      (user as any).roles,
      user.email,
      viewingAs
    );

    const baseWhere = buildBaseWhere(effectiveRole, Number(user.id));
    if (!baseWhere) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
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
      if (!QC_COMPLETED_STATUSES.includes(normalizedStatus as QcCompletedStatus)) {
        return NextResponse.json(
          { success: false, error: `Invalid status: ${status}` },
          { status: 400 }
        );
      }

      conditions.push(eq(task.status, normalizedStatus as any));
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(or(
        ilike(task.title, pattern),
        ilike(task.clientId, pattern),
        ilike(task.description, pattern),
      )!);
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
      db.select({ value: count() }).from(task).where(and(baseWhere, eq(task.status, 'REJECTED'))!),
    ]);

    const tasks = rawTasks.map(({ user_qcReviewedBy, ...t }: any) => ({ ...t, qcReviewer: user_qcReviewedBy }));

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats: {
        totalReviewed,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    console.error('[QC COMPLETED] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch completed tasks' },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}