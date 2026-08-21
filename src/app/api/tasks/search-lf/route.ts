export const dynamic = 'force-dynamic';
// src/app/api/tasks/search-lf/route.ts
// Mirror of search-sf, but matches LF (long form) tasks instead. Used by
// the new SF-side "Link LF" picker.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task, monthlyDeliverable, oneOffDeliverable } from '@/lib/db/schema';
import { and, or, eq, ne, ilike, inArray, desc } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') ?? '';
    const clientId = searchParams.get('clientId') ?? undefined;
    const excludeSfId = searchParams.get('excludeSfId') ?? undefined;

    // Resolved to plain ID lists first, not correlated exists(db.select()...)
    // subqueries — same fix as search-sf/route.ts, see its comment for why.
    const [matchingMonthlyDeliverables, matchingOneOffDeliverables] = await Promise.all([
      db.select({ id: monthlyDeliverable.id }).from(monthlyDeliverable)
        .where(or(ilike(monthlyDeliverable.type, '%LF%'), ilike(monthlyDeliverable.type, '%LONG%'))),
      db.select({ id: oneOffDeliverable.id }).from(oneOffDeliverable)
        .where(or(ilike(oneOffDeliverable.type, '%LF%'), ilike(oneOffDeliverable.type, '%LONG%'))),
    ]);
    const monthlyIds = matchingMonthlyDeliverables.map(d => d.id);
    const oneOffIds = matchingOneOffDeliverables.map(d => d.id);

    const rawTasks = await db.query.task.findMany({
      where: and(
        clientId ? eq(task.clientId, clientId) : undefined,
        excludeSfId ? ne(task.id, excludeSfId) : undefined,
        or(
          ilike(task.deliverableType, '%LF%'),
          ilike(task.deliverableType, '%LONG%'),
          ilike(task.taskType, '%LF%'),
          monthlyIds.length > 0 ? inArray(task.monthlyDeliverableId, monthlyIds) : undefined,
          oneOffIds.length > 0 ? inArray(task.oneOffDeliverableId, oneOffIds) : undefined,
        ),
        query.length > 1
          ? or(ilike(task.title, `%${query}%`), ilike(task.description, `%${query}%`))
          : undefined,
      ),
      columns: {
        id: true,
        title: true,
        description: true,
        deliverableType: true,
        status: true,
      },
      with: {
        client: { columns: { name: true } },
        user_assignedTo: { columns: { name: true } },
        monthlyDeliverable: { columns: { type: true } },
        oneOffDeliverable: { columns: { type: true } },
      },
      orderBy: desc(task.createdAt),
      limit: 100,
    });

    const tasks = rawTasks.map(({ user_assignedTo, ...t }: any) => ({ ...t, user: user_assignedTo }));

    const mapped = tasks.map((t: any) => ({
      ...t,
      deliverableType: t.deliverableType || t.monthlyDeliverable?.type || t.oneOffDeliverable?.type || null,
    }));

    return NextResponse.json({ tasks: mapped });
  } catch (err: any) {
    console.error('[search-lf]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}