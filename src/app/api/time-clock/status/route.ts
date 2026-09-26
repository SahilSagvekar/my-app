// FILE: src/app/api/time-clock/status/route.ts
// Returns today's (EST) clock entry for the logged-in user, if any.
// Drives the header button's state on load/refresh.
// Uses Drizzle/Neon HTTP — Prisma's native query engine does not run on Cloudflare Workers.

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { timeClockEntry } from "@/lib/db/schema";
import { getCurrentUser2 } from "@/lib/auth";
import { dbTimestampToIso, getESTDateString } from "@/lib/est-date";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workDate = getESTDateString();
    const db = getDbHttp();

    const [entry] = await db
      .select()
      .from(timeClockEntry)
      .where(and(eq(timeClockEntry.userId, user.id), eq(timeClockEntry.workDate, workDate)))
      .limit(1);

    if (!entry) {
      return NextResponse.json({ status: "not_started" });
    }

    if (!entry.clockOutAt) {
      return NextResponse.json({
        status: "clocked_in",
        clockInAt: dbTimestampToIso(entry.clockInAt),
      });
    }

    return NextResponse.json({
      status: "clocked_out",
      clockInAt: dbTimestampToIso(entry.clockInAt),
      clockOutAt: dbTimestampToIso(entry.clockOutAt),
      autoClosedOut: entry.autoClosedOut,
    });
  } catch (err: any) {
    console.error("❌ /api/time-clock/status error:", err.message);
    return NextResponse.json({ error: "Failed to load time-clock status" }, { status: 500 });
  }
}
