// FILE: src/app/api/cron/close-open-time-clocks/route.ts
// New file. Nightly job — closes out anyone who forgot to click Stop.
// Called by cron-master.ts at 11:55 PM America/New_York, or manually by an admin.
// Auth pattern copied from your existing
// src/app/api/cron/scheduler-activity-rollup/route.ts for consistency.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { getESTDateString } from "@/lib/est-date";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  const cookieHeader = req.headers.get("cookie");
  const match = cookieHeader?.match(/authToken=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
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
    const workDate = getESTDateString();
    const now = new Date();

    const result = await prisma.timeClockEntry.updateMany({
      where: { workDate, clockOutAt: null },
      data: { clockOutAt: now, autoClosedOut: true },
    });

    return NextResponse.json({ ok: true, closed: result.count });
  } catch (err: any) {
    console.error("❌ /api/cron/close-open-time-clocks error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}