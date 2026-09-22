export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import {
  driveFileEditorAssignment as assignmentTable,
  editorClientPermission as editorClientPermissionTable,
  user as userTable,
} from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, inArray } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// Same viewer set as /api/drive/notes — the people actually working inside
// a client's raw-footage folder. Clients never see who's assigned; this is
// an internal coordination tool.
const CAN_VIEW = ['admin', 'manager', 'videographer', 'editor'];
// Narrower — assigning work is a lead/admin action, not something an editor
// does to themselves or to each other.
const CAN_MANAGE = ['admin', 'manager', 'videographer'];

// A small fixed palette, cycled by a stable hash of editorId — this is the
// ONLY place a color is decided. Every screen reading assignments gets the
// color back from here rather than computing its own, so two editors never
// end up looking the same and a given editor's color never drifts between
// folders or after a refresh.
const PALETTE = [
  { name: 'yellow', bg: '#FEF3C7', border: '#F59E0B', chip: '#F59E0B' },
  { name: 'purple', bg: '#EDE9FE', border: '#8B5CF6', chip: '#8B5CF6' },
  { name: 'orange', bg: '#FFEDD5', border: '#F97316', chip: '#F97316' },
  { name: 'green', bg: '#D1FAE5', border: '#10B981', chip: '#10B981' },
  { name: 'blue', bg: '#DBEAFE', border: '#3B82F6', chip: '#3B82F6' },
  { name: 'pink', bg: '#FCE7F3', border: '#EC4899', chip: '#EC4899' },
  { name: 'teal', bg: '#CCFBF1', border: '#14B8A6', chip: '#14B8A6' },
  { name: 'red', bg: '#FEE2E2', border: '#EF4444', chip: '#EF4444' },
];

function colorForEditor(editorId: number) {
  return PALETTE[editorId % PALETTE.length];
}

// GET /api/drive/editor-assignments?clientId=... — the editor roster
// permitted on this client (so the dropdown only ever shows people who
// actually work this account) plus the current file->editor map, in one
// call, same "fetch the whole map once" shape as /api/drive/notes and
// /api/drive/folder-status.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!CAN_VIEW.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 });

    const permissions = await db.query.editorClientPermission.findMany({
      where: eq(editorClientPermissionTable.clientId, clientId),
      with: { user: { columns: { id: true, name: true, email: true } } },
    });

    const editors = permissions
      .filter((p) => p.user)
      .map((p) => ({
        id: p.user!.id,
        name: p.user!.name || p.user!.email || `Editor ${p.user!.id}`,
        color: colorForEditor(p.user!.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const rows = await db.select().from(assignmentTable).where(eq(assignmentTable.clientId, clientId));
    const editorById = new Map(editors.map((e) => [e.id, e]));
    const assignments: Record<string, { editorId: number; editorName: string; color: typeof PALETTE[number] }> = {};
    for (const row of rows) {
      const editor = editorById.get(row.editorId);
      assignments[row.s3Key] = {
        editorId: row.editorId,
        editorName: editor?.name || `Editor ${row.editorId}`,
        color: editor?.color || colorForEditor(row.editorId),
      };
    }

    return NextResponse.json({ editors, assignments });
  } catch (error: any) {
    console.error('[Drive Editor Assignments] GET error:', error);
    return NextResponse.json({ error: 'Failed to load editor assignments' }, { status: 500 });
  }
}

// PUT — assign one or more files to an editor. Upserts on (clientId, s3Key),
// so re-assigning a file just moves it to the new editor.
// body: { clientId, s3Keys: string[], editorId: number }
export async function PUT(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!CAN_MANAGE.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, s3Keys, editorId } = body;
    if (!clientId || !Array.isArray(s3Keys) || s3Keys.length === 0 || !editorId) {
      return NextResponse.json({ error: 'clientId, s3Keys[], and editorId are required' }, { status: 400 });
    }

    // Confirm this editor is actually permitted on this client — otherwise
    // the dropdown and the write could disagree (e.g. a stale roster in an
    // open tab after someone's client access was revoked).
    const [permitted] = await db
      .select({ id: editorClientPermissionTable.id })
      .from(editorClientPermissionTable)
      .where(and(eq(editorClientPermissionTable.clientId, clientId), eq(editorClientPermissionTable.editorId, Number(editorId))))
      .limit(1);
    if (!permitted) {
      return NextResponse.json({ error: 'That editor is not permitted on this client' }, { status: 400 });
    }

    const now = new Date().toISOString();
    for (const s3Key of s3Keys as string[]) {
      await db
        .insert(assignmentTable)
        .values({
          id: createId(),
          clientId,
          s3Key,
          editorId: Number(editorId),
          assignedById: user.id,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [assignmentTable.clientId, assignmentTable.s3Key],
          set: { editorId: Number(editorId), assignedById: user.id, updatedAt: now },
        });
    }

    const [editor] = await db.select({ id: userTable.id, name: userTable.name, email: userTable.email })
      .from(userTable).where(eq(userTable.id, Number(editorId))).limit(1);

    return NextResponse.json({
      ok: true,
      editorId: Number(editorId),
      editorName: editor?.name || editor?.email || `Editor ${editorId}`,
      color: colorForEditor(Number(editorId)),
    });
  } catch (error: any) {
    console.error('[Drive Editor Assignments] PUT error:', error);
    return NextResponse.json({ error: 'Failed to save assignment' }, { status: 500 });
  }
}

// DELETE — clear the assignment on one or more files.
// body: { clientId, s3Keys: string[] }
export async function DELETE(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!CAN_MANAGE.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, s3Keys } = body;
    if (!clientId || !Array.isArray(s3Keys) || s3Keys.length === 0) {
      return NextResponse.json({ error: 'clientId and s3Keys[] are required' }, { status: 400 });
    }

    await db.delete(assignmentTable).where(
      and(eq(assignmentTable.clientId, clientId), inArray(assignmentTable.s3Key, s3Keys as string[])),
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Drive Editor Assignments] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to clear assignment' }, { status: 500 });
  }
}