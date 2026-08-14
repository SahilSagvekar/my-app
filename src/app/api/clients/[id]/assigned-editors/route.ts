export const dynamic = 'force-dynamic';
// src/app/api/clients/[id]/assigned-editors/route.ts
//
// Returns the editors currently assigned to active tasks for a client.
// Used by the raw footage upload dialog so admin can pick exactly who
// gets tagged in the Slack notification — instead of always tagging
// every editor with an open task for that client.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { user, task } from '@/lib/db/schema';
import { and, or, eq, exists, notInArray, arrayContains, asc } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admin/manager need this — editors/clients don't tag people on upload
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: clientId } = await params;

    const editors = await db.select({
      id: user.id,
      name: user.name,
      email: user.email,
      slackUserId: user.slackUserId,
    }).from(user).where(and(
      or(eq(user.role, 'editor'), arrayContains(user.roles, ['editor'])),
      exists(db.select().from(task).where(and(
        eq(task.assignedTo, user.id),
        eq(task.clientId, clientId),
        notInArray(task.status, ['COMPLETED', 'POSTED'] as any),
      ))),
    )).orderBy(asc(user.name));

    return NextResponse.json({ editors });
  } catch (err: any) {
    console.error('[assigned-editors GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}