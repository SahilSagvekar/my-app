export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { helpVideo } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// PATCH /api/help-videos/[id] — admin/manager only
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, description, youtubeUrl, order, isActive } = body;

    const [video] = await db.update(helpVideo).set({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(youtubeUrl !== undefined && { youtubeUrl }),
      ...(order !== undefined && { order }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date().toISOString(),
    }).where(eq(helpVideo.id, id)).returning();

    return NextResponse.json(video);
  } catch (err) {
    console.error('PATCH /api/help-videos/[id] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/help-videos/[id] — admin/manager only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await db.delete(helpVideo).where(eq(helpVideo.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/help-videos/[id] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
