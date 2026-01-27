// app/api/reports/activity/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl, extractS3KeyFromUrl } from '@/lib/s3';
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

        const url = new URL(req.url);
        const reportId = url.searchParams.get('id');

        if (!reportId) {
            return NextResponse.json({ message: "Report ID required" }, { status: 400 });
        }

        const report = await prisma.activityReport.findUnique({
            where: { id: reportId }
        });

        if (!report || !report.fileUrl) {
            return NextResponse.json({ message: "Report not found" }, { status: 404 });
        }

        const s3Key = extractS3KeyFromUrl(report.fileUrl);
        if (!s3Key) {
            return NextResponse.json({ message: "Invalid file URL" }, { status: 500 });
        }

        // Generate a 15-minute signed URL
        const signedUrl = await generateSignedUrl(s3Key, 900);

        return NextResponse.redirect(signedUrl);
    } catch (error: any) {
        console.error('Download error:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
