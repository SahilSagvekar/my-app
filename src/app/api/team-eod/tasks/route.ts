// src/app/api/team-eod/tasks/route.ts
// Scheduler/Videographer EOD — populates the picker UI. Mirrors
// src/app/api/editor/eod/tasks/route.ts, branching on the caller's own
// role (never client-supplied) since a scheduler's and a videographer's
// "unit of work" are shaped completely differently (Task vs ShootDetail).
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { task as taskTable, shootDetail as shootDetailTable, client as clientTable, roleEodReport } from "@/lib/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import {
  getTodayReportDate,
  validateSchedulerEodEligibility,
  validateVideographerEodEligibility,
} from "@/lib/role-eod";

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = user.role?.toLowerCase();
    if (role !== "scheduler" && role !== "videographer") {
      return NextResponse.json({ error: "Scheduler or videographer only" }, { status: 403 });
    }

    const todayDate = getTodayReportDate();
    const userId = Number(user.id);

    const existingReport = await db.query.roleEodReport.findFirst({
      where: and(eq(roleEodReport.userId, userId), eq(roleEodReport.reportDate, todayDate)),
      with: { roleEodReportItems: { columns: { taskId: true } } },
    });
    const alreadySubmittedIds = new Set(
      (existingReport?.roleEodReportItems || []).map((i) => i.taskId),
    );

    let payload: Array<{
      id: string;
      title: string;
      clientName: string | null;
      status: string;
      proofLinks: never[];
      eligible: boolean;
      disabledReason: string | null;
    }>;

    if (role === "scheduler") {
      const rows = await db
        .select({
          id: taskTable.id,
          title: taskTable.title,
          status: taskTable.status,
          scheduler: taskTable.scheduler,
          updatedAt: taskTable.updatedAt,
          clientName: clientTable.companyName,
          clientNameFallback: clientTable.name,
        })
        .from(taskTable)
        .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
        .where(and(
          eq(taskTable.scheduler, userId),
          inArray(taskTable.status, ["SCHEDULED", "COMPLETED", "POSTED"] as any),
        ))
        .orderBy(desc(taskTable.updatedAt))
        .limit(200);

      payload = rows.map((row) => {
        const eligibility = validateSchedulerEodEligibility(
          { id: row.id, scheduler: row.scheduler, updatedAt: row.updatedAt },
          userId,
          alreadySubmittedIds,
          todayDate,
        );
        return {
          id: row.id,
          title: row.title || "Untitled Task",
          clientName: row.clientName || row.clientNameFallback,
          status: row.status || "",
          proofLinks: [],
          eligible: eligibility.eligible,
          disabledReason: eligibility.disabledReason || null,
        };
      });
    } else {
      const rows = await db
        .select({
          taskId: shootDetailTable.taskId,
          title: taskTable.title,
          status: taskTable.status,
          videographerId: shootDetailTable.videographerId,
          shootUpdatedAt: shootDetailTable.updatedAt,
          actualEndTime: shootDetailTable.actualEndTime,
          clientName: clientTable.companyName,
          clientNameFallback: clientTable.name,
        })
        .from(shootDetailTable)
        .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
        .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
        .where(eq(shootDetailTable.videographerId, userId))
        .orderBy(desc(shootDetailTable.updatedAt))
        .limit(200);

      payload = rows.map((row) => {
        const eligibility = validateVideographerEodEligibility(
          {
            taskId: row.taskId,
            videographerId: row.videographerId,
            shootUpdatedAt: row.shootUpdatedAt,
            actualEndTime: row.actualEndTime,
          },
          userId,
          alreadySubmittedIds,
          todayDate,
        );
        return {
          id: row.taskId,
          title: row.title || "Untitled Shoot",
          clientName: row.clientName || row.clientNameFallback,
          status: row.status || "",
          proofLinks: [],
          eligible: eligibility.eligible,
          disabledReason: eligibility.disabledReason || null,
        };
      });
    }

    // Only surface eligible or already-submitted-today rows — hide the rest
    // of the backlog so nobody can select-all stale work.
    const visible = payload.filter(
      (t) => t.eligible || t.disabledReason === "Already submitted today",
    );

    return NextResponse.json({
      tasks: visible,
      reportDate: todayDate,
      workWindow: "9:00 AM–7:00 PM ET",
      alreadySent: existingReport?.status === "SENT",
      role,
    });
  } catch (err: any) {
    console.error("[Team EOD Tasks] Error:", err);
    return NextResponse.json({ error: "Server error", details: err.message }, { status: 500 });
  }
}
