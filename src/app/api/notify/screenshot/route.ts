export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        let body: { email?: string } = {};
        if (rawBody) {
            try {
                body = JSON.parse(rawBody) as { email?: string };
            } catch {
                body = {};
            }
        }
        const { email } = body;

        const userAgent = req.headers.get('user-agent') || 'Unknown';
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown';
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });

        // await sendScreenshotAlertEmail({
        //     email: email || null,
        //     userAgent,
        //     ip: String(ip),
        //     timestamp,
        // });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Screenshot notification error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
