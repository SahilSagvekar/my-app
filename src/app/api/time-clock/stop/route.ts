// FILE: src/app/api/time-clock/stop/route.ts
// Clocks the logged-in user out for "today" (EST calendar date).
// Uses Drizzle/Neon HTTP — Prisma's native query engine does not run on Cloudflare Workers.

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { timeClockEntry } from "@/lib/db/schema";
import { getCurrentUser2 } from "@/lib/auth";
import { dbTimestampToIso, getESTDateString } from "@/lib/est-date";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workDate = getESTDateString();
    const now = new Date().toISOString();
    const db = getDbHttp();

    const [existing] = await db
      .select()
      .from(timeClockEntry)
      .where(and(eq(timeClockEntry.userId, user.id), eq(timeClockEntry.workDate, workDate)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "You haven't clocked in today" }, { status: 400 });
    }

    if (existing.clockOutAt) {
      return NextResponse.json(
        { error: "You've already clocked out today", clockOutAt: dbTimestampToIso(existing.clockOutAt) },
        { status: 409 }
      );
    }

    const [entry] = await db
      .update(timeClockEntry)
      .set({ clockOutAt: now, updatedAt: now })
      .where(and(eq(timeClockEntry.userId, user.id), eq(timeClockEntry.workDate, workDate)))
      .returning();

    return NextResponse.json({
      status: "clocked_out",
      clockInAt: dbTimestampToIso(entry.clockInAt),
      clockOutAt: dbTimestampToIso(entry.clockOutAt!),
    });
  } catch (err: any) {
    console.error("❌ /api/time-clock/stop error:", err.message);
    return NextResponse.json({ error: "Failed to clock out" }, { status: 500 });
  }
}
