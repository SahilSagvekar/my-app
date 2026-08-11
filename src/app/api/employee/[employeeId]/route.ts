export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';
import { sendRoleAssignedEmail } from '@/lib/email';


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
      "sales",
      "sales_manager",
    ])
    .optional(), // Changed 'qc_specialist' to 'qc'
  hourlyRate: z.number().min(0).optional(), // Added back hourlyRate
  hoursPerWeek: z.number().min(0).optional(),
  monthlyBaseHours: z.number().int().positive().optional(),
  employeeStatus: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
  joinedAt: z.string().optional(),
  monthlyRate: z.number().optional(),
  phone: z.string().optional(),
  clientId: z.string().optional(), // For linking user to client when role is 'client'
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

    // Grab the pre-update role so we only email when it actually changes —
    // PATCH is also used for unrelated edits (rate, hours, status, etc.)
    // that shouldn't trigger a "your role changed" notification.
    const [existingUser] = await db.select({ role: user.role }).from(user).where(eq(user.id, id)).limit(1);

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

    const [updatedUser] = await db.update(user).set({
      name: payload.name ?? undefined,
      email: payload.email ?? undefined,
      role: payload.role ?? undefined,
      phone: sanitizedPhone,
      hourlyRate: payload.hourlyRate !== undefined ? String(payload.hourlyRate) : undefined,
      hoursPerWeek: payload.hoursPerWeek !== undefined ? String(Number(payload.hoursPerWeek)) : undefined,
      monthlyRate: Number(payload.monthlyRate) ?? undefined,
      monthlyBaseHours: payload.monthlyBaseHours ?? undefined,
      employeeStatus: payload.employeeStatus ?? undefined,
      joinedAt: payload.joinedAt ? new Date(payload.joinedAt).toISOString() : undefined,
      // 🔥 Handle client linking directly on User
      linkedClientId: payload.role === 'client' && body.clientId
        ? body.clientId
        : (payload.role && payload.role !== 'client' ? null : undefined),
      updatedAt: new Date().toISOString(),
    }).where(eq(user.id, id)).returning();

    // Log the change
    if (payload.role === 'client' && body.clientId) {
      console.log("🔗 User linked to client via linkedClientId:", body.clientId);
    } else if (payload.role && payload.role !== 'client') {
      console.log("🔓 User unlinked from client (role changed)");
    }

    await createAuditLog({
      userId: updatedUser.id,
      action: AuditAction.USER_UPDATED,
      entity: "User",
      entityId: updatedUser.id.toString(),
      details: `Updated employee: ${updatedUser.name}`,
      metadata: {
        changes: payload,
        linkedClientId: body.clientId || null,
      },
    });

    // Notify the user by email when their role actually changed — admins no
    // longer need to tell people manually after assigning a new role.
    const roleChanged = !!payload.role && payload.role !== existingUser?.role;
    if (roleChanged && updatedUser.email) {
      sendRoleAssignedEmail({
        email: updatedUser.email,
        name: updatedUser.name || 'there',
        newRole: payload.role!,
        previousRole: existingUser?.role ?? null,
      }).catch((err) => {
        // Don't fail the role-update request just because the email failed
        console.error('❌ Failed to send role assignment email:', err);
      });
    }

    return NextResponse.json({ ok: true, user: updatedUser });
  } catch (err: any) {
    console.error(err);
    const status = err?.status || 400;
    const msg = err?.message || "Bad request";
    return NextResponse.json({ ok: false, message: msg }, { status });
  }
}