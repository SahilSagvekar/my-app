// FILE: src/app/api/cron/flag-long-clock-ins/route.ts
// Every 30 minutes — flags anyone still clocked in after
// FORGOT_CLOCK_OUT_AFTER_HOURS so a manager can check/fix it. Posts once per
// entry to #attendance (flaggedAt makes it idempotent).

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { and, eq, isNull, lt } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { timeClockEntry, user as userTable } from "@/lib/db/schema";
import { dbTimestampToIso, formatEasternTime } from "@/lib/est-date";
import {
  FORGOT_CLOCK_OUT_AFTER_HOURS,
  formatDuration,
  postAttendance,
  roleLabel,
} from "@/lib/time-clock-notify";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) return true;

  const match = req.headers.get("cookie")?.match(/authToken=([^;]+)/);
  if (!match) return false;
  try {
    const decoded: any = jwt.verify(match[1], process.env.JWT_SECRET!);
    return decoded.role?.toLowerCase() === "admin";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDbHttp();
    const now = new Date();
    const cutoff = new Date(now.getTime() - FORGOT_CLOCK_OUT_AFTER_HOURS * 3600_000).toISOString();

    const stale = await db
      .select({
        id: timeClockEntry.id,
        clockInAt: timeClockEntry.clockInAt,
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
      })
      .from(timeClockEntry)
      .innerJoin(userTable, eq(timeClockEntry.userId, userTable.id))
      .where(
        and(
          isNull(timeClockEntry.clockOutAt),
          isNull(timeClockEntry.flaggedAt),
          lt(timeClockEntry.clockInAt, cutoff)
        )
      );

    let flagged = 0;
    for (const e of stale) {
      // Claim first (flaggedAt IS NULL guard) so overlapping runs can't double-post.
      const claimed = await db
        .update(timeClockEntry)
        .set({ flaggedAt: now.toISOString(), updatedAt: now.toISOString() })
        .where(and(eq(timeClockEntry.id, e.id), isNull(timeClockEntry.flaggedAt)))
        .returning({ id: timeClockEntry.id });
      if (!claimed.length) continue;

      const clockInAt = dbTimestampToIso(e.clockInAt);
      await postAttendance(
        "attendance_forgot_clock_out",
        `:warning: *${e.name || e.email}* (${roleLabel(e.role)}) clocked in at ${formatEasternTime(clockInAt)} and is still clocked in after ${formatDuration(clockInAt, now.toISOString())}. Forgot to clock out? A manager should check.`
      );
      flagged++;
    }

    return NextResponse.json({ ok: true, flagged });
  } catch (err: any) {
    console.error("❌ /api/cron/flag-long-clock-ins error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}