export const dynamic = 'force-dynamic';

// src/app/api/admin/scheduler-activity/route.ts
//
// GET (no drilldown)  -> daily summaries for all scheduler-role users,
//                        last N days. Always queries the summary table,
//                        never the raw event table — stays fast regardless
//                        of how much raw data has piled up.
// GET ?userId&date     -> raw event timeline for one user's one day
//                        (only meaningful within the 30-day raw retention
//                        window; older days only have the summary row).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');

    // Drill-down: raw event timeline for one user, one day
    if (userId && date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const events = await prisma.schedulerActivityEvent.findMany({
        where: { userId: Number(userId), timestamp: { gte: dayStart, lt: dayEnd } },
        orderBy: { timestamp: 'asc' },
        take: 5000, // hard cap — a single day should never legitimately exceed this
      });

      return NextResponse.json({ events });
    }

    // Summary list — every scheduler, last N days
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const schedulers = await prisma.user.findMany({
      where: { role: 'scheduler' },
      select: { id: true, name: true, email: true },
    });

    const summaries = await prisma.schedulerActivityDailySummary.findMany({
      where: { userId: { in: schedulers.map((s) => s.id) }, date: { gte: since } },
      orderBy: [{ userId: 'asc' }, { date: 'desc' }],
    });

    return NextResponse.json({
      schedulers,
      summaries,
      rawRetentionNote: 'Raw click-level events are only queryable for the last 30 days; older days only have the daily summary.',
    });
  } catch (err: any) {
    console.error('[admin/scheduler-activity] error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}