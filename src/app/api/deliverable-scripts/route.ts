// src/app/api/deliverable-scripts/route.ts
//
// GET — list a client's auto-generated deliverable scripts (one per SF/LF
// slot) for a given month, joined with the folder + editor task currently
// occupying that slot. Modeled directly on GET /api/raw-footage-folders.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { deliverableScript as deliverableScriptTable, rawFootageFolder as rawFootageFolderTable, task as taskTable } from '@/lib/db/schema';

const CAN_VIEW = ['admin', 'manager', 'videographer'];

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
        id: deliverableScriptTable.id,
        code: deliverableScriptTable.code,
        number: deliverableScriptTable.number,
        title: deliverableScriptTable.title,
        status: deliverableScriptTable.status,
        taskId: deliverableScriptTable.taskId,
        taskTitle: taskTable.title,
        rawFootageFolderId: deliverableScriptTable.rawFootageFolderId,
        folderPath: rawFootageFolderTable.folderPath,
        updatedAt: deliverableScriptTable.updatedAt,
      })
      .from(deliverableScriptTable)
      .leftJoin(taskTable, eq(deliverableScriptTable.taskId, taskTable.id))
      .leftJoin(rawFootageFolderTable, eq(deliverableScriptTable.rawFootageFolderId, rawFootageFolderTable.id))
      .where(and(eq(deliverableScriptTable.clientId, clientId), eq(deliverableScriptTable.monthFolder, monthFolder)))
      .orderBy(asc(deliverableScriptTable.code), asc(deliverableScriptTable.number));

    return NextResponse.json({ scripts: rows });
  } catch (error: unknown) {
    console.error('[Deliverable Scripts] GET error:', error);
    return NextResponse.json({ error: 'Failed to load scripts' }, { status: 500 });
  }
}
