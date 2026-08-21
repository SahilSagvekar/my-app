export const dynamic = 'force-dynamic';
// src/app/api/tasks/search-sf/route.ts

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
    const excludeLfId = searchParams.get('excludeLfId') ?? undefined;

    // Resolved to plain ID lists first, not correlated exists(db.select()...)
    // subqueries — mixing db.query's relational API (used below, which
    // aliases the Task table as lowercase "task") with a manually-built
    // exists() subquery referencing the bare `task` object breaks
    // correlation: Postgres throws "missing FROM-clause entry for table
    // Task" since the subquery ends up as an unaliased, uncorrelated
    // reference instead of matching the outer row.
    const [matchingMonthlyDeliverables, matchingOneOffDeliverables] = await Promise.all([
      db.select({ id: monthlyDeliverable.id }).from(monthlyDeliverable)
        .where(or(ilike(monthlyDeliverable.type, '%SF%'), ilike(monthlyDeliverable.type, '%SHORT%'))),
      db.select({ id: oneOffDeliverable.id }).from(oneOffDeliverable)
        .where(or(ilike(oneOffDeliverable.type, '%SF%'), ilike(oneOffDeliverable.type, '%SHORT%'))),
    ]);
    const monthlyIds = matchingMonthlyDeliverables.map(d => d.id);
    const oneOffIds = matchingOneOffDeliverables.map(d => d.id);

    const rawTasks = await db.query.task.findMany({
      where: and(
        clientId ? eq(task.clientId, clientId) : undefined,
        excludeLfId ? ne(task.id, excludeLfId) : undefined,
        or(
          ilike(task.deliverableType, '%SF%'),
          ilike(task.deliverableType, '%SHORT%'),
          ilike(task.taskType, '%SF%'),
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
        relatedTaskId: true,
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
    console.error('[search-sf]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}