// FILE: src/app/api/time-clock/start/route.ts
// New file. Clocks the logged-in user in for "today" (EST calendar date).
// Rejects if today's entry already exists (enforces one start/stop per day
// via the @@unique([userId, workDate]) constraint too, as a DB-level backstop).

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

    // Admins don't clock in/out.
    if (user.role?.toLowerCase() === "admin") {
      return NextResponse.json({ error: "Admins do not use the time clock" }, { status: 403 });
    }

    const workDate = getESTDateString();
    const now = new Date();

    const existing = await prisma.timeClockEntry.findUnique({
      where: { userId_workDate: { userId: user.id, workDate } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You've already clocked in today", clockInAt: existing.clockInAt },
        { status: 409 }
      );
    }

    const entry = await prisma.timeClockEntry.create({
      data: {
        userId: user.id,
        workDate,
        clockInAt: now,
      },
    });

    return NextResponse.json({ status: "clocked_in", clockInAt: entry.clockInAt });
  } catch (err: any) {
    // Race condition: two rapid clicks both pass the findUnique check.
    // The @@unique constraint on [userId, workDate] catches it here.
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "You've already clocked in today" }, { status: 409 });
    }
    console.error("❌ /api/time-clock/start error:", err.message);
    return NextResponse.json({ error: "Failed to clock in" }, { status: 500 });
  }
}