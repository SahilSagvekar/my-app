export const dynamic = 'force-dynamic';
// app/api/employee/[id]/activate/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

export async function PATCH(req: Request, context: { params: { employeeId: string } }) {
  const { db, closeDb } = getDb();
  try {
  try {
    await requireAdmin(req as any);
    const { params } = await Promise.resolve(context);
    const id = Number(params.employeeId);
    const [user] = await db.update(userTable).set({
      employeeStatus: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    }).where(eq(userTable.id, id)).returning();

    const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
    await createAuditLog({
      userId: id,
      action: AuditAction.USER_UPDATED,
      entity: 'User',
      entityId: id,
      details: `User account activated by admin`,
      metadata: { userId: id, newStatus: 'ACTIVE' }
    });

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, message: err?.message || 'error' }, { status: 400 });
  }

  } finally {
    await closeDb();
  }
}
