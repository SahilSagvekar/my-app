// FILE: src/app/api/time-clock/start/route.ts
// Clocks the logged-in user in for "today" (EST calendar date).
// Rejects if today's entry already exists (enforces one start/stop per day
// via the unique([userId, workDate]) constraint too, as a DB-level backstop).
// Uses Drizzle/Neon HTTP — Prisma's native query engine does not run on Cloudflare Workers.

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { timeClockEntry, client as clientTable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { getCurrentUser2 } from "@/lib/auth";
import { dbTimestampToIso, formatEasternTime, getESTDateString } from "@/lib/est-date";
import { usesTimeClock } from "@/lib/time-clock-access";
import { sendClientSlackWebhook, sendToChannel } from "@/lib/slack";

const MAX_REPORT_LENGTH = 3000;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admins don't clock in/out.
    if (!usesTimeClock(user)) {
      return NextResponse.json({ error: "Admins do not use the time clock" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const clientId = typeof body?.clientId === "string" ? body.clientId : "";
    const report = typeof body?.report === "string" ? body.report.trim() : "";
    if (!clientId || !report) {
      return NextResponse.json({ error: "Select a client and write your start-of-day report" }, { status: 400 });
    }
    if (report.length > MAX_REPORT_LENGTH) {
      return NextResponse.json({ error: `Report is too long (max ${MAX_REPORT_LENGTH} characters)` }, { status: 400 });
    }

    const workDate = getESTDateString();
    const now = new Date().toISOString();
    const db = getDbHttp();

    const [existing] = await db
      .select()
      .from(timeClockEntry)
      .where(and(eq(timeClockEntry.userId, user.id), eq(timeClockEntry.workDate, workDate)))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "You've already clocked in today", clockInAt: dbTimestampToIso(existing.clockInAt) },
        { status: 409 }
      );
    }

    const [entry] = await db
      .insert(timeClockEntry)
      .values({
        id: createId(),
        userId: user.id,
        workDate,
        clockInAt: now,
        updatedAt: now,
      })
      .returning();

    const clockInAt = dbTimestampToIso(entry.clockInAt);
    const personName = user.name || user.email || "Team member";

    // Slack posts are best-effort — a failure here must never undo the clock-in.
    try {
      const [clientRow] = await db
        .select({ name: clientTable.name, companyName: clientTable.companyName })
        .from(clientTable)
        .where(eq(clientTable.id, clientId))
        .limit(1);
      const clientName = clientRow?.companyName || clientRow?.name || "Client";

      await sendClientSlackWebhook(clientId, {
        type: "sod_report",
        message: `:sunrise: *Start-of-day report — ${personName}*\n${report}`,
      });

      await sendToChannel("attendance", {
        type: "attendance_clock_in",
        message: `:sunny: Good morning! *${personName}* clocked in at ${formatEasternTime(clockInAt)} (working on ${clientName}).`,
      });
    } catch (slackErr) {
      console.error("❌ /api/time-clock/start slack error:", slackErr);
    }

    return NextResponse.json({ status: "clocked_in", clockInAt });
  } catch (err: any) {
    // Race condition: two rapid clicks both pass the find check.
    // The unique constraint on [userId, workDate] catches it here (Postgres 23505).
    if (err?.code === "23505") {
      return NextResponse.json({ error: "You've already clocked in today" }, { status: 409 });
    }
    console.error("❌ /api/time-clock/start error:", err.message);
    return NextResponse.json({ error: "Failed to clock in" }, { status: 500 });
  }
}
