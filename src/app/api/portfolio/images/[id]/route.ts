export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { portfolioImage } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requirePortfolioAdmin } from '@/lib/portfolio-auth';

// PATCH /api/portfolio/images/[id] — update a portfolio image
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const denied = requirePortfolioAdmin(req);
    if (denied) return denied;
    const { id } = await params;
    const body = await req.json();

    const [existing] = await db
      .select()
      .from(portfolioImage)
      .where(eq(portfolioImage.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ ok: false, message: 'Image not found' }, { status: 404 });
    }

    const [updated] = await db
      .update(portfolioImage)
      .set({
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.thumbnailUrl !== undefined && { thumbnailUrl: body.thumbnailUrl }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.order !== undefined && { order: body.order }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(portfolioImage.id, id))
      .returning();

    return NextResponse.json({ ok: true, image: updated });
  } catch (err) {
    console.error('[PATCH /api/portfolio/images/[id]]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/portfolio/images/[id] — delete a portfolio image
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const denied = requirePortfolioAdmin(req);
    if (denied) return denied;
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(portfolioImage)
      .where(eq(portfolioImage.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ ok: false, message: 'Image not found' }, { status: 404 });
    }

    await db.delete(portfolioImage).where(eq(portfolioImage.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/portfolio/images/[id]]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
