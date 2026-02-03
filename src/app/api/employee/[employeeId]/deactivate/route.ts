// app/api/employee/[id]/deactivate/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: { employeeId: string } }) {
  try {
    await requireAdmin(req as any);
    const id = Number(params.employeeId);
    const user = await prisma.user.update({
      where: { id },
      data: { employeeStatus: 'INACTIVE' }
    });

    const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
    await createAuditLog({
      userId: id,
      action: AuditAction.USER_UPDATED,
      entity: 'User',
      entityId: id,
      details: `User account deactivated by admin`,
      metadata: { userId: id, newStatus: 'INACTIVE' }
    });

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, message: err?.message || 'error' }, { status: 400 });
  }
}

