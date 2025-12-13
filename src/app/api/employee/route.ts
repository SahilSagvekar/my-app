import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';
import { z } from "zod";

const BodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  hourlyRate: z.number().min(0).optional(),
  monthlyBaseHours: z.number().int().positive().optional(),
  role: z.string().optional(), // string because you don’t want enum errors
});

export async function POST(req: Request) {
  try {
    await requireAdmin(req as any);

    const json = await req.json();
    const data = BodySchema.parse(json);

    // 1️⃣ Find existing employee by email (not unique, so findFirst only)
    const existing = await prisma.user.findFirst({
      where: { email: data.email },
    });

    let user;

    if (existing) {
      // 2️⃣ Update existing
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          // role: data.role ?? existing.role,
          hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : existing.hourlyRate,
          monthlyBaseHours: data.monthlyBaseHours ?? existing.monthlyBaseHours,
        },
      });

      // app/api/admin/employees/route.ts (POST method)

      await createAuditLog({
        userId: existing.id,
        action: AuditAction.USER_UPDATED,
        entity: "User",
        entityId: existing.id.toString(),
        details: `Updated employee: ${existing.name} (${existing.email})`,
        metadata: {
          employeeId: existing.id,
          role: existing.role,
          email: existing.email,
        },
        // ipAddress,
        // userAgent,
      });

    } else {
      // 3️⃣ Create new
      user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          // role: data.role ?? "manager",
          hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : undefined,
          monthlyBaseHours: data.monthlyBaseHours,
        },
      });

      await createAuditLog({
        // userId: existing.id,
        action: AuditAction.USER_UPDATED,
        entity: "User",
        // entityId: existing.id.toString(),
        details: `Updated employee: ${data.name} (${data.email})`,
        metadata: {
          // employeeId: data.id,
          role: data.role,
          email: data.email,
        },
        // ipAddress,
        // userAgent,
      });
    }

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: err.message || "Request failed" },
      { status: 400 }
    );
  }
}
