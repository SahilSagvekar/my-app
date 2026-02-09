// src/app/api/cron/meta-sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MetaService } from "@/lib/meta";

export async function GET(req: NextRequest) {
    // Check CRON_SECRET for security
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Also check for a secret in query for easy testing
        const secret = new URL(req.url).searchParams.get("secret");
        if (secret !== process.env.CRON_SECRET) {
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
