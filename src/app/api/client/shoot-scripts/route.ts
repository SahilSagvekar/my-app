export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable, user as userTable } from '@/lib/db/schema';
import { and, eq, desc, isNotNull } from 'drizzle-orm';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';
import { readShootScriptDocument, writeShootScriptDocument, createShootScript } from '@/lib/shoot-scripts';

function resolveClientAuth(req: NextRequest, user: { id: string | number; role?: string | null }, clientIdParam: string | null) {
  const viewingAs = req.headers.get('x-viewing-as')?.toLowerCase();
  const baseRole = (user.role || '').toLowerCase();
  const isPreviewingClient = viewingAs === 'client' && !!clientIdParam && (baseRole === 'admin' || baseRole === 'manager');
  return { baseRole, isPreviewingClient };
}

// GET — the logged-in client's own shoots with a script that's been made
// visible ("sent"). Content is always current — sending doesn't snapshot
// it, so no separate re-send is needed after an edit.
//
// The client-facing Scripts screen only shows two states, Pending and
// Approved (see ClientShootScriptsPage) — there's no client-triggered
// "changes requested" anymore, the client edits the text directly instead.
// A script that's still sitting in 'changes_requested' from the old flow
// (or set by staff internally) is folded into "Pending" here rather than
// hidden, so nothing silently disappears from the client's list.
//
// GET ?shootsList=1 — a separate, lighter mode: every shoot the client has
// (regardless of script status), for the "New Script" picker, which needs
// to offer shoots that don't have a sent script yet too.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Admin/manager previewing a client's portal (ViewAsRoleContext) sends
    // x-viewing-as: client + ?clientId= together — same convention
    // /api/tasks already uses. A real client user sends neither and falls
    // through to resolveClientIdForUser below as before.
    const { searchParams } = new URL(req.url);
    const clientIdOverride = searchParams.get('clientId');
    const { baseRole, isPreviewingClient } = resolveClientAuth(req, user, clientIdOverride);

    if (baseRole !== 'client' && !isPreviewingClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientId = isPreviewingClient ? clientIdOverride : await resolveClientIdForUser(user.id);
    if (!clientId) {
      return NextResponse.json(searchParams.get('shootsList') ? { shoots: [] } : { scripts: [] });
    }

    if (searchParams.get('shootsList')) {
      const shootRows = await db
        .select({ taskId: taskTable.id, taskTitle: taskTable.title, shootDate: shootDetailTable.shootDate })
        .from(shootDetailTable)
        .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
        .where(and(eq(taskTable.clientId, clientId), isNotNull(shootDetailTable.shootDate)))
        .orderBy(desc(shootDetailTable.shootDate));
      return NextResponse.json({ shoots: shootRows });
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
        scriptSentByName: userTable.name,
      })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .leftJoin(userTable, eq(shootDetailTable.scriptSentBy, userTable.id))
      .where(and(eq(taskTable.clientId, clientId), eq(shootDetailTable.scriptStatus, 'sent')))
      .orderBy(desc(shootDetailTable.shootDate));

    const scripts = rows.flatMap((row) => {
      const document = readShootScriptDocument(row.scriptContent);
      const entries = document.scripts.map((script) => row.scriptStatus === 'sent' && script.id === 'legacy-script'
        ? { ...script, status: 'sent' as const }
        : script);
      return entries
        .filter((script) => ['sent', 'approved', 'changes_requested'].includes(script.status))
        .map((script) => ({
          ...script,
          // Fold the retired changes_requested state into "sent" (Pending)
          // for display — see comment above.
          status: script.status === 'changes_requested' ? 'sent' as const : script.status,
          taskId: row.taskId,
          taskTitle: row.taskTitle,
          shootDate: row.shootDate,
          location: row.location,
          scriptSentAt: row.scriptSentAt,
          scriptSentByName: row.scriptSentByName,
        }));
    });
    return NextResponse.json({ scripts });
  } catch (error: unknown) {
    console.error('[Client Shoot Scripts] GET error:', error);
    return NextResponse.json({ error: 'Failed to load scripts' }, { status: 500 });
  }
}

// PATCH — client actions: 'approve', 'update_content' (the client edits the
// script text directly and it saves in place), 'reject', 'create' (client
// writes a brand-new script for one of their own shoots), and 'delete'.
export async function PATCH(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const bodyForAuth = req.clone();
    const baseRole = (user.role || '').toLowerCase();
    // PATCH takes clientId from the JSON body (not a query param) since
    // there's no query string on a POST/PATCH-style call here — the
    // preview override still needs the same x-viewing-as + clientId pair.
    const { clientId: clientIdFromBody } = await bodyForAuth.json().catch(() => ({ clientId: null }));
    const { isPreviewingClient } = resolveClientAuth(req, user, clientIdFromBody || null);
    if (baseRole !== 'client' && !isPreviewingClient) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const clientId = isPreviewingClient ? clientIdFromBody : await resolveClientIdForUser(user.id);
    if (!clientId) return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    const { taskId, scriptId, action, content, feedback, title } = await req.json();
    if (!taskId || !['approve', 'update_content', 'reject', 'create', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'A shoot and an action are required' }, { status: 400 });
    }
    if (action !== 'create' && !scriptId) {
      return NextResponse.json({ error: 'A script is required' }, { status: 400 });
    }
    if (action === 'update_content' && typeof content !== 'string') {
      return NextResponse.json({ error: 'Script content is required' }, { status: 400 });
    }
    if (action === 'reject' && (typeof feedback !== 'string' || !feedback.trim())) {
      return NextResponse.json({ error: 'A reason is required to reject a script' }, { status: 400 });
    }
    const [row] = await db.select({ scriptContent: shootDetailTable.scriptContent })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .where(and(eq(taskTable.id, taskId), eq(taskTable.clientId, clientId)))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
    const document = readShootScriptDocument(row.scriptContent);
    const now = new Date().toISOString();

    if (action === 'create') {
      // Written directly by the client, so it's immediately visible to
      // staff/the client themselves — no separate "submit" step, and no
      // linked review task (nothing to approve/reject on their own script).
      const created = createShootScript('overall', document.scripts.length + 1);
      created.status = 'sent';
      if (typeof title === 'string' && title.trim()) created.title = title.trim();
      document.scripts.push(created);
      await db.update(shootDetailTable).set({
        scriptContent: writeShootScriptDocument(document),
        scriptStatus: 'sent',
        scriptSentAt: now,
        scriptSentBy: user.id,
        updatedAt: now,
      }).where(eq(shootDetailTable.taskId, taskId));
      return NextResponse.json({ script: created });
    }

    const script = document.scripts.find((entry) => entry.id === scriptId);
    if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

    if (action === 'delete') {
      document.scripts = document.scripts.filter((entry) => entry.id !== scriptId);
      await db.update(shootDetailTable).set({
        scriptContent: writeShootScriptDocument(document),
        updatedAt: now,
      }).where(eq(shootDetailTable.taskId, taskId));
      // Clean up the linked review task too, if this script had one, so it
      // doesn't sit orphaned in anyone's task list.
      if (script.reviewTaskId) {
        await db.delete(taskTable).where(eq(taskTable.id, script.reviewTaskId));
      }
      return NextResponse.json({ deleted: true, scriptId });
    }

    // Also accept the retired 'changes_requested' state here so a script
    // left over from before this redesign can still be approved/edited.
    if (!['sent', 'approved', 'changes_requested'].includes(script.status)) {
      return NextResponse.json({ error: 'Script is not available for review' }, { status: 404 });
    }
    if (action === 'approve') {
      script.status = 'approved';
    } else if (action === 'reject') {
      script.status = 'changes_requested';
      script.clientFeedback = feedback.trim();
    } else {
      script.content = content;
      // Editing no longer moves an approved script back to pending — the
      // client can keep the record current after approval too.
      if (script.status === 'changes_requested') script.status = 'sent';
    }
    script.updatedAt = now;
    await db.update(shootDetailTable).set({
      scriptContent: writeShootScriptDocument(document),
      scriptLastEditedAt: now,
      scriptLastEditedBy: user.id,
      updatedAt: now,
    }).where(eq(shootDetailTable.taskId, taskId));

    // The staff-facing board (/api/shoots/[id]/scripts) reads a script's
    // displayed status FROM its linked review task's status whenever
    // reviewTaskId is set (COMPLETED/REJECTED_BY_CLIENT/CLIENT_REVIEW),
    // ignoring script.status entirely in that case — see that route's GET.
    // Without this, approving/rejecting here updated the JSON document but
    // left the review task (and therefore the videographer's view) stuck
    // on CLIENT_REVIEW forever, so the status and feedback never appeared
    // to staff. Keep the two in sync on every action.
    if (script.reviewTaskId) {
      const taskStatus = action === 'approve' ? 'COMPLETED' : action === 'reject' ? 'REJECTED_BY_CLIENT' : script.status === 'sent' ? 'CLIENT_REVIEW' : undefined;
      if (taskStatus) {
        await db.update(taskTable).set({
          status: taskStatus as any,
          feedback: action === 'reject' ? feedback.trim() : null,
          updatedAt: now,
        }).where(eq(taskTable.id, script.reviewTaskId));
      }
    }

    // Client approve/edit/reject never auto-links production tasks.

    return NextResponse.json({ script });
  } catch (error: unknown) {
    console.error('[Client Shoot Scripts] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }
}