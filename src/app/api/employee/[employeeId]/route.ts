import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { 
  notifyRoleChanged, 
  notifyEmployeeStatusChanged 
} from '@/lib/notificationTriggers';

const PatchSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'manager', 'editor', 'videographer', 'qc_specialist', 'scheduler', 'client', 'qc']).optional(),
  hourlyRate: z.number().positive().optional(),
  monthlyBaseHours: z.number().int().positive().optional(),
  employeeStatus: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(),
  joinedAt: z.string().optional(),
});
  
export async function PATCH(req: Request, context: { params: { employeeId: string } }) {
  try {
    await requireAdmin(req as any);
    
    // Get current admin info for notifications
    const token = req.headers.get("cookie")?.match(/authToken=([^;]+)/)?.[1];
    let adminName = 'Admin';
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const admin = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { name: true }
        });
        adminName = admin?.name || 'Admin';
      } catch {}
    }

    const body = await req.json();
    
    // Filter out undefined/null values before validation
    const cleanedBody = Object.fromEntries(
      Object.entries(body).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    
    const payload = PatchSchema.parse(cleanedBody);
    const params = await context.params;
    const id = Number(params.employeeId);

    // Get current user data before update
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { role: true, employeeStatus: true }
    });

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

    // 🔔 SEND NOTIFICATIONS FOR CHANGES
    
    // Notify if role changed
    if (payload.role && payload.role !== currentUser?.role) {
      await notifyRoleChanged(
        id,
        payload.role,
        adminName
      );
    }

    // Notify if status changed
    if (payload.employeeStatus && payload.employeeStatus !== currentUser?.employeeStatus) {
      await notifyEmployeeStatusChanged(
        id,
        payload.employeeStatus
      );
    }

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error(err);
    const status = err?.status || 400;
    const msg = err?.message || 'Bad request';
    return NextResponse.json({ ok: false, message: msg }, { status });
  }
}