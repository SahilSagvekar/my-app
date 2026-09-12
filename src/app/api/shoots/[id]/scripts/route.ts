export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable, scriptShootLink as scriptShootLinkTable } from '@/lib/db/schema';
import { readShootScriptDocument, writeShootScriptDocument, type ShootScriptDocument } from '@/lib/shoot-scripts';
import { syncShootScriptsToTasks } from '@/lib/shoot-scripts-sync';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

async function authorize(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await props.params;
  const db = getDbHttp();
  const [shoot] = await db.select({ scriptContent: shootDetailTable.scriptContent })
    .from(shootDetailTable).where(eq(shootDetailTable.taskId, id)).limit(1);
  if (!shoot) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
  const document = readShootScriptDocument(shoot.scriptContent);
  const reviewTaskIds = document.scripts.flatMap((script) => script.reviewTaskId ? [script.reviewTaskId] : []);
  if (reviewTaskIds.length) {
    const statuses = await db.select({ id: taskTable.id, status: taskTable.status }).from(taskTable).where(inArray(taskTable.id, reviewTaskIds));
    const statusByTaskId = new Map(statuses.map((row) => [row.id, row.status]));
    document.scripts = document.scripts.map((script) => {
      const taskStatus = script.reviewTaskId ? statusByTaskId.get(script.reviewTaskId) : null;
      const status = taskStatus === 'COMPLETED' ? 'approved' : taskStatus === 'REJECTED_BY_CLIENT' ? 'changes_requested' : taskStatus === 'CLIENT_REVIEW' ? 'sent' : script.status;
      return { ...script, status };
    });
  }

  // Scripts that natively live on THIS shoot's own document.
  const ownScripts = document.scripts.map((s) => ({ ...s, linkedFrom: null as string | null }));

  // Scripts that were originally written for a DIFFERENT shoot but have
  // also been attached to this one (many-to-many, via ScriptShootLink).
  // Content/versions/status still come from the originating shoot's
  // document — this table only records the extra attachment, so we read
  // the source document(s) to pull the actual script data.
  const links = await db.select().from(scriptShootLinkTable).where(eq(scriptShootLinkTable.targetShootTaskId, id));
  let linkedScripts: Array<ReturnType<typeof readShootScriptDocument>['scripts'][number] & { linkedFrom: string }> = [];
  if (links.length) {
    const sourceIds = [...new Set(links.map((l) => l.sourceShootTaskId))];
    const sourceShoots = await db.select({ taskId: shootDetailTable.taskId, scriptContent: shootDetailTable.scriptContent })
      .from(shootDetailTable).where(inArray(shootDetailTable.taskId, sourceIds));
    const sourceDocsByTaskId = new Map(sourceShoots.map((s) => [s.taskId, readShootScriptDocument(s.scriptContent)]));
    linkedScripts = links.flatMap((link) => {
      const sourceDoc = sourceDocsByTaskId.get(link.sourceShootTaskId);
      const script = sourceDoc?.scripts.find((s) => s.id === link.scriptId);
      return script ? [{ ...script, linkedFrom: link.sourceShootTaskId }] : [];
    });
  }

  return NextResponse.json({ document: { ...document, scripts: [...ownScripts, ...linkedScripts] } });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await props.params;
  const body = await req.json();
  const document = body.document as ShootScriptDocument | undefined;
  if (!document || document.version !== 1 || !Array.isArray(document.scripts)) {
    return NextResponse.json({ error: 'A valid script document is required' }, { status: 400 });
  }
  const normalised = {
    version: 1 as const,
    videosPlanned: Math.max(1, Math.min(99, Number(document.videosPlanned) || 1)),
    scripts: document.scripts.slice(0, 99),
  };
  const [updated] = await getDbHttp().update(shootDetailTable).set({
    scriptContent: writeShootScriptDocument(normalised),
    scriptStatus: normalised.scripts.some(script => script.status === 'sent' || script.status === 'approved' || script.status === 'changes_requested') ? 'sent' : 'draft',
    scriptLastEditedAt: new Date().toISOString(),
    scriptLastEditedBy: auth.user.id,
    updatedAt: new Date().toISOString(),
  }).where(eq(shootDetailTable.taskId, id)).returning({ scriptContent: shootDetailTable.scriptContent });
  if (!updated) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });

  // Attach all non-rejected scripts (including drafts / not yet sent) to tasks,
  // and detach any rejected scripts
  await syncShootScriptsToTasks(id);

  return NextResponse.json({ document: readShootScriptDocument(updated.scriptContent) });
}

