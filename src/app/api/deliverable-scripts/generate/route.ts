// src/app/api/deliverable-scripts/generate/route.ts
//
// Manual "create the missing script for this slot" — used by the Script
// Linking panel. Scripts are never auto-created during monthly generation.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { rawFootageFolder as rawFootageFolderTable, client as clientTable } from '@/lib/db/schema';
import { ensureDeliverableScript } from '@/lib/deliverable-scripts';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { rawFootageFolderId } = body;
  if (!rawFootageFolderId) return NextResponse.json({ error: 'rawFootageFolderId is required' }, { status: 400 });

  const db = getDbHttp();
  const [folder] = await db.select().from(rawFootageFolderTable).where(eq(rawFootageFolderTable.id, rawFootageFolderId)).limit(1);
  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  if (!folder.taskId) return NextResponse.json({ error: 'This slot has no task assigned yet — assign a task before generating a script' }, { status: 400 });

  const [clientRow] = await db.select({ companyName: clientTable.companyName, name: clientTable.name })
    .from(clientTable).where(eq(clientTable.id, folder.clientId)).limit(1);
  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // folder.code is already the short SF/LF code; getDeliverableShortCode's
  // input is the full type string elsewhere, but ensureDeliverableScript
  // only needs a slug toFolderCode can map back to 'SF' or 'LF' — the code
  // column value itself already satisfies that.
  const result = await ensureDeliverableScript({
    clientId: folder.clientId,
    companyName: clientRow.companyName || clientRow.name,
    monthFolder: folder.monthFolder,
    deliverableSlug: folder.code,
    number: folder.number,
    taskId: folder.taskId,
    rawFootageFolderId: folder.id,
  });
  if (!result) {
    return NextResponse.json({
      error: 'Failed to generate script. Confirm the DeliverableScript table exists and this slot is SF/LF.',
    }, { status: 500 });
  }
  return NextResponse.json({ id: result.id });
}
