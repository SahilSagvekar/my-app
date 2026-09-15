// src/app/api/shoots/[id]/scripts/link/route.ts
//
// Attaches an existing script (that already lives on ANOTHER shoot's
// scriptContent document) to this shoot too, via ScriptShootLink. This is
// the many-to-many extension on top of the existing one-shoot-owns-its-
// scripts system — content/versions/status stay on the originating shoot;
// this only records the extra attachment.
//
// :id in the URL is the TARGET shoot (the one being attached to).
// Body: { sourceShootTaskId, scriptId }

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable, scriptShootLink as scriptShootLinkTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { readShootScriptDocument } from '@/lib/shoot-scripts';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

async function authorize(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

async function getClientIdForShoot(db: ReturnType<typeof getDbHttp>, shootTaskId: string) {
  const [row] = await db.select({ clientId: taskTable.clientId }).from(taskTable).where(eq(taskTable.id, shootTaskId)).limit(1);
  return row?.clientId ?? null;
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id: targetShootTaskId } = await props.params;
  const db = getDbHttp();

  try {
    const body = await req.json();
    const { sourceShootTaskId, scriptId } = body;
    if (!sourceShootTaskId || !scriptId) {
      return NextResponse.json({ error: 'sourceShootTaskId and scriptId are required' }, { status: 400 });
    }
    if (sourceShootTaskId === targetShootTaskId) {
      return NextResponse.json({ error: 'Script already belongs to this shoot' }, { status: 400 });
    }

    // Same-client guard — blocks accidental cross-client mix-ups.
    const [sourceClientId, targetClientId] = await Promise.all([
      getClientIdForShoot(db, sourceShootTaskId),
      getClientIdForShoot(db, targetShootTaskId),
    ]);
    if (!sourceClientId || !targetClientId) {
      return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
    }
    if (sourceClientId !== targetClientId) {
      return NextResponse.json({ error: 'A script can only be attached to shoots belonging to the same client' }, { status: 400 });
    }

    // Confirm the script actually exists on the source shoot's document.
    const [sourceShoot] = await db.select({ scriptContent: shootDetailTable.scriptContent })
      .from(shootDetailTable).where(eq(shootDetailTable.taskId, sourceShootTaskId)).limit(1);
    const sourceDoc = readShootScriptDocument(sourceShoot?.scriptContent);
    if (!sourceDoc.scripts.some((s) => s.id === scriptId)) {
      return NextResponse.json({ error: 'Script not found on the source shoot' }, { status: 404 });
    }

    const [link] = await db.insert(scriptShootLinkTable).values({
      id: createId(),
      sourceShootTaskId,
      scriptId,
      targetShootTaskId,
    }).returning();

    // Shoot↔shoot attachment only — production-task links stay manual.

    return NextResponse.json({ link }, { status: 201 });
  } catch (error: unknown) {
    // Unique constraint on (scriptId, targetShootTaskId) — already linked.
    console.error('[Script Link] POST error:', error);
    return NextResponse.json({ error: 'Failed to link script (it may already be linked to this shoot)' }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id: targetShootTaskId } = await props.params;
  const db = getDbHttp();

  try {
    const { searchParams } = new URL(req.url);
    const scriptId = searchParams.get('scriptId');
    if (!scriptId) return NextResponse.json({ error: 'scriptId query param is required' }, { status: 400 });

    const [deleted] = await db.delete(scriptShootLinkTable)
      .where(and(eq(scriptShootLinkTable.targetShootTaskId, targetShootTaskId), eq(scriptShootLinkTable.scriptId, scriptId)))
      .returning({ id: scriptShootLinkTable.id });
    if (!deleted) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[Script Link] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to unlink script' }, { status: 500 });
  }
}
