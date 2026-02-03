// src/app/api/cron/youtube-sync/route.ts
// Daily cron job to sync all YouTube channels
//
// SETUP OPTIONS:
//
// Option 1: Use node-cron in your PM2 process (since you're on EC2)
//   - See the cron-setup.ts file below
//
// Option 2: Hit this endpoint from a system cron
//   - Add to crontab: 0 3 * * * curl -X POST https://yourdomain.com/api/cron/youtube-sync -H "Authorization: Bearer YOUR_CRON_SECRET"
//
// Option 3: If you move to Vercel, use Vercel Cron Jobs
//   - Add to vercel.json: { "crons": [{ "path": "/api/cron/youtube-sync", "schedule": "0 3 * * *" }] }

import { NextRequest, NextResponse } from "next/server";
import { syncAllChannels } from "@/lib/youtube";

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[YouTube Cron] Starting daily sync...");

    const results = await syncAllChannels();

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `[YouTube Cron] Completed: ${succeeded} succeeded, ${failed} failed`
    );

    return NextResponse.json({
      message: "Sync completed",
      total: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (error: any) {
    console.error("[YouTube Cron] Error:", error);
    return NextResponse.json(
      { error: "Cron sync failed" },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron jobs
export async function GET(req: NextRequest) {
  return POST(req);
}