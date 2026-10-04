export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { getDbHttp } from '@/lib/db';
import { announcement } from '@/lib/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { publishAnnouncement } from '@/lib/announcements';
import { parseAnnouncementInput } from '@/lib/announcement-input';

// PATCH /api/admin/announcements/:id
//   { action: 'publish' }                       publish now
//   { action: 'unschedule' }                    SCHEDULED -> DRAFT
//   { action: 'expire' }                        end a published one now (hides it from everyone)
//   { ...fields, mode?: 'draft' | 'schedule' }  edit a DRAFT/SCHEDULED announcement
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromToken(req);
  const denied = requireAdmin(user);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDbHttp();
    const [existing] = await db.select().from(announcement).where(eq(announcement.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const now = new Date().toISOString();

    if (body.action === 'publish') {
      if (existing.status === 'PUBLISHED') return NextResponse.json({ error: 'Already published' }, { status: 409 });
      const published = await publishAnnouncement(id);
      if (!published) return NextResponse.json({ error: 'Already published' }, { status: 409 });
      return NextResponse.json({ item: published });
    }

    if (body.action === 'unschedule') {
      const [row] = await db
        .update(announcement)
        .set({ status: 'DRAFT', publishAt: null, updatedAt: now })
        .where(and(eq(announcement.id, id), eq(announcement.status, 'SCHEDULED')))
        .returning();
      if (!row) return NextResponse.json({ error: 'Not a scheduled announcement' }, { status: 409 });
      return NextResponse.json({ item: row });
    }

    if (body.action === 'expire') {
      const [row] = await db
        .update(announcement)
        .set({ expiresAt: now, updatedAt: now })
        .where(and(eq(announcement.id, id), eq(announcement.status, 'PUBLISHED')))
        .returning();
      if (!row) return NextResponse.json({ error: 'Not a published announcement' }, { status: 409 });
      return NextResponse.json({ item: row });
    }

    // Plain edit — only before it has gone out (people may already have read it).
    if (existing.status === 'PUBLISHED') {
      return NextResponse.json({ error: 'Published announcements can’t be edited. End it and create a new one.' }, { status: 409 });
    }
    const { data, error } = parseAnnouncementInput({ ...existing, ...body });
    if (!data) return NextResponse.json({ error }, { status: 400 });

    const schedule = body.mode === 'schedule';
    if (schedule && (!data.publishAt || new Date(data.publishAt) <= new Date())) {
      return NextResponse.json({ error: 'Pick a publish time in the future' }, { status: 400 });
    }
    const [row] = await db
      .update(announcement)
      .set({
        ...data,
        publishAt: schedule ? data.publishAt : null,
        status: schedule ? 'SCHEDULED' : 'DRAFT',
        updatedAt: now,
      })
      .where(and(eq(announcement.id, id), ne(announcement.status, 'PUBLISHED')))
      .returning();
    if (!row) return NextResponse.json({ error: 'Already published' }, { status: 409 });
    return NextResponse.json({ item: row });
  } catch (err: any) {
    console.error('[admin/announcements] patch error:', err);
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 });
  }
}

// DELETE — drafts/scheduled/published all removable (read receipts cascade).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromToken(req);
  const denied = requireAdmin(user);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });
  try {
    const { id } = await params;
    await getDbHttp().delete(announcement).where(eq(announcement.id, id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[admin/announcements] delete error:', err);
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 });
  }
}
