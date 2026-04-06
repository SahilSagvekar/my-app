export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    // Get status filter from query params
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    // 🔥 OPTIMIZED: Only select fields needed for the list view
    const employees = await prisma.user.findMany({
      where: {
        OR: [
          { role: null },
          { role: { notIn: ["admin", "client"] } }
        ],
        // Filter by status if provided
        ...(status && { employeeStatus: status as any }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        employeeStatus: true,
        hourlyRate: true,
        hoursPerWeek: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true,
        // Get the most recent session for last active
        sessions: {
          select: {
            expires: true,
          },
          orderBy: { expires: 'desc' },
          take: 1,
        },
        // Get the most recent login audit log as fallback
        loginAuditLogs: {
          select: {
            createdAt: true,
            action: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" }
    });

    // Process employees to include lastActive
    const employeesWithLastActive = employees.map((emp) => {
      let lastActive: Date | null = null;

      // Check session expiry (if session exists and hasn't expired, user was recently active)
      if (emp.sessions.length > 0) {
        const sessionExpiry = new Date(emp.sessions[0].expires);
        // Session expiry minus typical session duration (e.g., 30 days) gives approximate last activity
        // Or we can just use the session existence as indicator
        lastActive = sessionExpiry;
      }

      // Check login audit logs as fallback
      if (!lastActive && emp.loginAuditLogs.length > 0) {
        lastActive = emp.loginAuditLogs[0].createdAt;
      }

      // Fallback to updatedAt
      if (!lastActive) {
        lastActive = emp.updatedAt;
      }

      // Remove the nested relations from response
      const { sessions, loginAuditLogs, ...employeeData } = emp;

      return {
        ...employeeData,
        lastActive: lastActive?.toISOString() || null,
      };
    });

    return NextResponse.json({ ok: true, employees: employeesWithLastActive });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message }, { status: 400 });
  }
}