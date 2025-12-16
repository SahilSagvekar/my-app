import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';
import { z } from "zod";

const BodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  hourlyRate: z.number().min(0).optional().nullable(),
  hoursPerWeek: z.number().min(0).optional().nullable().transform(val => val ?? 40), // Default to 40
  monthlyBaseHours: z.number().int().positive().optional().nullable(),
  role: z.string().optional(),
  joinedAt: z.string().optional(), // Add this
  worksOnSaturday: z.boolean().optional(), // Add this
});

export async function POST(req: Request) {
  try {
    await requireAdmin(req as any);

    const json = await req.json();
    console.log("📥 Received data:", json); // Debug log
    
    const data = BodySchema.parse(json);
    console.log("✅ Parsed data:", data); // Debug log

    // 1️⃣ Find existing employee by email
    const existing = await prisma.user.findFirst({
      where: { email: data.email },
    });

    let user;

    if (existing) {
      // 2️⃣ Update existing employee
      console.log("🔄 Updating existing user:", existing.id);
      
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : existing.hourlyRate,
          hoursPerWeek: data.hoursPerWeek ? Number(data.hoursPerWeek) : existing.hoursPerWeek,
          monthlyBaseHours: data.monthlyBaseHours ?? existing.monthlyBaseHours,
          worksOnSaturday: data.worksOnSaturday ?? existing.worksOnSaturday,
          ...(data.joinedAt && { joinedAt: new Date(data.joinedAt) }),
        },
      });

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
          hourlyRate: data.hourlyRate,
          hoursPerWeek: data.hoursPerWeek,
        },
      });

      console.log("✅ User updated:", user);

    } else {
      // 3️⃣ Create new employee
      console.log("➕ Creating new user");
      
      user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          role: data.role ?? "editor",
          hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : null,
          hoursPerWeek: data.hoursPerWeek ? Number(data.hoursPerWeek) : 40, // Default 40
          monthlyBaseHours: data.monthlyBaseHours,
          worksOnSaturday: data.worksOnSaturday ?? false,
          ...(data.joinedAt && { joinedAt: new Date(data.joinedAt) }),
        },
      });

      await createAuditLog({
        userId: user.id,
        action: AuditAction.USER_CREATED, // ✅ Fixed: was USER_UPDATED
        entity: "User",
        entityId: user.id.toString(),
        details: `Created new employee: ${data.name} (${data.email})`,
        metadata: {
          employeeId: user.id,
          role: data.role ?? "editor",
          email: data.email,
          hourlyRate: data.hourlyRate,
          hoursPerWeek: data.hoursPerWeek,
        },
      });

      console.log("✅ User created:", user);
    }

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error("❌ Error in POST /api/employee:", err);
    return NextResponse.json(
      { ok: false, message: err.message || "Request failed" },
      { status: 400 }
    );
  }
}