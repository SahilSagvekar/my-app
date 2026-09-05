export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable } from '@/lib/db/schema';
import { readShootScriptDocument } from '@/lib/shoot-scripts';

// Roles that can view a script linked to their task
const CAN_VIEW = ['admin', 'manager', 'editor', 'videographer', 'qc'];

// GET /api/tasks/[id]/script
// Returns the script linked to this production task via shootScriptRef.
// Editors use this to read the approved script while editing their video.
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_VIEW.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: taskId } = await props.params;
  const db = getDbHttp();

  // Fetch the task to get its shootScriptRef
  const [row] = await db
    .select({ shootScriptRef: taskTable.shootScriptRef, clientId: taskTable.clientId, assignedTo: taskTable.assignedTo })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (!row.shootScriptRef) return NextResponse.json({ script: null });

  // Editors can only see scripts for tasks assigned to them (unless admin/manager)
  const isRestricted = ['editor', 'videographer', 'qc'].includes((user.role || '').toLowerCase());
  if (isRestricted && row.assignedTo !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let ref: { shootTaskId?: string; scriptId?: string; scriptTitle?: string };
  try {
    ref = JSON.parse(row.shootScriptRef);
  } catch {
    return NextResponse.json({ error: 'Invalid script reference' }, { status: 500 });
  }

  if (!ref.shootTaskId || !ref.scriptId) {
    return NextResponse.json({ error: 'Incomplete script reference' }, { status: 500 });
  }

  // Fetch the script content from the shoot
  const [shootRow] = await db
    .select({ scriptContent: shootDetailTable.scriptContent })
    .from(shootDetailTable)
    .where(eq(shootDetailTable.taskId, ref.shootTaskId))
    .limit(1);

  if (!shootRow) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });

  const document = readShootScriptDocument(shootRow.scriptContent);
  const script = document.scripts.find((s) => s.id === ref.scriptId);
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  // Rejected scripts are not attached to tasks
  if (script.status === 'changes_requested') {
    await db.update(taskTable).set({ shootScriptRef: null }).where(eq(taskTable.id, taskId));
    return NextResponse.json({ script: null });
  }

  return NextResponse.json({
    script: {
      id: script.id,
      title: script.title,
      content: script.content,
      template: script.template,
      status: script.status,
      clientFeedback: script.clientFeedback,
      updatedAt: script.updatedAt,
      createdAt: script.createdAt,
    },
    shootTaskId: ref.shootTaskId,
  });
}
