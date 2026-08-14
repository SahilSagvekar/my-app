export const dynamic = 'force-dynamic';
// src/app/api/tasks/[id]/link-lf/route.ts
//
// SF-side counterpart to link-sf. Here `id` is the SF task, and we're
// setting/clearing/reading ITS relatedTaskId (which points at the LF task
// it belongs to). Same underlying column as link-sf, opposite direction
// of initiation — this lets the SF ticket "link LF" instead of the LF
// ticket "link SF". The LF-side route is left untouched so the scheduler's
// existing read-only LinkedSfTasks view keeps working exactly as before.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: sfTaskId } = await params;

    const sfTask = await db.query.task.findFirst({
      where: eq(task.id, sfTaskId),
      columns: {},
      with: {
        task: {
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
        },
      },
    });

    if (!sfTask) return NextResponse.json({ error: 'SF task not found' }, { status: 404 });

    const relatedTaskRaw: any = sfTask.task;
    const relatedTask = relatedTaskRaw
      ? (({ user_assignedTo, ...rest }: any) => ({ ...rest, user: user_assignedTo }))(relatedTaskRaw)
      : null;

    return NextResponse.json({ linked: relatedTask });
  } catch (err: any) {
    console.error('[link-lf GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: sfTaskId } = await params;
    const { lfTaskId } = await req.json();

    if (!lfTaskId) return NextResponse.json({ error: 'lfTaskId is required' }, { status: 400 });

    const [sfTask] = await db.select({ id: task.id }).from(task).where(eq(task.id, sfTaskId)).limit(1);
    if (!sfTask) return NextResponse.json({ error: 'SF task not found' }, { status: 404 });

    if (lfTaskId === sfTaskId) return NextResponse.json({ error: 'Cannot link a task to itself' }, { status: 400 });

    const [lfTask] = await db.select({ id: task.id }).from(task).where(eq(task.id, lfTaskId)).limit(1);
    if (!lfTask) return NextResponse.json({ error: 'LF task not found' }, { status: 404 });

    await db.update(task).set({ relatedTaskId: lfTaskId, updatedAt: new Date().toISOString() }).where(eq(task.id, sfTaskId));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[link-lf POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: sfTaskId } = await params;

    await db.update(task).set({ relatedTaskId: null, updatedAt: new Date().toISOString() }).where(eq(task.id, sfTaskId));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[link-lf DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
