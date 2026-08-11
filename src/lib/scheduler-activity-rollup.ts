// src/lib/scheduler-activity-rollup.ts
//
// Nightly job (wired into cron-master.ts, same pattern as the other
// scheduled jobs there — not a public HTTP endpoint):
//   1. Rolls up yesterday's raw SchedulerActivityEvent rows into one
//      SchedulerActivityDailySummary row per scheduler.
//   2. Prunes raw rows older than RAW_RETENTION_DAYS.
//
// The admin dashboard should only ever query SchedulerActivityDailySummary
// (or recent raw events for a specific day's drill-down) — never scan the
// full raw table, which is exactly the kind of live-full-scan mistake this
// project has already hit once with S3/R2 listings.

import { db } from '@/lib/db';
import {
  schedulerActivityEvent as schedulerActivityEventTable,
  schedulerActivityDailySummary as schedulerActivityDailySummaryTable,
} from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { RAW_RETENTION_DAYS } from '@/lib/scheduler-activity-shared';

export function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface ComputedActivityStats {
  activeMinutes: number;
  idleMinutes: number;
  clickCount: number;
  sessionCount: number;
  firstEventAt: Date | null;
  lastEventAt: Date | null;
}

// Structurally compatible with both Prisma's (pre-migration) SchedulerActivityEvent
// rows (timestamp: Date) and Drizzle's rows (timestamp: string, since the column
// uses mode: 'string') — callers on either side of the migration can pass their
// rows straight through without any shape conversion.
export interface ActivityEventLike {
  eventType: string;
  timestamp: string | Date;
}

const toDate = (t: string | Date): Date => (t instanceof Date ? t : new Date(t));

/**
 * Shared math between the nightly rollup and the admin dashboard's live
 * "today" view — both need the exact same active/idle computation, just
 * over a different (and differently-sized) slice of events.
 */
export function computeActivityStats(events: ActivityEventLike[]): ComputedActivityStats {
  if (events.length === 0) {
    return { activeMinutes: 0, idleMinutes: 0, clickCount: 0, sessionCount: 0, firstEventAt: null, lastEventAt: null };
  }

  const firstEventAt = toDate(events[0].timestamp);
  const lastEventAt = toDate(events[events.length - 1].timestamp);
  const clickCount = events.filter((e) => e.eventType === 'click').length;
  const sessionCount = events.filter((e) => e.eventType === 'session_start').length;

  // Walk idle_start/idle_end pairs chronologically to total up idle time.
  // An idle_start with no matching idle_end (session ended while idle, or
  // — for the live view — she's idle *right now*) counts as idle through
  // lastEventAt.
  let idleMs = 0;
  let openIdleStart: Date | null = null;
  for (const e of events) {
    if (e.eventType === 'idle_start') {
      openIdleStart = toDate(e.timestamp);
    } else if (e.eventType === 'idle_end' && openIdleStart) {
      idleMs += toDate(e.timestamp).getTime() - openIdleStart.getTime();
      openIdleStart = null;
    }
  }
  if (openIdleStart) {
    idleMs += lastEventAt.getTime() - openIdleStart.getTime();
  }

  const totalSpanMs = lastEventAt.getTime() - firstEventAt.getTime();
  const activeMs = Math.max(0, totalSpanMs - idleMs);

  return {
    activeMinutes: Math.round(activeMs / 60000),
    idleMinutes: Math.round(idleMs / 60000),
    clickCount,
    sessionCount,
    firstEventAt,
    lastEventAt,
  };
}

/** Roll up all scheduler activity for one UTC calendar day. */
async function rollupDay(dayStart: Date): Promise<void> {
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dayStartISO = dayStart.toISOString();
  const dayEndISO = dayEnd.toISOString();

  const userIdRows = await db
    .selectDistinct({ userId: schedulerActivityEventTable.userId })
    .from(schedulerActivityEventTable)
    .where(and(gte(schedulerActivityEventTable.timestamp, dayStartISO), lt(schedulerActivityEventTable.timestamp, dayEndISO)));

  for (const { userId } of userIdRows) {
    const events = await db
      .select()
      .from(schedulerActivityEventTable)
      .where(
        and(
          eq(schedulerActivityEventTable.userId, userId),
          gte(schedulerActivityEventTable.timestamp, dayStartISO),
          lt(schedulerActivityEventTable.timestamp, dayEndISO),
        )
      )
      .orderBy(asc(schedulerActivityEventTable.timestamp));
    if (events.length === 0) continue;

    const stats = computeActivityStats(events);

    const values = {
      userId,
      date: dayStartISO,
      activeMinutes: stats.activeMinutes,
      idleMinutes: stats.idleMinutes,
      clickCount: stats.clickCount,
      sessionCount: stats.sessionCount,
      firstEventAt: stats.firstEventAt ? stats.firstEventAt.toISOString() : null,
      lastEventAt: stats.lastEventAt ? stats.lastEventAt.toISOString() : null,
    };

    await db
      .insert(schedulerActivityDailySummaryTable)
      .values({ id: createId(), ...values })
      .onConflictDoUpdate({
        target: [schedulerActivityDailySummaryTable.userId, schedulerActivityDailySummaryTable.date],
        set: values,
      });
  }
}

export async function runSchedulerActivityRollup(): Promise<void> {
  const yesterday = startOfUTCDay(new Date(Date.now() - 24 * 60 * 60 * 1000));

  try {
    await rollupDay(yesterday);
    console.log(`✅ [Scheduler Activity] Rolled up ${yesterday.toISOString().slice(0, 10)}`);
  } catch (err: any) {
    console.error('❌ [Scheduler Activity] Rollup failed:', err.message);
    // Deliberately don't prune below if rollup failed — better to keep raw
    // data an extra day than lose it before it's been summarized.
    return;
  }

  const cutoff = new Date(Date.now() - RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const deleted = await db
      .delete(schedulerActivityEventTable)
      .where(lt(schedulerActivityEventTable.timestamp, cutoff.toISOString()))
      .returning({ id: schedulerActivityEventTable.id });
    const count = deleted.length;
    if (count > 0) {
      console.log(`🧹 [Scheduler Activity] Pruned ${count} raw events older than ${RAW_RETENTION_DAYS} days`);
    }
  } catch (err: any) {
    console.error('❌ [Scheduler Activity] Prune failed:', err.message);
  }
}
