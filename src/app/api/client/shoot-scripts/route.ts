export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';
import { readShootScriptDocument, writeShootScriptDocument } from '@/lib/shoot-scripts';

// GET — the logged-in client's own shoots with a script that's been made
// visible ("sent"). Content is always current — sending doesn't snapshot
// it, so no separate re-send is needed after an edit.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((user.role || '').toLowerCase() !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientId = await resolveClientIdForUser(user.id);
    if (!clientId) {
      return NextResponse.json({ scripts: [] });
    }

    const rows = await db
      .select({
        taskId: taskTable.id,
        taskTitle: taskTable.title,
        shootDate: shootDetailTable.shootDate,
        location: shootDetailTable.location,
        scriptContent: shootDetailTable.scriptContent,
        scriptStatus: shootDetailTable.scriptStatus,
        scriptSentAt: shootDetailTable.scriptSentAt,
      })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .where(and(eq(taskTable.clientId, clientId), eq(shootDetailTable.scriptStatus, 'sent')))
      .orderBy(desc(shootDetailTable.shootDate));

    const scripts = rows.flatMap((row) => {
      const document = readShootScriptDocument(row.scriptContent);
      const entries = document.scripts.map((script) => row.scriptStatus === 'sent' && script.id === 'legacy-script'
        ? { ...script, status: 'sent' as const }
        : script);
      return entries
      .filter((script) => ['sent', 'approved', 'changes_requested'].includes(script.status))
      .map((script) => ({ ...script, taskId: row.taskId, taskTitle: row.taskTitle, shootDate: row.shootDate, location: row.location, scriptSentAt: row.scriptSentAt }));
    });
    return NextResponse.json({ scripts });
  } catch (error: unknown) {
    console.error('[Client Shoot Scripts] GET error:', error);
    return NextResponse.json({ error: 'Failed to load scripts' }, { status: 500 });
  }
}

// PATCH — client approval is tied to one script/video, so a shoot can have
// an approved script while another is still waiting for feedback.
export async function PATCH(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if ((user.role || '').toLowerCase() !== 'client') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const clientId = await resolveClientIdForUser(user.id);
    if (!clientId) return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    const { taskId, scriptId, action, feedback } = await req.json();
    if (!taskId || !scriptId || !['approve', 'request_changes'].includes(action)) {
      return NextResponse.json({ error: 'A script and response are required' }, { status: 400 });
    }
    const [row] = await db.select({ scriptContent: shootDetailTable.scriptContent })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .where(and(eq(taskTable.id, taskId), eq(taskTable.clientId, clientId)))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    const document = readShootScriptDocument(row.scriptContent);
    const script = document.scripts.find((entry) => entry.id === scriptId);
    if (!script || !['sent', 'approved', 'changes_requested'].includes(script.status)) {
      return NextResponse.json({ error: 'Script is not available for review' }, { status: 404 });
    }
    script.status = action === 'approve' ? 'approved' : 'changes_requested';
    script.clientFeedback = String(feedback || '').trim();
    script.updatedAt = new Date().toISOString();
    await db.update(shootDetailTable).set({
      scriptContent: writeShootScriptDocument(document),
      updatedAt: new Date().toISOString(),
    }).where(eq(shootDetailTable.taskId, taskId));
    return NextResponse.json({ script });
  } catch (error: unknown) {
    console.error('[Client Shoot Scripts] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }
}
