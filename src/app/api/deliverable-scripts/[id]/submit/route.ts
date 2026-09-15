// src/app/api/deliverable-scripts/[id]/submit/route.ts
//
// Sends a deliverable script to the client for review — creates or reuses
// a CLIENT_REVIEW task, same pattern as the per-shoot submit route
// (src/app/api/shoots/[id]/scripts/[scriptId]/submit/route.ts).

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { submitDeliverableScript } from '@/lib/deliverable-scripts';

const CAN_SUBMIT = ['admin', 'manager', 'videographer'];

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_SUBMIT.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await props.params;
  const result = await submitDeliverableScript(id, user.id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.error === 'Script not found' ? 404 : 400 });
  return NextResponse.json(result);
}
