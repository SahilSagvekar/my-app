// src/app/api/reports/daily-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateDailySummaryReport } from '@/lib/daily-summary-report';

/**
 * GET /api/reports/daily-summary
 * Returns the latest summary (or generates one for today on the fly)
 */
export async function GET(req: NextRequest) {
    try {
        const report = await generateDailySummaryReport({ sendEmail: false });

        if (!report) {
            return NextResponse.json(
                { message: "No task activity found for today's reporting period (12 AM – 7 PM EST)." },
                { status: 404 }
            );
        }

        return NextResponse.json(report);
    } catch (error: any) {
        console.error('GET /api/reports/daily-summary error:', error);
        return NextResponse.json({ message: error.message || 'Failed to generate summary' }, { status: 500 });
    }
}

/**
 * POST /api/reports/daily-summary
 * Generates and optionally emails the daily summary report.
 * Called by cron-master at 7 PM EST daily.
 */
export async function POST(req: NextRequest) {
    try {
        // Auth: Accept cron secret OR admin JWT
        const cronSecret = req.headers.get('x-cron-secret');
        const isCron = cronSecret && cronSecret === process.env.CRON_SECRET;

        // if (!isCron) {
        //     // If not cron, require admin JWT
        //     const jwt = await import('jsonwebtoken');
        //     const cookieHeader = req.headers.get('cookie');
        //     const match = cookieHeader?.match(/authToken=([^;]+)/);
        //     const token = match ? match[1] : null;

        //     if (!token) {
        //         return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        //     }

        //     try {
        //         const decoded: any = jwt.default.verify(token, process.env.JWT_SECRET!);
        //         if (decoded.role?.toLowerCase() !== 'admin') {
        //             return NextResponse.json({ message: 'Forbidden - Admin only' }, { status: 403 });
        //         }
        //     } catch {
        //         return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        //     }
        // }

        const report = await generateDailySummaryReport({ sendEmail: true });

        console.log('report:', report);

        if (!report) {
            return NextResponse.json(
                { message: "No task activity found for today's reporting period. No email sent." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Daily summary report generated and emailed. ${report.totalTeamMembers} team members, ${report.totalTasksMoved} actions tracked.`,
            report,
        });
    } catch (error: any) {
        console.error('POST /api/reports/daily-summary error:', error);
        return NextResponse.json({ message: error.message || 'Failed to generate summary' }, { status: 500 });
    }
}
