// FILE: src/app/api/time-clock/status/route.ts
// New file. Returns today's (EST) clock entry for the logged-in user, if any.
// Drives the header button's state on load/refresh.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { getESTDateString } from "@/lib/est-date";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workDate = getESTDateString();

    const entry = await prisma.timeClockEntry.findUnique({
      where: { userId_workDate: { userId: user.id, workDate } },
    });

    if (!entry) {
      return NextResponse.json({ status: "not_started" });
    }

    if (!entry.clockOutAt) {
      return NextResponse.json({
        status: "clocked_in",
        clockInAt: entry.clockInAt,
      });
    }

    return NextResponse.json({
      status: "clocked_out",
      clockInAt: entry.clockInAt,
      clockOutAt: entry.clockOutAt,
      autoClosedOut: entry.autoClosedOut,
    });
  } catch (err: any) {
    console.error("❌ /api/time-clock/status error:", err.message);
    return NextResponse.json({ error: "Failed to load time-clock status" }, { status: 500 });
  }
}