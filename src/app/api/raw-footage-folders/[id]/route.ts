// src/app/api/raw-footage-folders/[id]/route.ts
//
// PATCH — manual override of which task occupies a folder slot. Automatic
// assignment happens at task-creation time (see generateMonthly.ts); this
// is the admin/videographer "actually I want a different task in SF3" path.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { reassignRawFootageFolder } from '@/lib/raw-footage-folders';

const CAN_EDIT = ['admin', 'videographer'];

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await props.params;
  try {
    const body = await req.json();
    const { taskId } = body; // string to assign, or null to clear the slot
    const updated = await reassignRawFootageFolder(id, taskId ?? null);
    if (!updated) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    return NextResponse.json({ folder: updated });
  } catch (error: unknown) {
    console.error('[Raw Footage Folders] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to reassign folder' }, { status: 500 });
  }
}
