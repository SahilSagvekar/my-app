export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { sendCronReportEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
    try {
        const cronSecret = req.headers.get('x-cron-secret');
        if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { results, timestamp } = body;

        if (!results || !Array.isArray(results)) {
            return NextResponse.json({ message: "Invalid results format" }, { status: 400 });
        }

        await sendCronReportEmail({ results, timestamp: timestamp || new Date().toISOString() });

        return NextResponse.json({ success: true, message: "Report email triggered" });
    } catch (error: any) {
        console.error("❌ API /api/reports/cron-email error:", error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
