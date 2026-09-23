export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { and, or, eq, ne, isNull, notInArray, arrayContains, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

// Real staff-type roles — used below so a multi-role account (admin as
// primary role, but also editor/videographer/etc as a secondary role)
// still counts as staff instead of being dropped outright.
const STAFF_ROLES = ['manager', 'editor', 'videographer', 'scheduler', 'qc', 'sales', 'sales_manager'] as const;

export async function GET(req: Request) {
  const db = getDbHttp();
  try {
    // await requireAdmin(req);

    // Get status filter from query params
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    // 🔥 OPTIMIZED: Only select fields needed for the list view
    const employees = await db.query.user.findMany({
      where: and(
        // Clients are never staff — always excluded.
        or(isNull(user.role), ne(user.role, "client" as any)),
        // Admins ARE excluded by default (this feeds every staff
        // dropdown/list app-wide, and a bare admin isn't assignable staff)
        // — UNLESS they also hold a real staff role as a secondary role
        // (e.g. an admin who also edits/shoots/QCs). Previously this was a
        // flat notInArray(role, ["admin","client"]), so anyone whose
        // *primary* role was admin was dropped entirely, even when their
        // roles[] included editor/videographer/qc/scheduler — they never
        // showed up in those role-filtered pickers no matter what.
        or(
          isNull(user.role),
          ne(user.role, "admin" as any),
          ...STAFF_ROLES.map((r) => arrayContains(user.roles, [r])),
        ),
        // Filter by a specific status if the caller asked for one; otherwise
        // default to excluding TERMINATED so terminated people disappear
        // from every dropdown/list app-wide without needing every caller to
        // remember to filter explicitly.
        status ? eq(user.employeeStatus, status as any) : ne(user.employeeStatus, 'TERMINATED'),
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
}