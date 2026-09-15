// src/app/api/deliverable-scripts/[id]/relink/route.ts
//
// Manual reconciliation — moves this script to point at a different
// raw-footage-folder slot (and picks up whatever task currently occupies
// that slot). Mirrors PATCH /api/raw-footage-folders/[id]'s "actually I
// want a different task here" override, one level up the chain.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { rawFootageFolder as rawFootageFolderTable } from '@/lib/db/schema';
import { reassignDeliverableScript } from '@/lib/deliverable-scripts';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await props.params;
  const body = await req.json();
  const { rawFootageFolderId } = body;
  if (!rawFootageFolderId) return NextResponse.json({ error: 'rawFootageFolderId is required' }, { status: 400 });

  const db = getDbHttp();
  const [folder] = await db.select({ id: rawFootageFolderTable.id, taskId: rawFootageFolderTable.taskId })
    .from(rawFootageFolderTable).where(eq(rawFootageFolderTable.id, rawFootageFolderId)).limit(1);
  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

  const updated = await reassignDeliverableScript(id, { rawFootageFolderId: folder.id, taskId: folder.taskId ?? null });
  if (!updated) return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  return NextResponse.json({ script: updated });
}
