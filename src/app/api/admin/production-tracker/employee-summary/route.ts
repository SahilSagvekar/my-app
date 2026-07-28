import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { TaskStatus } from "@prisma/client";

// GET /api/admin/production-tracker/employee-summary?employeeId=42&month=July-2026
// Pass month=all to see the employee's totals across every month.
//
// Deliberately the "simplest possible" view: total task count, a flat
// count per client, and a count for every single status (all 12 — none
// grouped/merged) so nothing is hidden inside a bucket.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !["admin", "manager"].includes(user.role?.toLowerCase() || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const employeeIdParam = searchParams.get("employeeId");
    if (!employeeIdParam) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }
    const employeeId = parseInt(employeeIdParam);
    const monthParam = searchParams.get("month");

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, email: true, role: true, employeeStatus: true },
    });
    if (!employee || employee.employeeStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    let dateFilter = {};
    let targetMonth = "all";
    if (monthParam && monthParam !== "all") {
      targetMonth = monthParam;
      const [monthName, yearStr] = monthParam.split("-");
      const monthIndex = new Date(`${monthName} 1, ${yearStr}`).getMonth();
      const year = parseInt(yearStr);
      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      dateFilter = {
        OR: [
          { monthFolder: monthParam },
          { createdAt: { gte: monthStart, lte: monthEnd }, monthFolder: null },
        ],
      };
    }

    // A person can be involved via any of these roles on a task —
    // covers editor, QC, scheduler, videographer assignments.
    const tasks = await prisma.task.findMany({
      where: {
        ...dateFilter,
        OR: [
          { assignedTo: employeeId },
          { qc_specialist: employeeId },
          { scheduler: employeeId },
          { videographer: employeeId },
        ],
      },
      select: {
        id: true,
        status: true,
        clientId: true,
        client: { select: { id: true, name: true, companyName: true } },
      },
    });

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
    const allStatuses = Object.values(TaskStatus);
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