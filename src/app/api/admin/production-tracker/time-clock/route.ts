// FILE: src/app/api/admin/production-tracker/time-clock/route.ts
// New file. Feeds the new "Time Clock" tab in Production Tracker.
//
// For a given EST calendar date, returns every user who clocked in that day
// (plus, optionally, everyone else with no entry), each with a merged,
// chronologically-sorted timeline of:
//   - clock in / clock out events
//   - their TASK_STATUS_CHANGED (and related) AuditLog events that day
//
// GET /api/admin/production-tracker/time-clock?date=2026-09-25

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { getESTDate, getESTDateString } from "@/lib/est-date";

// Same audit actions daily-summary-report.ts already treats as "task activity".
const TASK_ACTIVITY_ACTIONS = [
  "TASK_UPDATED",
  "TASK_STATUS_CHANGED",
  "TASK_COMPLETED",
  "TASK_QC_APPROVED",
  "TASK_QC_REJECTED",
  "TASK_CREATED",
  "TASK_ASSIGNED",
  "FILE_UPLOADED",
];

function describeAuditEvent(log: {
  action: string;
  details: string | null;
  metadata: any;
}): string {
  const meta = (log.metadata || {}) as Record<string, any>;
  const title = meta.taskTitle ? ` "${meta.taskTitle}"` : "";

  switch (log.action) {
    case "TASK_STATUS_CHANGED":
    case "TASK_UPDATED":
      if (meta.newStatus) {
        return `Moved task${title} to ${String(meta.newStatus).replace(/_/g, " ")}`;
      }
      return log.details || `Updated task${title}`;
    case "TASK_COMPLETED":
      return `Completed task${title}`;
    case "TASK_QC_APPROVED":
      return `QC approved task${title}`;
    case "TASK_QC_REJECTED":
      return `QC rejected task${title}`;
    case "TASK_CREATED":
      return `Created task${title}`;
    case "TASK_ASSIGNED":
      return `Assigned task${title}`;
    case "FILE_UPLOADED":
      return `Uploaded file${meta.fileName ? ` "${meta.fileName}"` : ""}${title}`;
    default:
      return log.details || log.action;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !["admin", "manager"].includes(user.role?.toLowerCase() || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // "YYYY-MM-DD" in EST, optional
    const workDate = dateParam || getESTDateString();
    const { start, end } = getESTDate(dateParam ? `${dateParam}T12:00:00` : undefined);

    // 1. Everyone who clocked in that day.
    const entries = await prisma.timeClockEntry.findMany({
      where: { workDate },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { clockInAt: "asc" },
    });

    if (entries.length === 0) {
      return NextResponse.json({ date: workDate, people: [] });
    }

    const userIds = entries.map((e) => e.userId);

    // 2. Their task activity for the same EST day.
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        userId: { in: userIds },
        action: { in: TASK_ACTIVITY_ACTIONS },
        timestamp: { gte: start, lte: end },
      },
      orderBy: { timestamp: "asc" },
    });

    const auditByUser = new Map<number, typeof auditLogs>();
    for (const log of auditLogs) {
      if (log.userId == null) continue;
      if (!auditByUser.has(log.userId)) auditByUser.set(log.userId, []);
      auditByUser.get(log.userId)!.push(log);
    }

    // 3. Merge into one timeline per person.
    const people = entries.map((entry) => {
      const timeline: { at: string; type: string; label: string }[] = [];

      timeline.push({
        at: entry.clockInAt.toISOString(),
        type: "clock_in",
        label: "Clocked in",
      });

      for (const log of auditByUser.get(entry.userId) || []) {
        timeline.push({
          at: log.timestamp.toISOString(),
          type: "task_event",
          label: describeAuditEvent(log),
        });
      }

      if (entry.clockOutAt) {
        timeline.push({
          at: entry.clockOutAt.toISOString(),
          type: entry.autoClosedOut ? "clock_out_auto" : "clock_out",
          label: entry.autoClosedOut
            ? "Clocked out automatically (missed stop)"
            : "Clocked out",
        });
      }

      timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

      return {
        userId: entry.userId,
        name: entry.user.name || entry.user.email,
        role: entry.user.role,
        clockInAt: entry.clockInAt.toISOString(),
        clockOutAt: entry.clockOutAt ? entry.clockOutAt.toISOString() : null,
        autoClosedOut: entry.autoClosedOut,
        stillClockedIn: !entry.clockOutAt,
        timeline,
      };
    });

    return NextResponse.json({ date: workDate, people });
  } catch (err: any) {
    console.error("❌ /api/admin/production-tracker/time-clock error:", err.message);
    return NextResponse.json({ error: "Failed to load time clock data" }, { status: 500 });
  }
}