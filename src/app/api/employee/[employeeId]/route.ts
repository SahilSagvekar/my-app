import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

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
  hourlyRate: z.number().positive().optional(), // Added back hourlyRate
  monthlyBaseHours: z.number().int().positive().optional(),
  employeeStatus: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
  joinedAt: z.string().optional(),
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

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: payload.name ?? undefined,
        email: payload.email ?? undefined,
        role: payload.role ?? undefined,
        hourlyRate: payload.hourlyRate ?? undefined,
        monthlyBaseHours: payload.monthlyBaseHours ?? undefined,
        employeeStatus: payload.employeeStatus ?? undefined,
        joinedAt: payload.joinedAt ? new Date(payload.joinedAt) : undefined,
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
