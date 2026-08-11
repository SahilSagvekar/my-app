export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { helpVideo } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { asc, desc, eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// GET /api/help-videos — any authenticated user can read.
// Non-admins only get active videos; admin/manager get everything (for management UI).
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ['admin', 'manager'].includes(user.role ?? '');
    const videos = isAdmin
      ? await db.select().from(helpVideo).orderBy(asc(helpVideo.order))
      : await db.select().from(helpVideo).where(eq(helpVideo.isActive, true)).orderBy(asc(helpVideo.order));

    return NextResponse.json(videos);
  } catch (err) {
    console.error('GET /api/help-videos error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/help-videos — admin/manager only
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, youtubeUrl, order } = body;

    if (!title || !youtubeUrl) {
      return NextResponse.json({ error: 'Title and YouTube URL are required' }, { status: 400 });
    }

    const [last] = await db.select().from(helpVideo).orderBy(desc(helpVideo.order)).limit(1);

    const now = new Date().toISOString();
    const [video] = await db.insert(helpVideo).values({
      id: createId(),
      title,
      description: description || null,
      youtubeUrl,
      order: order ?? (last ? last.order + 1 : 0),
      createdById: user.id,
      updatedAt: now,
    }).returning();

    return NextResponse.json(video, { status: 201 });
  } catch (err) {
    console.error('POST /api/help-videos error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
