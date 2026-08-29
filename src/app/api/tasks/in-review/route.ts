export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getTasksInReview } from '@/lib/client-review-reminders';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// GET /api/tasks/in-review?scope=scheduler|qc
// Both scopes currently return the same company-wide list — `scope` is
// accepted (and required to be a recognized value) so per-person filtering
// can be added later without an API shape change.
export async function GET(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        try {
            jwt.verify(token, process.env.JWT_SECRET!);
        } catch {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const scope = req.nextUrl.searchParams.get('scope');
        if (scope && scope !== 'scheduler' && scope !== 'qc') {
            return NextResponse.json({ ok: false, message: "scope must be 'scheduler' or 'qc'" }, { status: 400 });
        }

        const tasks = await getTasksInReview();
        return NextResponse.json({ ok: true, tasks });
    } catch (err: any) {
        console.error('[GET /api/tasks/in-review]', err);
        if (err?.cause) console.error('Root cause:', err.cause);
        return NextResponse.json({ ok: false, message: err?.cause?.message || 'Server error' }, { status: 500 });
    }
}