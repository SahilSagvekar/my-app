export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { portfolioVideo } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, asc, eq } from 'drizzle-orm';
import { requirePortfolioAdmin } from '@/lib/portfolio-auth';

// GET /api/portfolio/videos — fetch videos, optionally filtered by category
export async function GET(req: NextRequest) {
  const db = getDbHttp();
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');
        const showAll = searchParams.get('all') === 'true'; // admin: fetch all including inactive
        if (showAll) {
            const denied = requirePortfolioAdmin(req);
            if (denied) return denied;
        }

        const conditions = [];
        if (!showAll) {
            conditions.push(eq(portfolioVideo.isActive, true));
        }
        if (category) {
            conditions.push(eq(portfolioVideo.category, category));
        }

        const videos = await db.select().from(portfolioVideo)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(asc(portfolioVideo.order), asc(portfolioVideo.createdAt));

        return NextResponse.json({ ok: true, videos });
    } catch (err) {
        console.error('[GET /api/portfolio/videos]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}

// POST /api/portfolio/videos — admin: add a new portfolio video
export async function POST(req: NextRequest) {
  const db = getDbHttp();
    try {
        const denied = requirePortfolioAdmin(req);
        if (denied) return denied;
        const body = await req.json();
        const { title, description, videoUrl, thumbnailUrl, category, order } = body;

        if (!title || !videoUrl || !category) {
            return NextResponse.json(
                { ok: false, message: 'Title, videoUrl, and category are required' },
                { status: 400 }
            );
        }

        const [video] = await db.insert(portfolioVideo).values({
            id: createId(),
            title,
            description: description || '',
            videoUrl,
            thumbnailUrl: thumbnailUrl || null,
            category,
            order: order ?? 0,
            updatedAt: new Date().toISOString(),
        }).returning();

        return NextResponse.json({ ok: true, video });
    } catch (err) {
        console.error('[POST /api/portfolio/videos]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}
