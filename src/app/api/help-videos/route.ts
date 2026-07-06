export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

// GET /api/help-videos — any authenticated user can read.
// Non-admins only get active videos; admin/manager get everything (for management UI).
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = ['admin', 'manager'].includes(user.role ?? '');
    const videos = await prisma.helpVideo.findMany({
      where: isAdmin ? {} : { isActive: true },
      orderBy: { order: 'asc' },
    });

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

    const last = await prisma.helpVideo.findFirst({ orderBy: { order: 'desc' } });

    const video = await prisma.helpVideo.create({
      data: {
        title,
        description: description || null,
        youtubeUrl,
        order: order ?? (last ? last.order + 1 : 0),
        createdById: user.id,
      },
    });

    return NextResponse.json(video, { status: 201 });
  } catch (err) {
    console.error('POST /api/help-videos error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
