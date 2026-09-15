// src/app/api/raw-footage-folders/route.ts
//
// GET — list a client's auto-numbered raw-footage folders (SF1..SFn,
// LF1..LFn) for a given month, each with a live-derived shoot date
// (never stored) and the deliverable task currently occupying the slot.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { rawFootageFolder as rawFootageFolderTable, task as taskTable } from '@/lib/db/schema';
import { getFolderShootDates } from '@/lib/raw-footage-folders';

const CAN_VIEW = ['admin', 'manager', 'videographer', 'editor', 'client'];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_VIEW.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const monthFolder = searchParams.get('monthFolder');
  if (!clientId || !monthFolder) {
    return NextResponse.json({ error: 'clientId and monthFolder are required' }, { status: 400 });
  }

  const db = getDbHttp();
  try {
    const rows = await db
      .select({
        id: rawFootageFolderTable.id,
        code: rawFootageFolderTable.code,
        number: rawFootageFolderTable.number,
        folderPath: rawFootageFolderTable.folderPath,
        taskId: rawFootageFolderTable.taskId,
        taskTitle: taskTable.title,
      })
      .from(rawFootageFolderTable)
      .leftJoin(taskTable, eq(rawFootageFolderTable.taskId, taskTable.id))
      .where(and(eq(rawFootageFolderTable.clientId, clientId), eq(rawFootageFolderTable.monthFolder, monthFolder)))
      .orderBy(asc(rawFootageFolderTable.code), asc(rawFootageFolderTable.number));

    const folders = await Promise.all(rows.map(async (row) => ({
      ...row,
      shootDates: await getFolderShootDates(row.taskId),
    })));

    return NextResponse.json({ folders });
  } catch (error: unknown) {
    console.error('[Raw Footage Folders] GET error:', error);
    return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 });
  }
}
