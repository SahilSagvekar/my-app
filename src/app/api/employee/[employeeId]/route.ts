import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';


const PatchSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z
    .enum([
      "admin",
      "manager",
      "editor",
      "videographer",
      "qc",
      "scheduler",
      "client",
    ])
    .optional(), // Changed 'qc_specialist' to 'qc'
  hourlyRate: z.number().min(0).optional(), // Added back hourlyRate
  hoursPerWeek: z.number().min(0).optional(),
  monthlyBaseHours: z.number().int().positive().optional(),
  employeeStatus: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
  joinedAt: z.string().optional(),
  monthlyRate: z.number().optional(),
  phone: z.string().optional(),
});

export async function PATCH(
  req: Request,
  context: { params: { employeeId: string } }
) {
  try {
    await requireAdmin(req as any);
    const body = await req.json();

    // Filter out undefined/null values before validation
    const cleanedBody = Object.fromEntries(
      Object.entries(body).filter(
        ([_, v]) => v !== undefined && v !== null && v !== ""
      )
    );

    const payload = PatchSchema.parse(cleanedBody);
    // const { params } = await Promise.resolve(context);
    const params = await context.params;
    const id = Number(params.employeeId);

    console.log("Updating employee with ID:", id, "Payload:", payload.hoursPerWeek);

    // Sanitize phone - treat "N/A", empty strings, etc. as null
    let sanitizedPhone: string | null | undefined = undefined;
    if (payload.phone !== undefined) {
      const phoneValue = payload.phone.trim().toLowerCase();
      if (phoneValue === "" || phoneValue === "n/a" || phoneValue === "na" || phoneValue === "none") {
        sanitizedPhone = null;
      } else {
        sanitizedPhone = payload.phone;
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: payload.name ?? undefined,
        email: payload.email ?? undefined,
        role: payload.role ?? undefined,
        phone: sanitizedPhone,
        hourlyRate: payload.hourlyRate ?? undefined,
        hoursPerWeek: Number(payload.hoursPerWeek) ?? undefined,
        monthlyRate: Number(payload.monthlyRate) ?? undefined,
        monthlyBaseHours: payload.monthlyBaseHours ?? undefined,
        employeeStatus: payload.employeeStatus ?? undefined,
        joinedAt: payload.joinedAt ? new Date(payload.joinedAt) : undefined,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: AuditAction.USER_UPDATED,
      entity: "User",
      entityId: user.id.toString(),
      details: `Updated employee: ${user.name}`,
      metadata: {
        changes: payload,
      },
    });

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error(err);
    const status = err?.status || 400;
    const msg = err?.message || "Bad request";
    return NextResponse.json({ ok: false, message: msg }, { status });
  }
}
