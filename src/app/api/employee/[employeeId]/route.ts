// app/api/employee/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';

const PatchSchema = z.object({
  hourlyRate: z.number().positive().optional(),
  monthlyBaseHours: z.number().int().positive().optional(),
  employeeStatus: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function PATCH(req: Request, context: { params: { employeeId: string } }) {
  try {
    await requireAdmin(req as any);
    const payload = PatchSchema.parse(await req.json());
    const { params } = await Promise.resolve(context);
    const id = Number(params.employeeId);

    const user = await prisma.user.update({
      where: { id },
      data: {
        hourlyRate: payload.hourlyRate ?? undefined,
        monthlyBaseHours: payload.monthlyBaseHours ?? undefined,
        employeeStatus: payload.employeeStatus ?? undefined,
      },
    });

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error(err);
    const status = err?.status || 400;
    const msg = err?.message || 'Bad request';
    return NextResponse.json({ ok: false, message: msg }, { status });
  }
}
