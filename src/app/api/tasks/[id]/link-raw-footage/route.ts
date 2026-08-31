export const dynamic = 'force-dynamic';
// src/app/api/tasks/[id]/link-raw-footage/route.ts
//
// Editors/videographers link a task to one or more raw footage folders so
// it's easy to find later. Body: { action: 'add' | 'remove', path: string }
// — operates on one path at a time, since the picker can add/remove
// individual folders without needing to resend the whole list.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task as taskTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

const ALLOWED_ROLES = ['admin', 'editor', 'videographer', 'manager'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ALLOWED_ROLES.includes(user.role?.toLowerCase())) {
      return NextResponse.json({ error: 'Not allowed to link raw footage' }, { status: 403 });
    }

    const { id } = await params;
    const { action, path } = await req.json();

    if (!path || (action !== 'add' && action !== 'remove')) {
      return NextResponse.json({ error: "Provide path and action ('add' or 'remove')" }, { status: 400 });
    }

    const [existing] = await db.select({ linkedRawFootagePaths: taskTable.linkedRawFootagePaths })
      .from(taskTable).where(eq(taskTable.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const current = existing.linkedRawFootagePaths || [];
    const next = action === 'add'
      ? (current.includes(path) ? current : [...current, path])
      : current.filter((p) => p !== path);

    const [updated] = await db.update(taskTable)
      .set({ linkedRawFootagePaths: next.length > 0 ? next : null })
      .where(eq(taskTable.id, id))
      .returning({ id: taskTable.id, linkedRawFootagePaths: taskTable.linkedRawFootagePaths });

    return NextResponse.json({ ok: true, task: updated });
  } catch (err: any) {
    console.error('[PATCH link-raw-footage]', err);
    if (err?.cause) console.error('Root cause:', err.cause);
    return NextResponse.json({ error: err?.cause?.message || 'Failed to update link' }, { status: 500 });
  }
}