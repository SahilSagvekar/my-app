import { NextRequest, NextResponse } from 'next/server';
import { sendScreenshotAlertEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
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
