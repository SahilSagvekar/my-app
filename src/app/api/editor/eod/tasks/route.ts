// src/app/api/editor/eod/tasks/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    const existingReport = await prisma.editorEodReport.findUnique({
      where: {
        editorId_reportDate: {
          editorId: user.id,
          reportDate: todayDate,
        },
      },
      include: { items: { select: { taskId: true } } },
    });

    const alreadySubmittedIds = new Set(
      existingReport?.items.map((item) => item.taskId) || []
    );

    // Fetch tasks assigned to this editor that are in workable statuses
    const tasks = await prisma.task.findMany({
      where: {
        assignedTo: user.id,
        status: {
          in: [
            "IN_PROGRESS",
            "READY_FOR_QC",
            "QC_IN_PROGRESS",
            "COMPLETED",
            "SCHEDULED",
            "POSTED",
            "REJECTED",
          ],
        },
      },
      include: {
        client: {
          select: { id: true, name: true, companyName: true },
        },
        files: {
          where: { isActive: true },
          select: {
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
      orderBy: { updatedAt: "desc" },
      take: 100,
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