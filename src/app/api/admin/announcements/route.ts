export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, getJwtUserId, requireAdmin } from '@/lib/auth-helpers';
import { getDbHttp } from '@/lib/db';
import { announcement } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { desc } from 'drizzle-orm';
import { countAudience, getReadStats, publishAnnouncement } from '@/lib/announcements';
import { parseAnnouncementInput } from '@/lib/announcement-input';

// GET /api/admin/announcements — history with read counts
export async function GET(req: NextRequest) {
  const user = getUserFromToken(req);
  const denied = requireAdmin(user);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  try {
    const db = getDbHttp();
    const rows = await db.select().from(announcement).orderBy(desc(announcement.createdAt)).limit(100);
    const stats = await getReadStats(rows.map((r) => r.id));
    return NextResponse.json({
      items: rows.map((r) => ({
        ...r,
        readCount: stats.get(r.id)?.read ?? 0,
        dismissedCount: stats.get(r.id)?.dismissed ?? 0,
      })),
    });
  } catch (err: any) {
    console.error('[admin/announcements] list error:', err);
    return NextResponse.json({ error: 'Failed to load announcements' }, { status: 500 });
  }
}

// POST /api/admin/announcements
//   { ...fields, mode: 'draft' | 'publish' | 'schedule' }   (mode defaults to 'draft')
//   { ...fields, previewOnly: true }  -> just returns the audience size
export async function POST(req: NextRequest) {
  const user = getUserFromToken(req);
  const denied = requireAdmin(user);
  const adminId = getJwtUserId(user);
  if (denied || !adminId) return NextResponse.json({ error: denied?.error || 'Unauthorized' }, { status: denied?.status || 401 });

  try {
    const body = await req.json();
    const { data, error } = parseAnnouncementInput(body);
    if (!data) return NextResponse.json({ error }, { status: 400 });

    if (body.previewOnly === true) {
      return NextResponse.json({ audienceCount: await countAudience(data) });
    }

    const mode: string = body.mode || 'draft';
    if (mode === 'schedule' && (!data.publishAt || new Date(data.publishAt) <= new Date())) {
      return NextResponse.json({ error: 'Pick a publish time in the future' }, { status: 400 });
    }

    const db = getDbHttp();
    const now = new Date().toISOString();
    const [created] = await db
      .insert(announcement)
      .values({
        id: createId(),
        ...data,
        publishAt: mode === 'schedule' ? data.publishAt : null,
        status: mode === 'schedule' ? 'SCHEDULED' : 'DRAFT',
        createdById: adminId,
        updatedAt: now,
      })
      .returning();

    const result = mode === 'publish' ? (await publishAnnouncement(created.id)) ?? created : created;
    return NextResponse.json({ item: result }, { status: 201 });
  } catch (err: any) {
    console.error('[admin/announcements] create error:', err);
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }
}
