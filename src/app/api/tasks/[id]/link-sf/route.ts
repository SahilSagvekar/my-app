export const dynamic = 'force-dynamic';
// src/app/api/tasks/[id]/link-sf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: lfTaskId } = await params;

    const rawLinked = await db.query.task.findMany({
      where: eq(task.relatedTaskId, lfTaskId),
      columns: {
        id: true,
        title: true,
        description: true,
        deliverableType: true,
        status: true,
        dueDate: true,
        assignedTo: true,
        clientId: true,
      },
      with: {
        client: { columns: { name: true } },
        user_assignedTo: { columns: { name: true } },
      },
      orderBy: (t, { asc }) => asc(t.createdAt),
    });
    const linked = rawLinked.map(({ user_assignedTo, ...t }: any) => ({ ...t, user: user_assignedTo }));

    return NextResponse.json({ linked });
  } catch (err: any) {
    console.error('[link-sf GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: lfTaskId } = await params;
    const { sfTaskId } = await req.json();

    if (!sfTaskId) return NextResponse.json({ error: 'sfTaskId is required' }, { status: 400 });

    const [lfTask] = await db.select({ id: task.id }).from(task).where(eq(task.id, lfTaskId)).limit(1);
    if (!lfTask) return NextResponse.json({ error: 'LF task not found' }, { status: 404 });

    if (sfTaskId === lfTaskId) return NextResponse.json({ error: 'Cannot link a task to itself' }, { status: 400 });

    const [sfTask] = await db.select({ id: task.id }).from(task).where(eq(task.id, sfTaskId)).limit(1);
    if (!sfTask) return NextResponse.json({ error: 'SF task not found' }, { status: 404 });

    await db.update(task).set({ relatedTaskId: lfTaskId, updatedAt: new Date().toISOString() }).where(eq(task.id, sfTaskId));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[link-sf POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: lfTaskId } = await params;
    const { sfTaskId } = await req.json();

    if (!sfTaskId) return NextResponse.json({ error: 'sfTaskId is required' }, { status: 400 });

    await db.update(task).set({ relatedTaskId: null, updatedAt: new Date().toISOString() })
      .where(and(eq(task.id, sfTaskId), eq(task.relatedTaskId, lfTaskId)));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[link-sf DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}