// app/api/reports/activity/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateDailyActivityReport } from '@/lib/activity-report';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: NextRequest) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

export async function GET(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (decoded.role !== 'admin') {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const reports = await prisma.activityReport.findMany({
            orderBy: { generatedAt: 'desc' },
            take: 30
        });

        return NextResponse.json(reports);
    } catch (error: any) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}

/**
 * Manual trigger for report generation
 */
export async function POST(req: NextRequest) {
    try {
        const cronSecret = req.headers.get('x-cron-secret');
        const isCronJob = !!(cronSecret && cronSecret === process.env.CRON_SECRET);

        if (isCronJob) {
            // Authorized via cron secret - will send email
        } else {
            const token = getTokenFromCookies(req);
            if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

            const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
            if (decoded.role !== 'admin') {
                return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            }
        }

        // Only send email when triggered by cron job at 7 PM EST
        const report = await generateDailyActivityReport({
            sendEmail: isCronJob
        });

        // Handle case where no logs found
        if (!report) {
            return NextResponse.json(
                { message: "No activity logs found for today's period. Report cannot be generated." },
                { status: 404 }
            );
        }

        return NextResponse.json(report);
    } catch (error: any) {
        console.error('Report generation error:', error);
        return NextResponse.json({ message: error.message || 'Failed to generate report' }, { status: 500 });
    }
}
