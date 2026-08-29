export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import { task as taskTable, client as clientTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendReviewReminder, TaskInReview } from '@/lib/client-review-reminders';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

function daysSince(iso: string | null): number {
    if (!iso) return 0;
    const ms = Date.now() - new Date(iso).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// POST /api/tasks/[id]/send-review-reminder — the manual "Send Reminder to
// Client" button. Always sends regardless of the automated rule's 3-day
// cooldown, since this is an explicit human decision, not the auto-rule.
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const db = getDbHttp();
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

        try {
            jwt.verify(token, process.env.JWT_SECRET!);
        } catch {
            return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const [row] = await db
            .select({
                id: taskTable.id,
                title: taskTable.title,
                clientId: taskTable.clientId,
                clientName: clientTable.name,
                status: taskTable.status,
                clientReviewStartedAt: taskTable.clientReviewStartedAt,
                lastReminderSentAt: taskTable.lastReminderSentAt,
                dueDate: taskTable.dueDate,
            })
            .from(taskTable)
            .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
            .where(eq(taskTable.id, id))
            .limit(1);

        if (!row) return NextResponse.json({ ok: false, message: 'Task not found' }, { status: 404 });
        if (row.status !== 'CLIENT_REVIEW') {
            return NextResponse.json({ ok: false, message: 'Task is not currently in client review' }, { status: 400 });
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'https://e8productions.com';
        const taskForEmail: TaskInReview = {
            id: row.id,
            title: row.title,
            clientId: row.clientId,
            clientName: row.clientName || 'Unknown Client',
            daysInReview: daysSince(row.clientReviewStartedAt),
            clientReviewStartedAt: row.clientReviewStartedAt,
            lastReminderSentAt: row.lastReminderSentAt,
            reviewUrl: `${baseUrl}/dashboard`,
            dueDate: row.dueDate,
        };

        const result = await sendReviewReminder([taskForEmail]);
        if (!result.success) {
            return NextResponse.json({ ok: false, message: result.error || 'Failed to send reminder' }, { status: 502 });
        }

        return NextResponse.json({ ok: true, sentTo: result.sentTo });
    } catch (err: any) {
        console.error('[POST send-review-reminder]', err);
        if (err?.cause) console.error('Root cause:', err.cause);
        return NextResponse.json({ ok: false, message: err?.cause?.message || 'Server error' }, { status: 500 });
    }
}