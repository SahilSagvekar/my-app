// src/app/api/shoots/[id]/available-tasks/route.ts
//
// Lists this shoot's client's unlinked SF/LF deliverable tasks — the real
// slots (SF3, LF1, etc.) a new script can be deliberately attached to at
// creation time, instead of relying on syncShootScriptsToTasks's
// trailing-digit-matching heuristic (which is blind to SF vs LF and can
// mis-attach when both share a number). That heuristic stays in place
// only as a fallback for scripts created before this endpoint existed.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { task as taskTable } from '@/lib/db/schema';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: shootTaskId } = await props.params;
  const db = getDbHttp();

  const [shoot] = await db.select({ clientId: taskTable.clientId }).from(taskTable).where(eq(taskTable.id, shootTaskId)).limit(1);
  if (!shoot?.clientId) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });

  const rows = await db
    .select({ id: taskTable.id, title: taskTable.title, deliverableType: taskTable.deliverableType })
    .from(taskTable)
    .where(and(
      eq(taskTable.clientId, shoot.clientId),
      isNull(taskTable.shootScriptRef),
      inArray(taskTable.deliverableType, ['SF', 'LF']),
      inArray(taskTable.status, ['PENDING', 'IN_PROGRESS']),
    ));

  // Sort SF before LF, then numerically within each — "SF2" before "SF10".
  const codeOrder = (code: string) => (code === 'SF' ? 0 : code === 'LF' ? 1 : 2);
  const tasks = rows
    .map((r) => {
      const match = r.title?.match(/(SF|LF)(\d+)$/);
      return { id: r.id, title: r.title, code: match?.[1] || r.deliverableType, number: match ? parseInt(match[2], 10) : 0 };
    })
    .sort((a, b) => (a.code !== b.code ? codeOrder(a.code) - codeOrder(b.code) : a.number - b.number));

  return NextResponse.json({ tasks });
}
