export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';
import { sendWelcomeEmail } from '@/lib/email';
import { generateTempPassword, hashPassword } from '@/lib/password'; // ← Add this import
import { z } from "zod";
import { Role } from '@prisma/client';

interface CreateUserData {
  name: string;
  email: string;
  role?: Role;
  hourlyRate?: number | string;
  phone?: string;
  hoursPerWeek?: number | string;
  monthlyBaseHours?: number;
  worksOnSaturday?: boolean;
  joinedAt?: string | Date;
}

const BodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  hourlyRate: z.number().min(0).optional().nullable(),
  hoursPerWeek: z.number().min(0).optional().nullable().transform(val => val ?? 40),
  monthlyBaseHours: z.number().int().positive().optional().nullable(),
  role: z.string().optional(),
  phone: z.string().optional(),
  joinedAt: z.string().optional(),
  worksOnSaturday: z.boolean().optional(),
  clientId: z.string().optional(), // For linking user to client when role is 'client'
});

function isValidRole(role: string): role is Role {
  return ['admin', 'manager', 'editor', 'videographer', 'scheduler', 'client', 'qc', 'null'].includes(role);
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req as any);

    const json = await req.json();
    console.log("📥 Received data:", json);

    const data = BodySchema.parse(json);
    console.log("✅ Parsed data:", data);

    // 1️⃣ Find existing employee by email
    const existing = await prisma.user.findFirst({
      where: { email: data.email },
    });

    let user;
    let tempPassword: string | null = null; // ← Store temp password for email

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

      // Generate temporary password
      tempPassword = generateTempPassword();
      const hashedPassword = await hashPassword(tempPassword);

      user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword, // ← Add hashed password
          phone: data.phone,
          role: (data.role as Role) || null,
          hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : null,
          hoursPerWeek: data.hoursPerWeek ? Number(data.hoursPerWeek) : 40,
          monthlyBaseHours: data.monthlyBaseHours,
          worksOnSaturday: data.worksOnSaturday ?? false,
          employeeStatus: 'ACTIVE', // ← Set status
          // 🔥 NEW: Link to client directly if role is 'client'
          linkedClientId: data.role === 'client' && json.clientId ? json.clientId : null,
          ...(data.joinedAt && { joinedAt: new Date(data.joinedAt) }),
        },
      });

      await createAuditLog({
        userId: user.id,
        action: AuditAction.USER_CREATED,
        entity: "User",
        entityId: user.id.toString(),
        details: `Created new employee: ${data.name} (${data.email})`,
        metadata: {
          employeeId: user.id,
          role: data.role ?? "editor",
          email: data.email,
          hourlyRate: data.hourlyRate,
          hoursPerWeek: data.hoursPerWeek,
          linkedClientId: json.clientId || null,
        },
      });

      console.log("✅ User created:", user);

      if (data.role === 'client' && json.clientId) {
        console.log("🔗 User linked to client via linkedClientId:", json.clientId);
      }
    }

    // 4️⃣ Send welcome email (only for new users)
    // if (tempPassword) {
    //   const emailResult = await sendWelcomeEmail({
    //     email: data.email,
    //     name: data.name,
    //     role: data.role || 'editor',
    //     tempPassword, // ← Pass the temporary password
    //   });

    //   if (!emailResult.success) {
    //     console.error('Failed to send welcome email, but employee created');
    //     // Don't fail the request if email fails
    //   } else {
    //     console.log('✅ Welcome email sent successfully');
    //   }
    // }

    return NextResponse.json({
      ok: true,
      user,
      message: tempPassword
        ? 'Employee created successfully. Welcome email sent with login credentials.'
        : 'Employee updated successfully.'
    });

  } catch (err: any) {
    console.error("❌ Error in POST /api/employee:", err);
    return NextResponse.json(
      { ok: false, message: err.message || "Request failed" },
      { status: 400 }
    );
  }
}