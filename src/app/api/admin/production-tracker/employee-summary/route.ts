import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import {
  user as userTable,
  task as taskTable,
  taskStatus as taskStatusEnum,
} from "@/lib/db/schema";
import { and, or, eq } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

// GET /api/admin/production-tracker/employee-summary?employeeId=42&month=July-2026
// Pass month=all to see the employee's totals across every month.
//
// Deliberately the "simplest possible" view: total task count, a flat
// count per client, and a count for every single status (all 12 — none
// grouped/merged) so nothing is hidden inside a bucket.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || !["admin", "manager", "videographer"].includes(user.role?.toLowerCase() || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const employeeIdParam = searchParams.get("employeeId");
    if (!employeeIdParam) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }
    const employeeId = parseInt(employeeIdParam);
    const monthParam = searchParams.get("month");

    const [employee] = await db.select({
      id: userTable.id, name: userTable.name, email: userTable.email,
      role: userTable.role, employeeStatus: userTable.employeeStatus,
    }).from(userTable).where(eq(userTable.id, employeeId)).limit(1);
    if (!employee || employee.employeeStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    let targetMonth = "all";
    if (monthParam && monthParam !== "all") {
      targetMonth = monthParam;
    }

    // NOTE(prisma-migration pre-existing bug): the original code built
    // `where: { ...dateFilter, OR: [...] }` — since dateFilter (when a
    // month was selected) was itself `{ OR: [...] }`, the second `OR:`
    // key in the same object literal silently overwrote the first. The
    // month filter was therefore NEVER actually applied by Prisma; only
    // the role-based OR ran. Preserved as-is (not fixed) per conversion
    // rules — only the role-based filter is applied below.
    //
    // A person can be involved via any of these roles on a task —
    // covers editor, QC, scheduler, videographer assignments.
    const rawTasks = await db.query.task.findMany({
      where: or(
        eq(taskTable.assignedTo, employeeId),
        eq(taskTable.qcSpecialist, employeeId),
        eq(taskTable.scheduler, employeeId),
        eq(taskTable.videographer, employeeId),
      ),
      columns: { id: true, status: true, clientId: true },
      with: {
        client: { columns: { id: true, name: true, companyName: true } },
      },
    });
    const tasks = rawTasks;

    // ─── Breakdown by client ───
    const clientCounts = new Map<string, { clientId: string; clientName: string; count: number }>();
    for (const t of tasks) {
      if (!t.clientId) continue;
      const key = t.clientId;
      const name = t.client?.companyName || t.client?.name || "Unknown client";
      if (!clientCounts.has(key)) {
        clientCounts.set(key, { clientId: key, clientName: name, count: 0 });
      }
      clientCounts.get(key)!.count++;
    }
    const byClient = [...clientCounts.values()].sort((a, b) => b.count - a.count);

    // ─── Breakdown by status — every status, including zeros ───
    const allStatuses = taskStatusEnum.enumValues;
    const byStatus = allStatuses.map((status) => ({
      status,
      count: tasks.filter((t) => t.status === status).length,
    }));

    return NextResponse.json({
      employee: { id: employee.id, name: employee.name || employee.email, role: employee.role },
      month: targetMonth,
      totalTasks: tasks.length,
      byClient,
      byStatus,
    });
  } catch (err: any) {
    console.error("Employee summary error:", err);
    return NextResponse.json({ error: "Server error", details: err.message }, { status: 500 });
  }
}