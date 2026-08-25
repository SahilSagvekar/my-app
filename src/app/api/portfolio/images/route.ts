export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { portfolioImage } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, asc, eq } from 'drizzle-orm';

const DEFAULT_CATEGORY = 'photography';

// GET /api/portfolio/images — fetch images, optionally filtered by category
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const showAll = searchParams.get('all') === 'true';

    const conditions = [];
    if (!showAll) {
      conditions.push(eq(portfolioImage.isActive, true));
    }
    if (category) {
      conditions.push(eq(portfolioImage.category, category));
    }

    const images = await db
      .select()
      .from(portfolioImage)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(portfolioImage.order));

    return NextResponse.json({ ok: true, images });
  } catch (err) {
    console.error('[GET /api/portfolio/images]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

// POST /api/portfolio/images — admin: add a new portfolio image
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const body = await req.json();
    const { title, description, imageUrl, thumbnailUrl, category, order } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { ok: false, message: 'imageUrl is required' },
        { status: 400 }
      );
    }

    const [image] = await db
      .insert(portfolioImage)
      .values({
        id: createId(),
        title: typeof title === 'string' ? title : '',
        description: description || '',
        imageUrl,
        thumbnailUrl: thumbnailUrl || null,
        category: category || DEFAULT_CATEGORY,
        order: order ?? 0,
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json({ ok: true, image });
  } catch (err) {
    console.error('[POST /api/portfolio/images]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
