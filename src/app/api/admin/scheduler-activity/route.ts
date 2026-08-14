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
import { getDbHttp } from '@/lib/db';
import {
  user as userTable,
  schedulerActivityEvent as schedulerActivityEventTable,
  schedulerActivityDailySummary as schedulerActivityDailySummaryTable,
} from '@/lib/db/schema';
import { and, or, eq, gte, lt, inArray, asc, desc, sql as drizzleSql } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { computeActivityStats, startOfUTCDay } from '@/lib/scheduler-activity-rollup';

export async function GET(req: NextRequest) {
  const db = getDbHttp();
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

      const events = await db.select().from(schedulerActivityEventTable)
        .where(and(
          eq(schedulerActivityEventTable.userId, Number(userId)),
          gte(schedulerActivityEventTable.timestamp, dayStart.toISOString()),
          lt(schedulerActivityEventTable.timestamp, dayEnd.toISOString()),
        ))
        .orderBy(asc(schedulerActivityEventTable.timestamp))
        .limit(5000); // hard cap — a single day should never legitimately exceed this

      return NextResponse.json({ events });
    }

    // Summary list — every scheduler, last N days
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const schedulers = await db.select({ id: userTable.id, name: userTable.name, email: userTable.email })
      .from(userTable)
      .where(or(eq(userTable.role, 'scheduler' as any), drizzleSql`${userTable.roles} @> ARRAY['scheduler']`));

    const summaries = schedulers.length > 0
      ? await db.select().from(schedulerActivityDailySummaryTable)
          .where(and(
            inArray(schedulerActivityDailySummaryTable.userId, schedulers.map((s) => s.id)),
            gte(schedulerActivityDailySummaryTable.date, since.toISOString()),
          ))
          .orderBy(asc(schedulerActivityDailySummaryTable.userId), desc(schedulerActivityDailySummaryTable.date))
      : [];

    // Today never has a summary row yet (that only gets written by tonight's
    // rollup) — compute it live instead, straight from raw events. Bounded
    // to "today, per scheduler" so it stays cheap even as the raw table
    // grows over the day.
    const todayStart = startOfUTCDay(new Date());
    const todayLive = await Promise.all(
      schedulers.map(async (s) => {
        const events = await db.select().from(schedulerActivityEventTable)
          .where(and(eq(schedulerActivityEventTable.userId, s.id), gte(schedulerActivityEventTable.timestamp, todayStart.toISOString())))
          .orderBy(asc(schedulerActivityEventTable.timestamp));
        return { userId: s.id, date: todayStart.toISOString(), ...computeActivityStats(events) };
      })
    );

    return NextResponse.json({
      schedulers,
      summaries,
      todayLive,
      rawRetentionNote: 'Raw click-level events are only queryable for the last 30 days; older days only have the daily summary.',
    });
  } catch (err: any) {
    console.error('[admin/scheduler-activity] error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}