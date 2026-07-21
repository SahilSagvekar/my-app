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

import { prisma } from '@/lib/prisma';
import { RAW_RETENTION_DAYS } from '@/lib/scheduler-activity-shared';

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Roll up all scheduler activity for one UTC calendar day. */
async function rollupDay(dayStart: Date): Promise<void> {
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const userIds = await prisma.schedulerActivityEvent.findMany({
    where: { timestamp: { gte: dayStart, lt: dayEnd } },
    select: { userId: true },
    distinct: ['userId'],
  });

  for (const { userId } of userIds) {
    const events = await prisma.schedulerActivityEvent.findMany({
      where: { userId, timestamp: { gte: dayStart, lt: dayEnd } },
      orderBy: { timestamp: 'asc' },
    });
    if (events.length === 0) continue;

    const firstEventAt = events[0].timestamp;
    const lastEventAt = events[events.length - 1].timestamp;
    const clickCount = events.filter((e) => e.eventType === 'click').length;
    const sessionCount = events.filter((e) => e.eventType === 'session_start').length;

    // Walk idle_start/idle_end pairs chronologically to total up idle time.
    // An idle_start with no matching idle_end (session ended while idle)
    // counts as idle through lastEventAt.
    let idleMs = 0;
    let openIdleStart: Date | null = null;
    for (const e of events) {
      if (e.eventType === 'idle_start') {
        openIdleStart = e.timestamp;
      } else if (e.eventType === 'idle_end' && openIdleStart) {
        idleMs += e.timestamp.getTime() - openIdleStart.getTime();
        openIdleStart = null;
      }
    }
    if (openIdleStart) {
      idleMs += lastEventAt.getTime() - openIdleStart.getTime();
    }

    const totalSpanMs = lastEventAt.getTime() - firstEventAt.getTime();
    const activeMs = Math.max(0, totalSpanMs - idleMs);

    await prisma.schedulerActivityDailySummary.upsert({
      where: { userId_date: { userId, date: dayStart } },
      create: {
        userId,
        date: dayStart,
        activeMinutes: Math.round(activeMs / 60000),
        idleMinutes: Math.round(idleMs / 60000),
        clickCount,
        sessionCount,
        firstEventAt,
        lastEventAt,
      },
      update: {
        activeMinutes: Math.round(activeMs / 60000),
        idleMinutes: Math.round(idleMs / 60000),
        clickCount,
        sessionCount,
        firstEventAt,
        lastEventAt,
      },
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
    const { count } = await prisma.schedulerActivityEvent.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    if (count > 0) {
      console.log(`🧹 [Scheduler Activity] Pruned ${count} raw events older than ${RAW_RETENTION_DAYS} days`);
    }
  } catch (err: any) {
    console.error('❌ [Scheduler Activity] Prune failed:', err.message);
  }
}