// src/app/api/team-eod/send/route.ts
// Scheduler/Videographer EOD — manual send, mirrors
// src/app/api/editor/eod/send/route.ts's transaction + re-validate-server-side
// pattern, branching on the caller's own role.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { task as taskTable, shootDetail as shootDetailTable, roleEodReport, roleEodReportItem } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import {
  getTodayReportDate,
  validateSchedulerEodEligibility,
  validateVideographerEodEligibility,
  formatRoleEodSlackMessage,
} from "@/lib/role-eod";

export async function POST(req: NextRequest) {
  const { db, closeDb } = getDbPool();
  try {
    try {
      const user = await getCurrentUser2(req);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const role = user.role?.toLowerCase();
      if (role !== "scheduler" && role !== "videographer") {
        return NextResponse.json({ error: "Scheduler or videographer only" }, { status: 403 });
      }

      const userId = Number(user.id);
      const body = await req.json();
      const { taskIds, notes } = body as { taskIds: string[]; notes?: string };

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
      }
      const uniqueTaskIds = [...new Set(taskIds)];
      const todayDate = getTodayReportDate();

      const existingReport = await db.query.roleEodReport.findFirst({
        where: and(eq(roleEodReport.userId, userId), eq(roleEodReport.reportDate, todayDate)),
        with: { roleEodReportItems: { columns: { taskId: true } } },
      });
      const alreadySubmittedIds = new Set(
        (existingReport?.roleEodReportItems || []).map((i) => i.taskId),
      );

      const errors: string[] = [];
      let reportItems: Array<{ taskId: string; taskTitle: string; detail: Record<string, unknown>; statusAtSend: string | null }>;

      if (role === "scheduler") {
        const rows = await db
          .select({
            id: taskTable.id,
            title: taskTable.title,
            status: taskTable.status,
            scheduler: taskTable.scheduler,
            updatedAt: taskTable.updatedAt,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, uniqueTaskIds));

        for (const taskId of uniqueTaskIds) {
          const row = rows.find((t) => t.id === taskId);
          if (!row) { errors.push(`Task ${taskId} not found`); continue; }
          const eligibility = validateSchedulerEodEligibility(
            { id: row.id, scheduler: row.scheduler, updatedAt: row.updatedAt },
            userId,
            alreadySubmittedIds,
            todayDate,
          );
          if (!eligibility.eligible) {
            errors.push(`Task "${row.title || taskId}": ${eligibility.disabledReason || "not eligible"}`);
          }
        }

        reportItems = rows
          .filter((row) => uniqueTaskIds.includes(row.id))
          .map((row) => ({
            taskId: row.id,
            taskTitle: row.title || "Untitled Task",
            detail: { status: row.status },
            statusAtSend: row.status || null,
          }));
      } else {
        const rows = await db
          .select({
            taskId: shootDetailTable.taskId,
            title: taskTable.title,
            status: taskTable.status,
            videographerId: shootDetailTable.videographerId,
            shootUpdatedAt: shootDetailTable.updatedAt,
            actualEndTime: shootDetailTable.actualEndTime,
            location: shootDetailTable.location,
          })
          .from(shootDetailTable)
          .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
          .where(inArray(shootDetailTable.taskId, uniqueTaskIds));

        for (const taskId of uniqueTaskIds) {
          const row = rows.find((t) => t.taskId === taskId);
          if (!row) { errors.push(`Shoot ${taskId} not found`); continue; }
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
          if (!eligibility.eligible) {
            errors.push(`Shoot "${row.title || taskId}": ${eligibility.disabledReason || "not eligible"}`);
          }
        }

        reportItems = rows
          .filter((row) => uniqueTaskIds.includes(row.taskId))
          .map((row) => ({
            taskId: row.taskId,
            taskTitle: row.title || "Untitled Shoot",
            detail: { status: row.status, location: row.location || null },
            statusAtSend: row.status || null,
          }));
      }

      if (errors.length > 0) {
        console.error("[Team EOD Send] Validation errors:", errors);
        return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
      }

      const report = await db.transaction(async (tx) => {
        let reportRecord;
        if (existingReport) {
          [reportRecord] = await tx.update(roleEodReport).set({
            notes: notes || existingReport.notes,
            status: "DRAFT",
            updatedAt: new Date().toISOString(),
          }).where(eq(roleEodReport.id, existingReport.id)).returning();
        } else {
          [reportRecord] = await tx.insert(roleEodReport).values({
            id: createId(),
            userId,
            role,
            reportDate: todayDate,
            slackChannel: process.env.EDITOR_EOD_SLACK_CHANNEL || "reports",
            status: "DRAFT",
            notes: notes || null,
            updatedAt: new Date().toISOString(),
          }).returning();
        }

        await tx.insert(roleEodReportItem).values(
          reportItems.map((item) => ({
            id: createId(),
            reportId: reportRecord.id,
            ...item,
          })),
        );

        return reportRecord;
      });

      const roleLabel = role === "scheduler" ? "Scheduler" : "Videographer";
      const slackMessage = formatRoleEodSlackMessage({
        roleLabel,
        personName: user.name || roleLabel,
        reportDate: todayDate,
        items: reportItems.map((item) => ({
          title: item.taskTitle,
          detail: typeof item.detail?.location === "string" ? (item.detail.location as string) : null,
        })),
        notes,
      });

      let slackFailed = false;
      try {
        const webhookUrl = process.env.SLACK_REPORT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
        if (!webhookUrl) {
          console.error("[Team EOD] No Slack webhook URL configured");
          slackFailed = true;
        } else {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: slackMessage }),
          });
          if (!res.ok) {
            const errorText = await res.text().catch(() => "unknown");
            console.error(`[Team EOD] Slack send failed: ${res.status} ${errorText}`);
            slackFailed = true;
          }
        }
      } catch (slackErr) {
        console.error("[Team EOD] Slack send error:", slackErr);
        slackFailed = true;
      }

      await db.update(roleEodReport).set({
        status: slackFailed ? "FAILED" : "SENT",
        updatedAt: new Date().toISOString(),
      }).where(eq(roleEodReport.id, report.id));

      return NextResponse.json({
        success: true,
        reportId: report.id,
        taskCount: reportItems.length,
        slackSent: !slackFailed,
      });
    } catch (err: any) {
      console.error("[Team EOD Send] Error:", err);
      return NextResponse.json({ error: "Server error", details: err.message }, { status: 500 });
    }
  } finally {
    await closeDb();
  }
}
