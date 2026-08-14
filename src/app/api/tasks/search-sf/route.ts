export const dynamic = 'force-dynamic';
// src/app/api/tasks/search-sf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { task, monthlyDeliverable, oneOffDeliverable } from '@/lib/db/schema';
import { and, or, eq, ne, ilike, exists, desc } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') ?? '';
    const clientId = searchParams.get('clientId') ?? undefined;
    const excludeLfId = searchParams.get('excludeLfId') ?? undefined;

    const rawTasks = await db.query.task.findMany({
      where: and(
        clientId ? eq(task.clientId, clientId) : undefined,
        excludeLfId ? ne(task.id, excludeLfId) : undefined,
        or(
          ilike(task.deliverableType, '%SF%'),
          ilike(task.deliverableType, '%SHORT%'),
          ilike(task.taskType, '%SF%'),
          exists(db.select().from(monthlyDeliverable).where(and(
            eq(monthlyDeliverable.id, task.monthlyDeliverableId),
            or(ilike(monthlyDeliverable.type, '%SF%'), ilike(monthlyDeliverable.type, '%SHORT%')),
          ))),
          exists(db.select().from(oneOffDeliverable).where(and(
            eq(oneOffDeliverable.id, task.oneOffDeliverableId),
            or(ilike(oneOffDeliverable.type, '%SF%'), ilike(oneOffDeliverable.type, '%SHORT%')),
          ))),
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

  } finally {
    await closeDb();
  }
}