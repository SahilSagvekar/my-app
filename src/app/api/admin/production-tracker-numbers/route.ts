import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import {
  client as clientTable,
  task as taskTable,
  user as userTable,
  auditLog as auditLogTable,
} from "@/lib/db/schema";
import { and, or, eq, gte, lte, isNull, isNotNull, inArray } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

// GET /api/admin/production-tracker-numbers?month=April-2026
//
// Hard-number tracker. No percentages, no health labels. Every field is a
// raw count someone can double check by hand.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (
      !user ||
      !["admin", "manager", "scheduler", "videographer"].includes(
        user.role?.toLowerCase() || ""
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month");

    const now = new Date();
    const currentMonthName = now.toLocaleString("en-US", { month: "long" });
    const currentYear = now.getFullYear();
    const targetMonth = monthParam || `${currentMonthName}-${currentYear}`;

    const [monthName, yearStr] = targetMonth.split("-");
    const monthIndex = new Date(`${monthName} 1, ${yearStr}`).getMonth();
    const year = parseInt(yearStr);
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    // ─── 1. Clients + their promised deliverables ───
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

    // ─── 2. Tasks for the target month, with feedback attached ───
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
        title: true,
        status: true,
        assignedTo: true,
        clientId: true,
        monthlyDeliverableId: true,
        deliverableType: true,
        isExtra: true,
      },
      with: {
        monthlyDeliverable: { columns: { id: true, type: true } },
        taskFeedbacks: { columns: { category: true, feedback: true } },
      },
    });

    // ─── 3. Active editors ───
    const employees = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
      })
      .from(userTable)
      .where(
        and(
          eq(userTable.role, "editor" as any),
          eq(userTable.employeeStatus, "ACTIVE")
        )
      );

    const DONE_STATUSES = ["COMPLETED", "SCHEDULED", "POSTED"];

    // ─── Rejection EVENTS this month, from the audit log ───
    // Every task status change writes an AuditLog row with
    // metadata.{previousStatus,newStatus} (see /api/tasks/[id]/status).
    // Counting from here — instead of "is this task currently rejected" —
    // means a task rejected twice and later fixed still counts as 2
    // rejections against its editor, not 0.
    const taskIds = tasks.map((t) => t.id);
    const statusChangeLogs = taskIds.length
      ? await db
          .select({ entityId: auditLogTable.entityId, metadata: auditLogTable.metadata })
          .from(auditLogTable)
          .where(and(eq(auditLogTable.entity, "Task"), inArray(auditLogTable.entityId, taskIds)))
      : [];

    const rejectionEventsByTaskId = new Map<string, number>();
    for (const log of statusChangeLogs) {
      const newStatus = (log.metadata as any)?.newStatus;
      if (newStatus === "REJECTED_BY_QC" || newStatus === "REJECTED_BY_CLIENT") {
        rejectionEventsByTaskId.set(log.entityId!, (rejectionEventsByTaskId.get(log.entityId!) || 0) + 1);
      }
    }

    // ─── (1) Editor task load — raw count of tasks this month ───
    const editorTaskLoad = employees
      .map((e) => ({
        editorId: e.id,
        editorName: e.name || e.email,
        taskCount: tasks.filter((t) => t.assignedTo === e.id).length,
      }))
      .sort((a, b) => b.taskCount - a.taskCount);

    // ─── (2) Editor incomplete — remaining vs done, hard counts ───
    const editorIncomplete = employees
      .map((e) => {
        const editorTasks = tasks.filter((t) => t.assignedTo === e.id);
        const done = editorTasks.filter((t) =>
          DONE_STATUSES.includes(t.status as string)
        ).length;
        const total = editorTasks.length;
        return {
          editorId: e.id,
          editorName: e.name || e.email,
          total,
          done,
          remaining: total - done,
        };
      })
      .filter((e) => e.total > 0)
      .sort((a, b) => b.remaining - a.remaining);

    // ─── (3) Editor rejection rank — count of rejection EVENTS this month,
    // not just tasks currently sitting in a rejected status. A task rejected
    // twice and later fixed still contributes 2 to its editor's count.
    const editorRejectionRank = employees
      .map((e) => {
        const editorTasks = tasks.filter((t) => t.assignedTo === e.id);
        const rejectCount = editorTasks.reduce(
          (sum, t) => sum + (rejectionEventsByTaskId.get(t.id) || 0),
          0
        );
        return {
          editorId: e.id,
          editorName: e.name || e.email,
          rejectCount,
        };
      })
      .filter((e) => e.rejectCount > 0)
      .sort((a, b) => b.rejectCount - a.rejectCount);

    // ─── (4) Repeat rejection reason per editor ───
    // Group every taskFeedback entry on a task that was rejected at least
    // once this month (regardless of its CURRENT status — a fixed-and-
    // completed task still counted) by editor + reason (category if set,
    // else the feedback text itself). Count occurrences, keep the top
    // reason per editor.
    const reasonCountByEditor = new Map<number, Map<string, number>>();
    for (const t of tasks) {
      if (!t.assignedTo) continue;
      if (!rejectionEventsByTaskId.has(t.id)) continue;
      for (const fb of t.taskFeedbacks || []) {
        const reason = (fb.category || fb.feedback || "uncategorized")
          .trim()
          .slice(0, 80);
        if (!reason) continue;
        if (!reasonCountByEditor.has(t.assignedTo)) {
          reasonCountByEditor.set(t.assignedTo, new Map());
        }
        const m = reasonCountByEditor.get(t.assignedTo)!;
        m.set(reason, (m.get(reason) || 0) + 1);
      }
    }

    const editorTopRejectionReasons = employees
      .map((e) => {
        const reasonMap = reasonCountByEditor.get(e.id);
        if (!reasonMap || reasonMap.size === 0) return null;
        const sorted = [...reasonMap.entries()].sort((a, b) => b[1] - a[1]);
        return {
          editorId: e.id,
          editorName: e.name || e.email,
          topReason: sorted[0][0],
          topReasonCount: sorted[0][1],
          allReasons: sorted.map(([reason, count]) => ({ reason, count })),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.topReasonCount - a.topReasonCount);

    // ─── (5) Client remaining deliverables — promised/done/remaining per type ───
    const clientRemainingDeliverables = clients
      .filter((c) => c.monthlyDeliverables.length > 0)
      .map((c) => {
        const clientTasks = tasks.filter((t) => t.clientId === c.id);
        const deliverables = c.monthlyDeliverables.map((del) => {
          const delTasks = clientTasks.filter((t) => {
            if (t.monthlyDeliverableId) return t.monthlyDeliverableId === del.id;
            return (
              t.deliverableType === del.type ||
              t.monthlyDeliverable?.type === del.type
            );
          });
          const promised = delTasks.filter((t) => !t.isExtra);
          const done = promised.filter((t) =>
            DONE_STATUSES.includes(t.status as string)
          ).length;
          return {
            deliverableId: del.id,
            type: del.type,
            promised: del.quantity,
            done,
            remaining: Math.max(0, del.quantity - done),
          };
        });
        return {
          clientId: c.id,
          clientName: c.companyName || c.name,
          deliverables,
        };
      })
      .filter((c) => c.deliverables.some((d) => d.remaining > 0));

    // ─── (6) All task statuses this month — raw counts ───
    const statusOrder = [
      "PENDING",
      "VIDEOGRAPHER_ASSIGNED",
      "IN_PROGRESS",
      "READY_FOR_QC",
      "QC_IN_PROGRESS",
      "REJECTED_BY_QC",
      "CLIENT_REVIEW",
      "REJECTED_BY_CLIENT",
      "ON_HOLD",
      "COMPLETED",
      "SCHEDULED",
      "POSTED",
    ];
    const statusCountMap = new Map<string, number>();
    for (const t of tasks) {
      const s = (t.status as string) || "UNKNOWN";
      statusCountMap.set(s, (statusCountMap.get(s) || 0) + 1);
    }
    const statusCounts = statusOrder
      .filter((s) => statusCountMap.has(s))
      .map((s) => ({ status: s, count: statusCountMap.get(s)! }));
    // catch anything not in the known list rather than silently dropping it
    for (const [s, count] of statusCountMap) {
      if (!statusOrder.includes(s)) statusCounts.push({ status: s, count });
    }

    // ─── (7) Monthly posting tracker ───
    // "Needs to be posted" = COMPLETED this month but not yet SCHEDULED or
    // POSTED. "Already posted" = hit POSTED this month. Both grouped by
    // client so it reads like the Client Remaining Deliverables table above.
    const clientNameById = new Map(clients.map((c) => [c.id, c.companyName || c.name]));
    const toPostingRow = (t: (typeof tasks)[number]) => ({
      taskId: t.id,
      title: t.title,
      clientName: (t.clientId && clientNameById.get(t.clientId)) || "Unknown Client",
      deliverableType: t.deliverableType || t.monthlyDeliverable?.type || "—",
    });
    const needsToBePosted = tasks
      .filter((t) => t.status === "COMPLETED")
      .map(toPostingRow)
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
    const alreadyPosted = tasks
      .filter((t) => t.status === "POSTED")
      .map(toPostingRow)
      .sort((a, b) => a.clientName.localeCompare(b.clientName));

    // ─── Available months for the picker ───
    const monthFolders = await db
      .selectDistinct({ monthFolder: taskTable.monthFolder })
      .from(taskTable)
      .where(isNotNull(taskTable.monthFolder));
    const availableMonths = [
      ...new Set(
        monthFolders.map((t) => t.monthFolder).filter(Boolean) as string[]
      ),
    ].sort((a, b) => {
      const [mA, yA] = a.split("-");
      const [mB, yB] = b.split("-");
      return (
        new Date(`${mB} 1, ${yB}`).getTime() -
        new Date(`${mA} 1, ${yA}`).getTime()
      );
    });

    return NextResponse.json({
      month: targetMonth,
      availableMonths,
      totalTasks: tasks.length,
      editorTaskLoad,
      editorIncomplete,
      editorRejectionRank,
      editorTopRejectionReasons,
      clientRemainingDeliverables,
      statusCounts,
      needsToBePosted,
      alreadyPosted,
    });
  } catch (err: any) {
    console.error("Production tracker numbers error:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message },
      { status: 500 }
    );
  }
}