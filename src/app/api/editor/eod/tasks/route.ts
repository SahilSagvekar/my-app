// src/app/api/editor/eod/tasks/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { task, editorEodReport } from "@/lib/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import {
  getTodayReportDate,
  extractTaskProofLinks,
  validateEodTaskEligibility,
} from "@/lib/editor-eod";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role?.toLowerCase() !== "editor") {
      return NextResponse.json({ error: "Editor only" }, { status: 403 });
    }

    const todayDate = getTodayReportDate();

    // Get already submitted task IDs for today
    const existingReportRaw = await db.query.editorEodReport.findFirst({
      where: and(eq(editorEodReport.editorId, user.id), eq(editorEodReport.reportDate, todayDate)),
      with: { editorEodReportItems: { columns: { taskId: true } } },
    });
    const existingReport = existingReportRaw
      ? { ...existingReportRaw, items: existingReportRaw.editorEodReportItems }
      : null;

    const alreadySubmittedIds = new Set(
      existingReport?.items.map((item) => item.taskId) || []
    );

    // Fetch tasks assigned to this editor that are in workable statuses
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
          "REJECTED",
        ] as any),
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
          },
        },
      },
      orderBy: desc(task.updatedAt),
      limit: 100,
    });

    const payload = tasks.map((task) => {
      const proofLinks = extractTaskProofLinks({
        files: task.files,
        driveLinks: task.driveLinks,
      });

      const eligibility = validateEodTaskEligibility(
        {
          id: task.id,
          assignedTo: task.assignedTo,
          files: task.files,
          driveLinks: task.driveLinks,
        },
        user.id,
        alreadySubmittedIds
      );

      return {
        id: task.id,
        title: task.title || "Untitled Task",
        clientName: task.client?.companyName || task.client?.name || null,
        status: task.status,
        proofLinks,
        eligible: eligibility.eligible,
        disabledReason: eligibility.disabledReason || null,
      };
    });

    return NextResponse.json({
      tasks: payload,
      reportDate: todayDate,
      alreadySent: existingReport?.status === "SENT",
    });
  } catch (err: any) {
    console.error("[EOD Tasks] Error:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message },
      { status: 500 }
    );
  }
}