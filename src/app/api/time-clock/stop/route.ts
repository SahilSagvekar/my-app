// FILE: src/app/api/time-clock/stop/route.ts
// New file. Clocks the logged-in user out for "today" (EST calendar date).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { getESTDateString } from "@/lib/est-date";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workDate = getESTDateString();
    const now = new Date();

    const existing = await prisma.timeClockEntry.findUnique({
      where: { userId_workDate: { userId: user.id, workDate } },
    });

    if (!existing) {
      return NextResponse.json({ error: "You haven't clocked in today" }, { status: 400 });
    }

    if (existing.clockOutAt) {
      return NextResponse.json(
        { error: "You've already clocked out today", clockOutAt: existing.clockOutAt },
        { status: 409 }
      );
    }

    const entry = await prisma.timeClockEntry.update({
      where: { userId_workDate: { userId: user.id, workDate } },
      data: { clockOutAt: now },
    });

    return NextResponse.json({
      status: "clocked_out",
      clockInAt: entry.clockInAt,
      clockOutAt: entry.clockOutAt,
    });
  } catch (err: any) {
    console.error("❌ /api/time-clock/stop error:", err.message);
    return NextResponse.json({ error: "Failed to clock out" }, { status: 500 });
  }
}