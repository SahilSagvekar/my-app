// FILE: src/app/api/cron/close-open-time-clocks/route.ts
// Nightly job — closes out anyone who forgot to click Stop.
// Called by Cloudflare Cron Triggers (worker.ts) ≈ 11:55 PM America/New_York,
// or manually by an admin.
// Uses Drizzle/Neon HTTP — Prisma's native query engine does not run on Cloudflare Workers.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { timeClockEntry } from "@/lib/db/schema";
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
    const now = new Date().toISOString();
    const db = getDbHttp();

    const closed = await db
      .update(timeClockEntry)
      .set({ clockOutAt: now, autoClosedOut: true, updatedAt: now })
      .where(and(eq(timeClockEntry.workDate, workDate), isNull(timeClockEntry.clockOutAt)))
      .returning({ id: timeClockEntry.id });

    return NextResponse.json({ ok: true, closed: closed.length });
  } catch (err: any) {
    console.error("❌ /api/cron/close-open-time-clocks error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
