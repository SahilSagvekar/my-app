// src/app/api/cron/meta-sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MetaService } from "@/lib/meta";

export async function GET(req: NextRequest) {
    // Verify cron secret for security
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;
    const querySecret = new URL(req.url).searchParams.get("secret");

    if (expectedSecret && cronSecret !== expectedSecret && querySecret !== expectedSecret) {
        // In production, strictly enforce secret
        if (process.env.NODE_ENV === "production") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    console.log("[Meta Cron] Starting daily sync...");

    try {
        const results = await MetaService.syncAllAccounts();
        console.log(`[Meta Cron] Sync completed for ${results.length} accounts.`);

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        });
    } catch (error: any) {
        console.error("[Meta Cron] Sync failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
