import { NextResponse } from "next/server";
import { runSlackScheduledJob } from "@/lib/slack-scheduled-jobs";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    console.log("[Cron] Running TDBS Guests filming reminder...");
    const result = await runSlackScheduledJob("tdbs_filming_reminder");

    if (result.skipped) {
      console.log(`[Cron] TDBS Guests reminder skipped: ${result.reason}`);
      return NextResponse.json({ success: true, skipped: true, reason: result.reason }, { status: 200 });
    }

    console.log(`[Cron] TDBS Guests reminder sent: ${result.delivery?.succeeded}/${result.delivery?.attempted} webhooks succeeded`);
    return NextResponse.json({ success: true, delivery: result.delivery }, { status: 200 });
  } catch (error: any) {
    console.error("[Cron] Error sending TDBS Guests notification:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}