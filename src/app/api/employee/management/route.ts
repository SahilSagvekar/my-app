export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    // 🔥 OPTIMIZED: Use parallel queries instead of nested includes
    // This is MUCH faster than including all relations in one query
    
    const [employees, taskCounts, lastActivities] = await Promise.all([
      // 1. Get employees with only necessary client data (no heavy relations)
      prisma.user.findMany({
        select: {
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
          // Only select minimal client data
          linkedClient: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" }
      }),

      // 2. Get task counts per user (much faster than fetching all tasks)
      prisma.task.groupBy({
        by: ['assignedTo'],
        _count: { id: true },
      }),

      // 3. Get last activity per user using a raw query for better performance
      prisma.$queryRaw<Array<{ userId: number; lastActive: Date }>>`
        SELECT "userId", MAX("timestamp") as "lastActive"
        FROM "AuditLog"
        GROUP BY "userId"
      `,
    ]);

    // Build lookup maps for O(1) access
    const taskCountMap = new Map(
      taskCounts.map(tc => [tc.assignedTo, tc._count.id])
    );
    
    const lastActiveMap = new Map(
      lastActivities.map(la => [la.userId, la.lastActive])
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