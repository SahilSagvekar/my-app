export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { task as taskTable } from '@/lib/db/schema';

// Roles allowed to edit a script/text-post task's content directly from the
// review screen. This is separate from POST/PATCH /api/tasks/[id]/text-content,
// which is the editor's plain-string draft-save endpoint used before a task
// is ever sent for review — that one stays untouched.
const CAN_EDIT = ['client', 'qc', 'admin', 'manager'];

interface ScriptVersion {
  number: number;
  content: string;
  createdAt: string;
  editedBy?: { id: number | string; name: string; role?: string };
}

interface ScriptReviewPayload {
  kind: 'shoot-script';
  scriptId?: string;
  shootTaskId?: string;
  versions: ScriptVersion[];
}

function parseExisting(raw: string | null): ScriptReviewPayload {
  if (raw) {
    try {
      const existing = JSON.parse(raw);
      if (existing && existing.kind === 'shoot-script' && Array.isArray(existing.versions)) {
        return existing;
      }
    } catch {
      // Legacy/plain-text value — fall through and migrate it below.
    }
  }
  // Legacy plain-text (or empty) content — migrate into version 1 so
  // whatever was there before this feature existed isn't lost.
  return {
    kind: 'shoot-script',
    versions: raw ? [{ number: 1, content: raw, createdAt: new Date().toISOString() }] : [],
  };
}

// PATCH /api/tasks/[id]/script-review
// Autosaves an edit made inside ScriptReviewModal as a new version. Content
// lives on task.textContent as
// { kind: 'shoot-script', scriptId?, shootTaskId?, versions: [...] } — the
// same shape ScriptReviewModal (and the legacy TextPostReviewModal) read.
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: taskId } = await props.params;
  const body = await req.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content : null;
  if (content === null) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 });
  }

  const db = getDbHttp();
  const [row] = await db
    .select({ textContent: taskTable.textContent })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const existing = parseExisting(row.textContent);
  const now = new Date().toISOString();
  const lastVersion = existing.versions[existing.versions.length - 1];

  // No-op guard: autosave fires on a debounce, not only on real edits — skip
  // creating a new version if the content hasn't actually changed.
  if (lastVersion && content === lastVersion.content) {
    return NextResponse.json({ script: existing, unchanged: true });
  }

  const versions: ScriptVersion[] = [
    ...existing.versions,
    {
      number: (lastVersion?.number || 0) + 1,
      content,
      createdAt: now,
      editedBy: { id: user.id, name: user.name || 'Member', role: user.role },
    },
  ];

  const updated: ScriptReviewPayload = { ...existing, versions };

  await db
    .update(taskTable)
    .set({ textContent: JSON.stringify(updated), updatedAt: now })
    .where(eq(taskTable.id, taskId));

  return NextResponse.json({ script: updated });
}