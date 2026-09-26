// FILE: src/app/api/admin/production-tracker/time-clock/route.ts
// Feeds the "Time Clock" tab in Production Tracker.
//
// mode=day (default) — for a given EST calendar date, returns every user who
// clocked in that day, each with a merged, chronologically-sorted timeline of:
//   - clock in / clock out events
//   - their TASK_STATUS_CHANGED (and related) AuditLog events that day
//
// mode=week / mode=month — returns each user's total minutes worked and a
// per-day breakdown across the EST week/month containing `date` (no task
// AuditLog merge at this granularity — that stays a per-day drill-down,
// available by re-querying mode=day with one of the returned dates).
//
// GET /api/admin/production-tracker/time-clock?date=2026-09-25
// GET /api/admin/production-tracker/time-clock?mode=week&date=2026-09-25
// GET /api/admin/production-tracker/time-clock?mode=month&date=2026-09-25
// Uses Drizzle/Neon HTTP — Prisma's native query engine does not run on Cloudflare Workers.

import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { auditLog, timeClockEntry, user as userTable } from "@/lib/db/schema";
import { getCurrentUser2 } from "@/lib/auth";
import {
  dbTimestampToDate,
  dbTimestampToIso,
  getESTDate,
  getESTDateString,
  getESTMonthBounds,
  getESTWeekBounds,
} from "@/lib/est-date";

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
    if (!user || !["admin", "manager", "scheduler", "videographer"].includes(user.role?.toLowerCase() || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // "YYYY-MM-DD" in EST, optional
    const mode = searchParams.get("mode") === "week" || searchParams.get("mode") === "month"
      ? (searchParams.get("mode") as "week" | "month")
      : "day";
    const db = getDbHttp();

    if (mode === "week" || mode === "month") {
      const anchor = dateParam ? `${dateParam}T12:00:00` : undefined;
      const bounds = mode === "week" ? getESTWeekBounds(anchor) : getESTMonthBounds(anchor);
      const rangeStart = getESTDateString(bounds.start.toISOString());
      const rangeEnd = getESTDateString(bounds.end.toISOString());

      const entries = await db
        .select({
          userId: timeClockEntry.userId,
          workDate: timeClockEntry.workDate,
          clockInAt: timeClockEntry.clockInAt,
          clockOutAt: timeClockEntry.clockOutAt,
          autoClosedOut: timeClockEntry.autoClosedOut,
          userName: userTable.name,
          userEmail: userTable.email,
          userRole: userTable.role,
        })
        .from(timeClockEntry)
        .innerJoin(userTable, eq(timeClockEntry.userId, userTable.id))
        .where(and(gte(timeClockEntry.workDate, rangeStart), lte(timeClockEntry.workDate, rangeEnd)))
        .orderBy(asc(timeClockEntry.userId), asc(timeClockEntry.workDate));

      const now = new Date();
      const byUser = new Map<
        number,
        { name: string; role: string | null; days: Array<{
          date: string;
          minutes: number;
          clockInAt: string;
          clockOutAt: string | null;
          autoClosedOut: boolean;
          stillClockedIn: boolean;
        }> }
      >();

      for (const e of entries) {
        if (!byUser.has(e.userId)) {
          byUser.set(e.userId, { name: e.userName || e.userEmail, role: e.userRole, days: [] });
        }
        const clockIn = dbTimestampToDate(e.clockInAt);
        const clockOut = e.clockOutAt ? dbTimestampToDate(e.clockOutAt) : now;
        const minutes = Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));
        byUser.get(e.userId)!.days.push({
          date: e.workDate,
          minutes,
          clockInAt: dbTimestampToIso(e.clockInAt),
          clockOutAt: e.clockOutAt ? dbTimestampToIso(e.clockOutAt) : null,
          autoClosedOut: e.autoClosedOut,
          stillClockedIn: !e.clockOutAt,
        });
      }

      const people = Array.from(byUser.entries())
        .map(([userId, v]) => ({
          userId,
          name: v.name,
          role: v.role,
          totalMinutes: v.days.reduce((sum, d) => sum + d.minutes, 0),
          daysWorked: v.days.length,
          days: v.days.sort((a, b) => (a.date < b.date ? -1 : 1)),
        }))
        .sort((a, b) => b.totalMinutes - a.totalMinutes);

      return NextResponse.json({ mode, rangeStart, rangeEnd, people });
    }

    const workDate = dateParam || getESTDateString();
    const { start, end } = getESTDate(dateParam ? `${dateParam}T12:00:00` : undefined);

    // 1. Everyone who clocked in that day.
    const entries = await db
      .select({
        id: timeClockEntry.id,
        userId: timeClockEntry.userId,
        workDate: timeClockEntry.workDate,
        clockInAt: timeClockEntry.clockInAt,
        clockOutAt: timeClockEntry.clockOutAt,
        autoClosedOut: timeClockEntry.autoClosedOut,
        userName: userTable.name,
        userEmail: userTable.email,
        userRole: userTable.role,
      })
      .from(timeClockEntry)
      .innerJoin(userTable, eq(timeClockEntry.userId, userTable.id))
      .where(eq(timeClockEntry.workDate, workDate))
      .orderBy(asc(timeClockEntry.clockInAt));

    if (entries.length === 0) {
      return NextResponse.json({ date: workDate, people: [] });
    }

    const userIds = entries.map((e) => e.userId);

    // 2. Their task activity for the same EST day.
    const auditLogs = await db
      .select()
      .from(auditLog)
      .where(
        and(
          inArray(auditLog.userId, userIds),
          inArray(auditLog.action, TASK_ACTIVITY_ACTIONS),
          gte(auditLog.timestamp, start.toISOString()),
          lte(auditLog.timestamp, end.toISOString()),
        ),
      )
      .orderBy(asc(auditLog.timestamp));

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
        at: dbTimestampToIso(entry.clockInAt),
        type: "clock_in",
        label: "Clocked in",
      });

      for (const log of auditByUser.get(entry.userId) || []) {
        timeline.push({
          at: dbTimestampToIso(log.timestamp),
          type: "task_event",
          label: describeAuditEvent(log),
        });
      }

      if (entry.clockOutAt) {
        timeline.push({
          at: dbTimestampToIso(entry.clockOutAt),
          type: entry.autoClosedOut ? "clock_out_auto" : "clock_out",
          label: entry.autoClosedOut
            ? "Clocked out automatically (missed stop)"
            : "Clocked out",
        });
      }

      timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

      return {
        userId: entry.userId,
        name: entry.userName || entry.userEmail,
        role: entry.userRole,
        clockInAt: dbTimestampToIso(entry.clockInAt),
        clockOutAt: entry.clockOutAt ? dbTimestampToIso(entry.clockOutAt) : null,
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
