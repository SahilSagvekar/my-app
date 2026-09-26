export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { client, postedContent, task } from '@/lib/db/schema';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { getUserFromToken } from '@/lib/auth-helpers';
import { getESTDateString, getESTDayOfWeek, getESTMonthBounds, getESTDate } from '@/lib/est-date';
import { normalizeDeliverableType } from '@/lib/posting-match';
import {
  buildPostingLog,
  computeDeliverableProgress,
  type DeliverableProgress,
  type DeliverableStatus,
} from '@/lib/posting-tracker';

// GET /api/schedular/daily-targets/progress?date=YYYY-MM-DD&clientId=...
//
// Posting Tracker data. Everything is derived from each client's Monthly
// Deliverables (quantity, posting days, videos/day, platforms) — see
// src/lib/posting-tracker.ts for the model. PostingTarget rows are no longer read.

const STATUS_RANK: Record<DeliverableStatus, number> = {
  critical: 4,
  behind: 3,
  on_track: 2,
  not_due: 1,
  done: 0,
};

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawDate = searchParams.get('date') || undefined;
    const clientIdFilter = searchParams.get('clientId') || undefined;

    // A bare YYYY-MM-DD parses as UTC midnight, which is the PREVIOUS day in EST.
    // Pin it to noon UTC so it always lands on the intended EST calendar day.
    const dateParam = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? `${rawDate}T12:00:00Z` : rawDate;

    const { start: dayStart } = getESTDate(dateParam);
    const { start: monthStart, end: monthEnd } = getESTMonthBounds(dateParam);
    const dayOfWeek = getESTDayOfWeek(dateParam);
    const dateKey = getESTDateString(dateParam);

    const clients = await db.query.client.findMany({
      where: clientIdFilter
        ? and(eq(client.status, 'active'), eq(client.id, clientIdFilter))
        : eq(client.status, 'active'),
      columns: { id: true, name: true, companyName: true },
      with: {
        monthlyDeliverables: {
          columns: {
            id: true,
            type: true,
            quantity: true,
            videosPerDay: true,
            postingDays: true,
            platforms: true,
            isTrial: true,
          },
        },
      },
      orderBy: asc(client.name),
    });

    const trackedClients = clients.filter((c) => c.monthlyDeliverables.length > 0);
    const clientIds = trackedClients.map((c) => c.id);

    if (clientIds.length === 0) {
      return NextResponse.json({
        ok: true,
        date: dayStart.toISOString(),
        dateKey,
        dayOfWeek,
        isSunday: dayOfWeek === 0,
        grandTotal: 0,
        grandCompleted: 0,
        grandProgress: 100,
        noInventoryCount: 0,
        clients: [],
      });
    }

    const [monthPosts, readyTasks] = await Promise.all([
      db
        .select({
          id: postedContent.id,
          clientId: postedContent.clientId,
          taskId: postedContent.taskId,
          platform: postedContent.platform,
          deliverableType: postedContent.deliverableType,
          url: postedContent.url,
          title: postedContent.title,
          postedAt: postedContent.postedAt,
        })
        .from(postedContent)
        .where(
          and(
            inArray(postedContent.clientId, clientIds),
            gte(postedContent.postedAt, monthStart.toISOString()),
            lte(postedContent.postedAt, monthEnd.toISOString())
          )
        ),
      // "Ready to post" = COMPLETED with no social link yet (what the scheduler pulls from).
      db.query.task.findMany({
        where: and(
          inArray(task.clientId, clientIds),
          eq(task.status, 'COMPLETED'),
          sql`${task.socialMediaLinks} = '[]'::jsonb`
        ),
        columns: { id: true, clientId: true, deliverableType: true },
        with: { monthlyDeliverable: { columns: { type: true } } },
      }),
    ]);

    const postsByClient = new Map<string, typeof monthPosts>();
    for (const p of monthPosts) {
      if (!postsByClient.has(p.clientId)) postsByClient.set(p.clientId, []);
      postsByClient.get(p.clientId)!.push(p);
    }

    const readyByClient = new Map<string, Map<string, number>>();
    for (const t of readyTasks) {
      if (!t.clientId) continue;
      const type = normalizeDeliverableType(t.deliverableType ?? t.monthlyDeliverable?.type);
      if (!type) continue;
      if (!readyByClient.has(t.clientId)) readyByClient.set(t.clientId, new Map());
      const m = readyByClient.get(t.clientId)!;
      m.set(type, (m.get(type) ?? 0) + 1);
    }

    const result = trackedClients
      .map((c) => {
        const posts = (postsByClient.get(c.id) ?? []).map((p) => ({
          ...p,
          postedAt: p.postedAt as string,
        }));
        const readyByType = readyByClient.get(c.id) ?? new Map<string, number>();

        // Two deliverables of the same type (e.g. a trial + regular SF) would double-count the
        // same posts, so merge same-type rows into one before computing.
        const merged = new Map<string, (typeof c.monthlyDeliverables)[number]>();
        for (const d of c.monthlyDeliverables) {
          const key = normalizeDeliverableType(d.type);
          const existing = merged.get(key);
          if (!existing) {
            merged.set(key, { ...d });
          } else {
            existing.quantity += d.quantity;
            existing.platforms = [...new Set([...(existing.platforms ?? []), ...(d.platforms ?? [])])];
            existing.isTrial = existing.isTrial && d.isTrial;
          }
        }

        const deliverables: DeliverableProgress[] = [];
        for (const d of merged.values()) {
          const p = computeDeliverableProgress(d, { date: dateParam, readyByType, posts });
          if (p) deliverables.push(p);
        }
        if (deliverables.length === 0) return null;

        deliverables.sort(
          (a, b) =>
            Number(b.noInventory) - Number(a.noInventory) ||
            STATUS_RANK[b.status] - STATUS_RANK[a.status] ||
            b.dueToday - a.dueToday
        );

        const totalRequired = deliverables.reduce((s, d) => s + d.todayPostsRequired, 0);
        const totalCompleted = deliverables.reduce((s, d) => s + d.todayPostsDone, 0);
        const worst = deliverables.reduce<DeliverableStatus>(
          (w, d) => (STATUS_RANK[d.status] > STATUS_RANK[w] ? d.status : w),
          'done'
        );

        return {
          clientId: c.id,
          clientName: c.companyName || c.name,
          deliverables,
          totalRequired,
          totalCompleted,
          progress: totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 100,
          status: worst,
          noInventoryCount: deliverables.filter((d) => d.noInventory).length,
          behindCount: deliverables.filter((d) => d.status === 'behind' || d.status === 'critical').length,
          // Only the drawer (single-client request) needs the day-by-day log.
          log: clientIdFilter ? buildPostingLog(posts) : undefined,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // Needs attention first: no-inventory, then worst status, then most owed today.
    result.sort(
      (a, b) =>
        Number(b.noInventoryCount > 0) - Number(a.noInventoryCount > 0) ||
        STATUS_RANK[b.status] - STATUS_RANK[a.status] ||
        b.totalRequired - b.totalCompleted - (a.totalRequired - a.totalCompleted)
    );

    const grandTotal = result.reduce((s, c) => s + c.totalRequired, 0);
    const grandCompleted = result.reduce((s, c) => s + c.totalCompleted, 0);

    return NextResponse.json({
      ok: true,
      date: dayStart.toISOString(),
      dateKey,
      dayOfWeek,
      isSunday: dayOfWeek === 0,
      grandTotal,
      grandCompleted,
      grandProgress: grandTotal > 0 ? Math.round((grandCompleted / grandTotal) * 100) : 100,
      noInventoryCount: result.reduce((s, c) => s + c.noInventoryCount, 0),
      clients: result,
    });
  } catch (error) {
    console.error('Error fetching posting tracker progress:', error);
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 });
  }
}
