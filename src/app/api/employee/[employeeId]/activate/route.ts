// app/api/employee/[id]/activate/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function PATCH(req: Request, context: { params: { id: string } }) {
  try {
    await requireAdmin(req as any);
    const { params } = await Promise.resolve(context);
    const id = Number(params.id);
    const user = await prisma.user.update({
      where: { id },
      data: { employeeStatus: 'ACTIVE' }
    });
    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, message: err?.message || 'error' }, { status: 400 });
  }
}
