import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user as userTable, task, client as clientTable } from "@/lib/db/schema";
import { and, eq, or, gte, lte, isNull, isNotNull, inArray } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

// GET /api/editor/production-tracker?month=April-2026&editorId=42
// - Admin/manager can pass any editorId
// - Editor calling without editorId gets their own data
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month");
    const editorIdParam = searchParams.get("editorId");

    // Determine which editor's data to return
    let targetEditorId: number;
    const isAdminOrManager = ["admin", "manager"].includes(user.role?.toLowerCase() || "");

    if (editorIdParam) {
      if (!isAdminOrManager) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetEditorId = parseInt(editorIdParam);
    } else {
      if (!["editor"].includes(user.role?.toLowerCase() || "") && !isAdminOrManager) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetEditorId = user.id;
    }

    // Default to current month
    const now = new Date();
    const currentMonthName = now.toLocaleString("en-US", { month: "long" });
    const currentYear = now.getFullYear();
    const targetMonth = monthParam || `${currentMonthName}-${currentYear}`;

    const [monthName, yearStr] = targetMonth.split("-");
    const monthIndex = new Date(`${monthName} 1, ${yearStr}`).getMonth();
    const year = parseInt(yearStr);
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    // Get editor info
    const [editor] = await db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email, role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, targetEditorId))
      .limit(1);
    if (!editor) return NextResponse.json({ error: "Editor not found" }, { status: 404 });

    // Get all tasks assigned to this editor for the month
    const tasks = await db.query.task.findMany({
      where: and(
        eq(task.assignedTo, targetEditorId),
        or(
          eq(task.monthFolder, targetMonth),
          and(
            gte(task.createdAt, monthStart.toISOString()),
            lte(task.createdAt, monthEnd.toISOString()),
            isNull(task.monthFolder)
          )
        ),
        isNotNull(task.clientId)
      ),
      columns: {
        id: true,
        status: true,
        clientId: true,
        monthlyDeliverableId: true,
        deliverableType: true,
        isExtra: true,
        monthFolder: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        monthlyDeliverable: {
          columns: { id: true, type: true, quantity: true },
        },
      },
    });

    // Get the unique clients this editor has tasks for
    const clientIds = [...new Set(tasks.map((t) => t.clientId).filter(Boolean))] as string[];

    // Get client + their monthly deliverables
    const clients = clientIds.length === 0 ? [] : await db.query.client.findMany({
      where: inArray(clientTable.id, clientIds),
      columns: { id: true, name: true, companyName: true },
      with: {
        monthlyDeliverables: {
          columns: { id: true, type: true, quantity: true },
        },
      },
      orderBy: (c, { asc }) => [asc(c.companyName)],
    });

    // Available months for dropdown
    const monthFolders = await db.selectDistinct({ monthFolder: task.monthFolder })
      .from(task)
      .where(and(eq(task.assignedTo, targetEditorId), isNotNull(task.monthFolder)));
    const availableMonths = [
      ...new Set(monthFolders.map((t) => t.monthFolder).filter(Boolean) as string[]),
    ].sort((a, b) => {
      const [mA, yA] = a.split("-");
      const [mB, yB] = b.split("-");
      return new Date(`${mB} 1, ${yB}`).getTime() - new Date(`${mA} 1, ${yA}`).getTime();
    });

    // Build per-client progress (only this editor's tasks)
    const clientProgress = clients.map((client) => {
      const clientTasks = tasks.filter((t) => t.clientId === client.id);

      const deliverables = client.monthlyDeliverables.map((del) => {
        const delTasks = clientTasks.filter((t) => t.monthlyDeliverableId === del.id);

        const typeMatchTasks =
          delTasks.length === 0
            ? clientTasks.filter(
                (t) =>
                  !t.monthlyDeliverableId &&
                  (t.deliverableType === del.type || t.monthlyDeliverable?.type === del.type)
              )
            : [];

        const allDelTasks = [...delTasks, ...typeMatchTasks];
        const promisedTasks = allDelTasks.filter((t) => !t.isExtra);
        const extraTasks = allDelTasks.filter((t) => t.isExtra);

        const count = (statuses: string[]) =>
          allDelTasks.filter((t) => statuses.includes(t.status || "")).length;

        const statusCounts = {
          total: allDelTasks.length,
          pending: count(["PENDING", "VIDEOGRAPHER_ASSIGNED"]),
          inProgress: count(["IN_PROGRESS"]),
          readyForQc: count(["READY_FOR_QC", "QC_IN_PROGRESS"]),
          completed: count(["COMPLETED"]),
          scheduled: count(["SCHEDULED"]),
          posted: count(["POSTED"]),
          clientReview: count(["CLIENT_REVIEW"]),
          onHold: count(["ON_HOLD", "REJECTED"]),
        };

        const doneStatuses = ["COMPLETED", "SCHEDULED", "POSTED"];
        const doneCount = promisedTasks.filter((t) => doneStatuses.includes(t.status || "")).length;
        const extraDoneCount = extraTasks.filter((t) => doneStatuses.includes(t.status || "")).length;

        const totalEditorTasks = promisedTasks.length;
        const progressPercent =
          totalEditorTasks > 0
            ? Math.min(100, Math.round((doneCount / totalEditorTasks) * 100))
            : 0;

        return {
          deliverableId: del.id,
          type: del.type,
          statusCounts,
          doneCount,
          totalEditorTasks,
          extraCount: extraTasks.length,
          extraDoneCount,
          progressPercent,
        };
      }).filter((d) => d.statusCounts.total > 0);

      const totalEditorTasks = deliverables.reduce((s, d) => s + d.totalEditorTasks, 0);
      const totalDone = deliverables.reduce((s, d) => s + d.doneCount, 0);
      const overallProgress =
        totalEditorTasks > 0 ? Math.round((totalDone / totalEditorTasks) * 100) : 0;

      return {
        clientId: client.id,
        clientName: client.companyName || client.name,
        deliverables,
        totalTasks: clientTasks.length,
        totalEditorTasks,
        totalDone,
        totalExtraTasks: deliverables.reduce((s, d) => s + d.extraCount, 0),
        totalExtraDone: deliverables.reduce((s, d) => s + d.extraDoneCount, 0),
        overallProgress,
      };
    }).filter((c) => c.totalTasks > 0);

    // Summary
    const totalEditorTasks = clientProgress.reduce((s, c) => s + c.totalEditorTasks, 0);
    const totalDone = clientProgress.reduce((s, c) => s + c.totalDone, 0);
    const summary = {
      totalClients: clientProgress.length,
      totalTasks: tasks.length,
      totalEditorTasks,
      totalDone,
      overallProgress:
        totalEditorTasks > 0 ? Math.round((totalDone / totalEditorTasks) * 100) : 0,
      pending: tasks.filter((t) => ["PENDING", "VIDEOGRAPHER_ASSIGNED"].includes(t.status || "")).length,
      inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      readyForQc: tasks.filter((t) => ["READY_FOR_QC", "QC_IN_PROGRESS"].includes(t.status || "")).length,
      completed: tasks.filter((t) => ["COMPLETED", "SCHEDULED", "POSTED"].includes(t.status || "")).length,
    };

    return NextResponse.json({
      month: targetMonth,
      editor: { id: editor.id, name: editor.name || editor.email, role: editor.role },
      summary,
      clientProgress,
      availableMonths,
    });
  } catch (err: any) {
    console.error("Editor production tracker error:", err);
    return NextResponse.json({ error: "Server error", details: err.message }, { status: 500 });
  }
}