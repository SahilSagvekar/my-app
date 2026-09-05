export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable } from '@/lib/db/schema';
import { readShootScriptDocument, writeShootScriptDocument, type ShootScriptDocument } from '@/lib/shoot-scripts';

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
  return NextResponse.json({ document: readShootScriptDocument(shoot.scriptContent) });
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
  return NextResponse.json({ document: readShootScriptDocument(updated.scriptContent) });
}
