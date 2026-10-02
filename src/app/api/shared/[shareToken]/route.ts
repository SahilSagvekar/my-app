export const dynamic = 'force-dynamic';
// GET /api/shared/[shareToken] - Public access to a shared task review

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addSignedUrlsToFiles } from '@/lib/s3';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;

    if (!shareToken) {
      return NextResponse.json({ error: 'Share token required' }, { status: 400 });
    }

    const share = await prisma.shareableReview.findUnique({
      where: { shareToken },
    });

    if (!share) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }
    if (!share.isActive) {
      return NextResponse.json({ error: 'This share link has been deactivated' }, { status: 410 });
    }
    if (share.expiresAt && share.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
    }

    const task = await prisma.task.findUnique({
      where: { id: share.taskId },
      include: {
        client: true,
        monthlyDeliverable: true,
        files: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Sign file URLs so the video can actually play, and make BigInt sizes JSON-safe
    const signedFiles = await addSignedUrlsToFiles(task.files);
    const files = signedFiles.map((f: any) => ({
      ...f,
      size: Number(f.size ?? 0),
    }));

    const updated = await prisma.shareableReview.update({
      where: { shareToken },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        driveLinks: task.driveLinks,
        files,
        client: task.client,
        monthlyDeliverable: task.monthlyDeliverable,
        createdAt: task.createdAt,
        socialMediaLinks: task.socialMediaLinks,
      },
      shareInfo: {
        viewCount: updated.viewCount,
        expiresAt: share.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('[shared/review] error:', error);
    return NextResponse.json(
      { error: 'Failed to load shared review', details: error.message },
      { status: 500 }
    );
  }
}
