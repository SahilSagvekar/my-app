// src/app/api/editor/eod/send/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import {
  getTodayReportDate,
  extractTaskProofLinks,
  formatEditorEodSlackMessage,
} from "@/lib/editor-eod";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role?.toLowerCase() !== "editor") {
      return NextResponse.json({ error: "Editor only" }, { status: 403 });
    }

    const body = await req.json();
    const { taskIds, notes } = body as {
      taskIds: string[];
      notes?: string;
    };

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: "At least one task is required" },
        { status: 400 }
      );
    }

    // De-duplicate
    const uniqueTaskIds = [...new Set(taskIds)];

    const todayDate = getTodayReportDate();

    // Check for existing report
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
      existingReport?.items.map((i) => i.taskId) || []
    );

    // Fetch tasks from DB — do NOT trust frontend
    const tasks = await prisma.task.findMany({
      where: { id: { in: uniqueTaskIds } },
      include: {
        client: {
          select: { name: true, companyName: true },
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
    });

    // Server-side validation
    const errors: string[] = [];

    for (const taskId of uniqueTaskIds) {
      const task = tasks.find((t) => t.id === taskId);

      if (!task) {
        errors.push(`Task ${taskId} not found`);
        continue;
      }

      if (task.assignedTo !== user.id) {
        errors.push(`Task "${task.title}" not assigned to you`);
        continue;
      }

      if (alreadySubmittedIds.has(taskId)) {
        errors.push(`Task "${task.title}" already submitted today`);
        continue;
      }

      const hasFiles = task.files.some((f) => f.s3Key || f.url);
      const hasDriveLinks = task.driveLinks?.some((l) => l && l.trim());

      if (!hasFiles && !hasDriveLinks) {
        errors.push(`Task "${task.title}" has no output link`);
        continue;
      }
    }

    if (errors.length > 0) {
      console.error("[EOD Send] Validation errors:", errors);
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    // Build report items
    const reportItems = tasks.map((task) => {
      const proofLinks = extractTaskProofLinks({
        files: task.files,
        driveLinks: task.driveLinks,
      });

      return {
        taskId: task.id,
        taskTitle: task.title || "Untitled Task",
        proofLinks: proofLinks,
        statusAtSend: task.status || null,
      };
    });

    // Create or update report in transaction
    const report = await prisma.$transaction(async (tx) => {
      let reportRecord;

      if (existingReport) {
        // Append to existing report
        reportRecord = await tx.editorEodReport.update({
          where: { id: existingReport.id },
          data: {
            notes: notes || existingReport.notes,
            status: "DRAFT",
          },
        });
      } else {
        // Create new report
        reportRecord = await tx.editorEodReport.create({
          data: {
            editorId: user.id,
            reportDate: todayDate,
            slackChannel: process.env.EDITOR_EOD_SLACK_CHANNEL || "reports",
            status: "DRAFT",
            notes: notes || null,
          },
        });
      }

      // Create report items
      await tx.editorEodReportItem.createMany({
        data: reportItems.map((item) => ({
          reportId: reportRecord.id,
          ...item,
        })),
      });

      return reportRecord;
    });

    // Format and send Slack message
    const slackMessage = formatEditorEodSlackMessage({
      editorName: user.name || "Editor",
      reportDate: todayDate,
      tasks: reportItems.map((item) => ({
        title: item.taskTitle,
        proofLinks: item.proofLinks as any,
      })),
      notes: notes,
    });

    let slackTs: string | null = null;
    let slackFailed = false;

    try {
      // Send directly as plain text to avoid Slack Block Kit 3000 char limit
      const webhookUrl = process.env.SLACK_REPORT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
      
      if (!webhookUrl) {
        console.error("[EOD] No Slack webhook URL configured");
        slackFailed = true;
      } else {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: slackMessage }),
        });

        if (res.ok) {
          console.log(`✅ [EOD] Slack message sent for ${user.name}`);
        } else {
          const errorText = await res.text().catch(() => "unknown");
          console.error(`[EOD] Slack send failed: ${res.status} ${errorText}`);
          slackFailed = true;
        }
      }
    } catch (slackErr) {
      console.error("[EOD] Slack send error:", slackErr);
      slackFailed = true;
    }

    // Update report status
    await prisma.editorEodReport.update({
      where: { id: report.id },
      data: {
        status: slackFailed ? "FAILED" : "SENT",
        slackTs: slackTs,
      },
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      taskCount: reportItems.length,
      slackSent: !slackFailed,
    });
  } catch (err: any) {
    console.error("[EOD Send] Error:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message },
      { status: 500 }
    );
  }
}