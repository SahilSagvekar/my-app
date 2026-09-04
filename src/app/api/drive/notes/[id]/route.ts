export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { driveNote as driveNoteTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

const CAN_WRITE = ['admin', 'videographer'];

// PATCH — edit a note's content. Author or admin only.
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const params = await props.params;
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_WRITE.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [existing] = await db.select({ createdById: driveNoteTable.createdById })
      .from(driveNoteTable).where(eq(driveNoteTable.id, params.id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    const isOwner = existing.createdById === user.id;
    const isAdmin = (user.role || '').toLowerCase() === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'You can only edit your own notes' }, { status: 403 });
    }

    const body = await req.json();
    const { content } = body;
    if (!content || !String(content).trim()) {
      return NextResponse.json({ error: 'Note cannot be empty' }, { status: 400 });
    }

    const [updated] = await db.update(driveNoteTable).set({
      content: String(content).trim(),
      updatedAt: new Date().toISOString(),
    }).where(eq(driveNoteTable.id, params.id)).returning();

    return NextResponse.json({ note: updated });
  } catch (error: any) {
    console.error('[Drive Notes] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

// DELETE — remove a note. Author or admin only.
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const params = await props.params;
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_WRITE.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [existing] = await db.select({ createdById: driveNoteTable.createdById })
      .from(driveNoteTable).where(eq(driveNoteTable.id, params.id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    const isOwner = existing.createdById === user.id;
    const isAdmin = (user.role || '').toLowerCase() === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'You can only delete your own notes' }, { status: 403 });
    }

    await db.delete(driveNoteTable).where(eq(driveNoteTable.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Drive Notes] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}