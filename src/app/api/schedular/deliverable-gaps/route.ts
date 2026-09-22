import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { client as clientTable, task as taskTable } from "@/lib/db/schema";
import { and, or, eq, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

// GET /api/scheduler/deliverable-gaps
//
// Tells the scheduler how many more tasks she still needs from editors
// today, per client + deliverable type.
//
// Daily target = monthly promised qty / days in this month (ceil'd, so a
// fractional day always rounds up rather than quietly under-asking).
//
// "Ready" count = tasks for that client + type that are COMPLETED and have
// no socialMediaLinks yet — i.e. finished by an editor but not yet posted,
// which is the actual backlog a scheduler can pull from right now. This is
// not scoped to "today" by date: a task completed yesterday and still
// unposted still counts as ready inventory today.
//
// missing = max(0, target - ready)
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (
      !user ||
      !["admin", "manager", "scheduler"].includes(user.role?.toLowerCase() || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const monthName = now.toLocaleString("en-US", { month: "long" });
    const targetMonth = `${monthName}-${year}`;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    // Active clients with this month's promised deliverables.
    const clients = await db.query.client.findMany({
      where: eq(clientTable.status, "active"),
      columns: { id: true, name: true, companyName: true },
      with: {
        monthlyDeliverables: {
          columns: { id: true, type: true, quantity: true },
        },
      },
      orderBy: (c, { asc }) => asc(c.companyName),
    });

    // This month's tasks — same "in this month's folder, or created in this
    // month with no folder yet" scoping used elsewhere (Production Tracker).
    const tasks = await db.query.task.findMany({
      where: and(
        or(
          eq(taskTable.monthFolder, targetMonth),
          and(
            gte(taskTable.createdAt, monthStart.toISOString()),
            lte(taskTable.createdAt, monthEnd.toISOString()),
            isNull(taskTable.monthFolder)
          )
        ),
        isNotNull(taskTable.clientId)
      ),
      columns: {
        id: true,
        status: true,
        clientId: true,
        monthlyDeliverableId: true,
        deliverableType: true,
        isExtra: true,
        socialMediaLinks: true,
      },
      with: {
        monthlyDeliverable: { columns: { id: true, type: true } },
      },
    });

    const isUnposted = (links: any) => !Array.isArray(links) || links.length === 0;

    const gaps: {
      clientId: string;
      clientName: string;
      deliverableId: string;
      type: string;
      target: number;
      ready: number;
      missing: number;
    }[] = [];

    for (const c of clients) {
      const clientTasks = tasks.filter((t) => t.clientId === c.id);
      for (const del of c.monthlyDeliverables) {
        if (!del.quantity || del.quantity <= 0) continue;

        const delTasks = clientTasks.filter((t) => {
          if (t.monthlyDeliverableId) return t.monthlyDeliverableId === del.id;
          return (
            t.deliverableType === del.type ||
            t.monthlyDeliverable?.type === del.type
          );
        });

        const ready = delTasks.filter(
          (t) =>
            !t.isExtra &&
            t.status === "COMPLETED" &&
            isUnposted(t.socialMediaLinks)
        ).length;

        const target = Math.ceil(del.quantity / daysInMonth);
        const missing = Math.max(0, target - ready);

        gaps.push({
          clientId: c.id,
          clientName: c.companyName || c.name,
          deliverableId: del.id,
          type: del.type,
          target,
          ready,
          missing,
        });
      }
    }

    return NextResponse.json({
      month: targetMonth,
      daysInMonth,
      gaps: gaps.sort((a, b) => b.missing - a.missing),
    });
  } catch (error: any) {
    console.error("[Scheduler] Deliverable gaps error:", error);
    return NextResponse.json(
      { error: "Failed to load deliverable gaps", details: error.message },
      { status: 500 }
    );
  }
}