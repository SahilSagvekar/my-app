export const dynamic = 'force-dynamic';
// src/app/api/client/deliverable-scripts/route.ts
//
// GET — the logged-in client's own deliverable scripts that have been sent
// (or already reviewed). PATCH — client approve / reject / update_content.
// Same contract as /api/client/shoot-scripts, backed by DeliverableScript
// rows instead of a per-shoot JSON document.

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { deliverableScript as deliverableScriptTable, task as taskTable } from '@/lib/db/schema';
import { clientActOnDeliverableScript } from '@/lib/deliverable-scripts';

function resolveClientId(req: NextRequest, user: { id: string | number; role?: string | null }, clientIdParam: string | null) {
  const viewingAs = req.headers.get('x-viewing-as')?.toLowerCase();
  const baseRole = (user.role || '').toLowerCase();
  const isPreviewingClient = viewingAs === 'client' && !!clientIdParam && (baseRole === 'admin' || baseRole === 'manager');
  return { baseRole, isPreviewingClient, clientId: isPreviewingClient ? clientIdParam : null };
}

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const clientIdOverride = searchParams.get('clientId');
    const { baseRole, isPreviewingClient, clientId: overrideClientId } = resolveClientId(req, user, clientIdOverride);
    if (baseRole !== 'client' && !isPreviewingClient) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const clientId = isPreviewingClient ? overrideClientId : await resolveClientIdForUser(user.id);
    if (!clientId) return NextResponse.json({ scripts: [] });

    const rows = await db
      .select({
        id: deliverableScriptTable.id,
        title: deliverableScriptTable.title,
        content: deliverableScriptTable.content,
        template: deliverableScriptTable.template,
        status: deliverableScriptTable.status,
        clientFeedback: deliverableScriptTable.clientFeedback,
        updatedAt: deliverableScriptTable.updatedAt,
        taskId: deliverableScriptTable.taskId,
        taskTitle: taskTable.title,
      })
      .from(deliverableScriptTable)
      .leftJoin(taskTable, eq(deliverableScriptTable.taskId, taskTable.id))
      .where(and(eq(deliverableScriptTable.clientId, clientId), inArray(deliverableScriptTable.status, ['sent', 'approved', 'changes_requested'])))
      .orderBy(desc(deliverableScriptTable.updatedAt));

    return NextResponse.json({ scripts: rows.map((r) => ({ ...r, source: 'deliverable' as const })) });
  } catch (error: unknown) {
    console.error('[Client Deliverable Scripts] GET error:', error);
    return NextResponse.json({ error: 'Failed to load scripts' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { scriptId, action, content, feedback, clientId: clientIdFromBody } = body;
    const { baseRole, isPreviewingClient, clientId: overrideClientId } = resolveClientId(req, user, clientIdFromBody || null);
    if (baseRole !== 'client' && !isPreviewingClient) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const clientId = isPreviewingClient ? overrideClientId : await resolveClientIdForUser(user.id);
    if (!clientId) return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });

    if (!scriptId || !['approve', 'update_content', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'A script and an action are required' }, { status: 400 });
    }
    if (action === 'update_content' && typeof content !== 'string') {
      return NextResponse.json({ error: 'Script content is required' }, { status: 400 });
    }
    if (action === 'reject' && (typeof feedback !== 'string' || !feedback.trim())) {
      return NextResponse.json({ error: 'A reason is required to reject a script' }, { status: 400 });
    }

    const result = await clientActOnDeliverableScript(scriptId, clientId, action, { content, feedback });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.error === 'Script not found' ? 404 : 400 });
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[Client Deliverable Scripts] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }
}
