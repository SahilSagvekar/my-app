export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { portfolioVideo } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// PATCH /api/portfolio/videos/[id] — update a portfolio video
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
    try {
        const { id } = await params;
        const body = await req.json();

        const [video] = await db.select().from(portfolioVideo).where(eq(portfolioVideo.id, id)).limit(1);
        if (!video) {
            return NextResponse.json(
                { ok: false, message: 'Video not found' },
                { status: 404 }
            );
        }

        const [updated] = await db.update(portfolioVideo).set({
            ...(body.title !== undefined && { title: body.title }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl }),
            ...(body.thumbnailUrl !== undefined && { thumbnailUrl: body.thumbnailUrl }),
            ...(body.category !== undefined && { category: body.category }),
            ...(body.order !== undefined && { order: body.order }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
            updatedAt: new Date().toISOString(),
        }).where(eq(portfolioVideo.id, id)).returning();

        return NextResponse.json({ ok: true, video: updated });
    } catch (err) {
        console.error('[PATCH /api/portfolio/videos/[id]]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}

// DELETE /api/portfolio/videos/[id] — delete a portfolio video
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
    try {
        const { id } = await params;

        const [video] = await db.select().from(portfolioVideo).where(eq(portfolioVideo.id, id)).limit(1);
        if (!video) {
            return NextResponse.json(
                { ok: false, message: 'Video not found' },
                { status: 404 }
            );
        }

        await db.delete(portfolioVideo).where(eq(portfolioVideo.id, id));

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/portfolio/videos/[id]]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}
