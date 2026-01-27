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
        if (cronSecret && cronSecret === process.env.CRON_SECRET) {
            // Authorized via cron secret
        } else {
            const token = getTokenFromCookies(req);
            if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

            const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
            if (decoded.role !== 'admin') {
                return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            }
        }

        const report = await generateDailyActivityReport();
        return NextResponse.json(report);
    } catch (error: any) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
