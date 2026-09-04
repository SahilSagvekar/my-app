export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { driveNote as driveNoteTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// Deliberately narrow — not even manager/scheduler/qc. Instructions between
// videographer/admin and the editor doing the work, nobody else.
const CAN_VIEW = ['admin', 'videographer', 'editor'];
const CAN_CREATE = ['admin', 'videographer'];

// GET /api/drive/notes?clientId=... — every note for the client, grouped by
// s3Key, same "fetch the whole map once" shape as /api/drive/folder-status
// so the UI can badge every visible row without a request per item.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_VIEW.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const rows = await db.query.driveNote.findMany({
      where: eq(driveNoteTable.clientId, clientId),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
      with: { user: { columns: { id: true, name: true, email: true } } },
    });

    const notes: Record<string, any[]> = {};
    for (const row of rows) {
      const key = row.s3Key;
      if (!notes[key]) notes[key] = [];
      notes[key].push({
        id: row.id,
        content: row.content,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        author: { id: row.user?.id, name: row.user?.name || row.user?.email || 'Someone' },
        canManage: row.createdById === user.id || (user.role || '').toLowerCase() === 'admin',
      });
    }

    return NextResponse.json({ notes });
  } catch (error: any) {
    console.error('[Drive Notes] GET error:', error);
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 });
  }
}

// POST — add a note to a file or folder
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_CREATE.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, s3Key, isFolder, content } = body;
    if (!clientId || !s3Key || !content || !String(content).trim()) {
      return NextResponse.json({ error: 'clientId, s3Key, and content are required' }, { status: 400 });
    }

    const [created] = await db.insert(driveNoteTable).values({
      id: createId(),
      clientId,
      s3Key,
      isFolder: !!isFolder,
      content: String(content).trim(),
      createdById: user.id,
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({
      note: {
        id: created.id,
        content: created.content,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        author: { id: user.id, name: user.name || user.email },
        canManage: true,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Drive Notes] POST error:', error);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}