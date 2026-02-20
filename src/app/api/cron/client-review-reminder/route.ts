// src/app/api/cron/client-review-reminder/route.ts
//
// Schedule: once daily (e.g. 9 AM UTC)
// Vercel cron:  "0 9 * * *"
// External cron: just GET this URL with x-cron-secret header
//
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendClientReviewReminderEmail } from '@/lib/email';

const THRESHOLD_DAYS = 4;
const APP_URL =
    process.env.BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'https://e8productions.com';

/* ── Helper: resolve all addressable emails for a client ─────── */
async function getClientEmails(clientId: string): Promise<string[]> {
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
            email: true,
            emails: true,
            user: { select: { email: true, emailNotifications: true } },
            linkedUsers: { select: { email: true, emailNotifications: true } },
        },
    });

    if (!client) return [];

    const blocked = new Set<string>();
    const allUsers = [
        ...(client.user ? [client.user] : []),
        ...(client.linkedUsers ?? []),
    ];

    for (const u of allUsers) {
        if (u.emailNotifications === false && u.email) {
            blocked.add(u.email.trim().toLowerCase());
        }
    }

    const result = new Set<string>();

    // Primary client email
    if (client.email && !blocked.has(client.email.trim().toLowerCase())) {
        result.add(client.email.trim());
    }

    // Additional emails array
    for (const e of client.emails ?? []) {
        if (e?.trim() && !blocked.has(e.trim().toLowerCase())) {
            result.add(e.trim());
        }
    }

    // Linked user emails with notifications enabled
    for (const u of allUsers) {
        if (u.email?.trim() && u.emailNotifications !== false) {
            result.add(u.email.trim());
        }
    }

    return Array.from(result);
}

/* ── Main handler ─────────────────────────────────────────────── */
export async function GET(req: Request) {
    // ── Auth: require CRON_SECRET in production ───────────────
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && cronSecret !== expectedSecret) {
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    console.log('\n⏰ [client-review-reminder] Starting run…');

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - THRESHOLD_DAYS);

    // ── Find all CLIENT_REVIEW tasks older than threshold ─────
    const overdueTasks = await prisma.task.findMany({
        where: {
            status: 'CLIENT_REVIEW',
            updatedAt: { lte: thresholdDate },
            clientId: { not: null },
        },
        select: {
            id: true,
            title: true,
            updatedAt: true,
            clientId: true,
            client: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: { updatedAt: 'asc' },
    });

    console.log(
        `   Found ${overdueTasks.length} overdue task(s) in CLIENT_REVIEW`,
    );

    if (overdueTasks.length === 0) {
        return NextResponse.json({
            success: true,
            message: 'No overdue CLIENT_REVIEW tasks found.',
            tasksProcessed: 0,
            emailsSent: 0,
            timestamp: new Date().toISOString(),
        });
    }

    // ── Group by client ───────────────────────────────────────
    const byClient = new Map<
        string,
        {
            clientId: string;
            clientName: string;
            tasks: Array<{ id: string; title: string; daysInReview: number; dashboardUrl: string }>;
        }
    >();

    const now = Date.now();

    for (const task of overdueTasks) {
        if (!task.clientId || !task.client) continue;

        const daysInReview = Math.floor(
            (now - task.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        const entry = byClient.get(task.clientId) ?? {
            clientId: task.clientId,
            clientName: task.client.name,
            tasks: [],
        };

        entry.tasks.push({
            id: task.id,
            title: task.title ?? 'Untitled Task',
            daysInReview,
            // Deep link – clients land on dashboard; internal users can navigate from there
            dashboardUrl: `${APP_URL}/dashboard`,
        });

        byClient.set(task.clientId, entry);
    }

    // ── Send one email per client group ───────────────────────
    let totalEmailsSent = 0;
    const results: Array<{
        clientName: string;
        taskCount: number;
        emailsAttempted: number;
        emailsSent: number;
    }> = [];

    for (const group of byClient.values()) {
        const clientEmails = await getClientEmails(group.clientId);

        console.log(
            `   Sending reminder for ${group.clientName} (${group.tasks.length} task(s)) → ${clientEmails.join(', ')}`,
        );

        const { sent, total } = await sendClientReviewReminderEmail({
            clientName: group.clientName,
            clientEmails,
            tasks: group.tasks,
        });

        totalEmailsSent += sent;
        results.push({
            clientName: group.clientName,
            taskCount: group.tasks.length,
            emailsAttempted: total ?? 0,
            emailsSent: sent,
        });
    }

    console.log(
        `✅ [client-review-reminder] Done. ${totalEmailsSent} email(s) sent across ${byClient.size} client(s).\n`,
    );

    return NextResponse.json({
        success: true,
        tasksProcessed: overdueTasks.length,
        clientsNotified: byClient.size,
        emailsSent: totalEmailsSent,
        results,
        timestamp: new Date().toISOString(),
    });
}

// Allow POST as well (for manual triggers)
export async function POST(req: Request) {
    return GET(req);
}
