// GET /api/raw-footage-folders/script?folderId=  OR  ?folderPath=
// Returns the script attached to a raw-footage folder for Drive display.
// Content is always readable/downloadable; never editable via this endpoint.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import {
  rawFootageFolder as rawFootageFolderTable,
  deliverableScript as deliverableScriptTable,
  task as taskTable,
  shootDetail as shootDetailTable,
} from '@/lib/db/schema';
import { readShootScriptDocument } from '@/lib/shoot-scripts';

const CAN_VIEW = ['admin', 'manager', 'videographer', 'editor', 'client', 'qc', 'scheduler'];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_VIEW.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get('folderId');
  const folderPath = searchParams.get('folderPath');
  if (!folderId && !folderPath) {
    return NextResponse.json({ error: 'folderId or folderPath is required' }, { status: 400 });
  }

  const db = getDbHttp();

  try {
    const [folder] = await db
      .select()
      .from(rawFootageFolderTable)
      .where(folderId ? eq(rawFootageFolderTable.id, folderId) : eq(rawFootageFolderTable.folderPath, folderPath!))
      .limit(1);
    if (!folder) return NextResponse.json({ script: null });

    // Prefer DeliverableScript bound to this folder
    const [deliverable] = await db
      .select({
        id: deliverableScriptTable.id,
        title: deliverableScriptTable.title,
        content: deliverableScriptTable.content,
        status: deliverableScriptTable.status,
        updatedAt: deliverableScriptTable.updatedAt,
      })
      .from(deliverableScriptTable)
      .where(eq(deliverableScriptTable.rawFootageFolderId, folder.id))
      .limit(1);

    if (deliverable && deliverable.content?.trim()) {
      const fileName = `${deliverable.title || `${folder.code}${folder.number}-script`}.txt`.replace(/[\\/]/g, '-');
      return NextResponse.json({
        script: {
          source: 'deliverable',
          id: deliverable.id,
          title: deliverable.title,
          content: deliverable.content,
          status: deliverable.status,
          updatedAt: deliverable.updatedAt,
          fileName,
          readOnly: true,
        },
      });
    }

    // Fall back to shoot script linked via the folder's editor task
    if (!folder.taskId) return NextResponse.json({ script: null });
    const [task] = await db
      .select({ shootScriptRef: taskTable.shootScriptRef })
      .from(taskTable)
      .where(eq(taskTable.id, folder.taskId))
      .limit(1);
    if (!task?.shootScriptRef) return NextResponse.json({ script: null });

    let ref: { shootTaskId?: string; scriptId?: string; scriptTitle?: string };
    try {
      ref = JSON.parse(task.shootScriptRef);
    } catch {
      return NextResponse.json({ script: null });
    }
    if (!ref.shootTaskId || !ref.scriptId) return NextResponse.json({ script: null });

    const [shoot] = await db
      .select({ scriptContent: shootDetailTable.scriptContent })
      .from(shootDetailTable)
      .where(eq(shootDetailTable.taskId, ref.shootTaskId))
      .limit(1);
    if (!shoot) return NextResponse.json({ script: null });

    const script = readShootScriptDocument(shoot.scriptContent).scripts.find((s) => s.id === ref.scriptId);
    if (!script) return NextResponse.json({ script: null });

    const fileName = `${script.title || `${folder.code}${folder.number}-script`}.txt`.replace(/[\\/]/g, '-');
    return NextResponse.json({
      script: {
        source: 'shoot',
        id: script.id,
        title: script.title,
        content: script.content,
        status: script.status,
        updatedAt: script.updatedAt,
        fileName,
        readOnly: true,
        shootTaskId: ref.shootTaskId,
      },
    });
  } catch (error: unknown) {
    console.error('[Raw Footage Folder Script] GET error:', error);
    return NextResponse.json({ error: 'Failed to load folder script' }, { status: 500 });
  }
}
