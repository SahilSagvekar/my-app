export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { and, or, eq, ne, isNull, notInArray, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const { db, closeDb } = getDb();
  try {
  try {
    // await requireAdmin(req);

    // Get status filter from query params
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    // 🔥 OPTIMIZED: Only select fields needed for the list view
    const employees = await db.query.user.findMany({
      where: and(
        or(isNull(user.role), notInArray(user.role, ["admin", "client"] as any)),
        // Filter by status if provided
        status ? eq(user.employeeStatus, status as any) : undefined,
      ),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        roles: true,
        phone: true,
        employeeStatus: true,
        hourlyRate: true,
        hoursPerWeek: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        // Get the most recent session for last active
        sessions: {
          columns: { expires: true },
          orderBy: (s, { desc }) => desc(s.expires),
          limit: 1,
        },
        // Get the most recent login audit log as fallback
        loginAuditLogs: {
          columns: { createdAt: true, action: true },
          orderBy: (l, { desc }) => desc(l.createdAt),
          limit: 1,
        },
      },
      orderBy: desc(user.createdAt),
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
        lastActive = new Date(emp.loginAuditLogs[0].createdAt);
      }

      // Fallback to updatedAt
      if (!lastActive) {
        lastActive = new Date(emp.updatedAt);
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

  } finally {
    await closeDb();
  }
}