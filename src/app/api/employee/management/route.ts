export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { user, task } from "@/lib/db/schema";
import { count, sql as drizzleSql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    await requireAdmin(req);

    // 🔥 OPTIMIZED: Use parallel queries instead of nested includes
    // This is MUCH faster than including all relations in one query
    
    const [rawEmployees, taskCounts, lastActivities] = await Promise.all([
      // 1. Get employees with only necessary client data (no heavy relations)
      db.query.user.findMany({
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          hourlyRate: true,
          monthlyRate: true,
          hoursPerWeek: true,
          monthlyBaseHours: true,
          employeeStatus: true,
          joinedAt: true,
          worksOnSaturday: true,
          createdAt: true,
          updatedAt: true,
          linkedClientId: true,
          emailNotifications: true,
          slackNotifications: true,
        },
        with: {
          // Only select minimal client data
          // "client" relation = user.linkedClientId -> Client (Prisma's `linkedClient`)
          client: {
            columns: { id: true, name: true, companyName: true },
          },
          // "clients" relation = reverse of Client.userId -> User (Prisma's `client`);
          // mislabeled many() by introspection despite being 1:1 (unique FK) — take [0]
          clients: {
            columns: { id: true, name: true, companyName: true },
          },
        },
        orderBy: (u, { desc }) => desc(u.createdAt),
      }),

      // 2. Get task counts per user (much faster than fetching all tasks)
      db.select({ assignedTo: task.assignedTo, value: count() }).from(task).groupBy(task.assignedTo),

      // 3. Get last activity per user using a raw query for better performance
      db.execute(drizzleSql`
        SELECT "userId", MAX("timestamp") as "lastActive"
        FROM "AuditLog"
        GROUP BY "userId"
      `) as Promise<{ rows: Array<{ userId: number; lastActive: string }> }>,
    ]);

    const employees = rawEmployees.map(({ client: linkedClient, clients, ...emp }: any) => ({
      ...emp,
      linkedClient,
      client: clients?.[0] ?? null,
    }));

    // Build lookup maps for O(1) access
    const taskCountMap = new Map(
      taskCounts.map(tc => [tc.assignedTo, tc.value])
    );

    const lastActiveMap = new Map(
      lastActivities.rows.map((la: any) => [la.userId, la.lastActive])
    );

    // Map employees with aggregated data
    const employeesWithData = employees.map((emp) => ({
      ...emp,
      // Task count instead of full task array
      assignedTasksCount: taskCountMap.get(emp.id) || 0,
      // Last activity timestamp
      lastActive: lastActiveMap.get(emp.id) || null,
      // Client info (prefer linkedClient, fallback to client)
      linkedClientId: emp.linkedClientId || emp.client?.id || null,
      linkedClientName: emp.linkedClient?.companyName || emp.linkedClient?.name || emp.client?.companyName || emp.client?.name || null,
    }));

    return NextResponse.json({ ok: true, employees: employeesWithData });
  } catch (err: any) {
    console.error("Employee management API error:", err);
    return NextResponse.json({ ok: false, message: err?.message }, { status: 400 });
  }
}