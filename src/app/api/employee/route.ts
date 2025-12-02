// app/api/employee/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';

const BodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  hourlyRate: z.string().optional(), // accept string for Decimal safely
  monthlyBaseHours: z.number().int().positive().optional(),
  role: z.nativeEnum(require('../../../../prisma/generated/role') as any).optional(), // (optional) if you have a generated enum
});

export async function POST(req: Request) {
  try {
    // require admin
    // @ts-ignore - NextRequest vs Request: for App Router, runtime(Request) works
    await requireAdmin(req as any);

    const json = await req.json();
    const data = BodySchema.parse(json);

    // Upsert user by email
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {
        name: data.name,
        role: data.role ?? 'manager', // default non-client role if creating employee
        hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : undefined,
        monthlyBaseHours: data.monthlyBaseHours ?? undefined,
      },
      create: {
        name: data.name,
        email: data.email,
        role: data.role ?? 'manager',
        hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : undefined,
        monthlyBaseHours: data.monthlyBaseHours ?? undefined,
      }
    });

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error(err);
    const status = err?.status || 400;
    const message = err?.message || err?.toString?.() || 'Bad request';
    return NextResponse.json({ ok: false, message }, { status });
  }
}
