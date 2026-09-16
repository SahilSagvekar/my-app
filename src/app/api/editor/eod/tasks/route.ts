// src/app/api/editor/eod/tasks/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { task, editorEodReport } from "@/lib/db/schema";
import { and, eq, inArray, desc, gte } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import {
  getTodayReportDate,
  extractTaskProofLinks,
  validateEodTaskEligibility,
} from "@/lib/editor-eod";
import { getESTDate } from "@/lib/est-date";

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role?.toLowerCase() !== "editor") {
      return NextResponse.json({ error: "Editor only" }, { status: 403 });
    }

    const todayDate = getTodayReportDate();
    const { start: dayStart } = getESTDate(); // coarse: start of EST calendar day

    // Get already submitted task IDs for today
    const existingReportRaw = await db.query.editorEodReport.findFirst({
      where: and(eq(editorEodReport.editorId, user.id), eq(editorEodReport.reportDate, todayDate)),
      with: { editorEodReportItems: { columns: { taskId: true } } },
    });
    const existingReport = existingReportRaw
      ? { ...existingReportRaw, items: existingReportRaw.editorEodReportItems }
      : null;

    const alreadySubmittedIds = new Set(
      existingReport?.items.map((item) => item.taskId) || [],
    );

    // Coarse DB filter: touched on/after start of today ET.
    // Fine 9am–7pm ET window is applied in validateEodTaskEligibility.
    const tasks = await db.query.task.findMany({
      where: and(
        eq(task.assignedTo, user.id),
        inArray(task.status, [
          "IN_PROGRESS",
          "READY_FOR_QC",
          "QC_IN_PROGRESS",
          "COMPLETED",
          "SCHEDULED",
          "POSTED",
          "REJECTED_BY_QC",
          "REJECTED_BY_CLIENT",
        ] as any),
        gte(task.updatedAt, dayStart.toISOString()),
      ),
      with: {
        client: {
          columns: { id: true, name: true, companyName: true },
        },
        files: {
          where: (f, { eq }) => eq(f.isActive, true),
          columns: {
            id: true,
            name: true,
            url: true,
            mimeType: true,
            s3Key: true,
            folderType: true,
            isActive: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: desc(task.updatedAt),
      limit: 200,
    });

    const payload = tasks.map((row) => {
      const proofLinks = extractTaskProofLinks({
        files: row.files,
        driveLinks: row.driveLinks,
      });

      const eligibility = validateEodTaskEligibility(
        {
          id: row.id,
          assignedTo: row.assignedTo,
          updatedAt: row.updatedAt,
          files: row.files,
          driveLinks: row.driveLinks,
        },
        user.id,
        alreadySubmittedIds,
        todayDate,
      );

      return {
        id: row.id,
        title: row.title || "Untitled Task",
        clientName: row.client?.companyName || row.client?.name || null,
        status: row.status,
        proofLinks,
        eligible: eligibility.eligible,
        disabledReason: eligibility.disabledReason || null,
      };
    });

    // Only return tasks that are eligible (or already submitted today for context).
    // Hide unrelated backlog so editors can't select-all old work.
    const visible = payload.filter(
      (t) => t.eligible || t.disabledReason === "Already submitted today",
    );

    return NextResponse.json({
      tasks: visible,
      reportDate: todayDate,
      workWindow: "9:00 AM–7:00 PM ET",
      alreadySent: existingReport?.status === "SENT",
    });
  } catch (err: any) {
    console.error("[EOD Tasks] Error:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message },
      { status: 500 },
    );
  }
}
