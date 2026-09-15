// src/app/api/deliverable-scripts/[id]/route.ts
//
// GET — single script (staff editor load). PATCH — staff content/title/
// template edit (autosave target).

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { deliverableScript as deliverableScriptTable } from '@/lib/db/schema';
import { updateDeliverableScriptContent } from '@/lib/deliverable-scripts';
import { SCRIPT_TEMPLATES } from '@/lib/shoot-scripts';

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
  const [script] = await db.select().from(deliverableScriptTable).where(eq(deliverableScriptTable.id, id)).limit(1);
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  return NextResponse.json({ script });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await props.params;
  const body = await req.json();
  const { title, content, template } = body;

  if (template !== undefined && !Object.keys(SCRIPT_TEMPLATES).includes(template)) {
    return NextResponse.json({ error: 'Invalid template' }, { status: 400 });
  }

  const patch: { title?: string; content?: string; template?: keyof typeof SCRIPT_TEMPLATES } = {};
  if (typeof title === 'string') patch.title = title;
  if (typeof content === 'string') patch.content = content;
  if (typeof template === 'string') patch.template = template as keyof typeof SCRIPT_TEMPLATES;

  const updated = await updateDeliverableScriptContent(id, patch);
  if (!updated) return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  return NextResponse.json({ script: updated });
}
