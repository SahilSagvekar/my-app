export const dynamic = 'force-dynamic';
// src/app/api/shared/[shareToken]/route.ts
//
// Resolves a client review share link (created via POST /api/tasks/[id]/share,
// which writes a ShareableReview row). Consumed by
// src/app/shared/review/[shareToken]/page.tsx.
//
// NOTE: this used to contain folder-share (ShareableFile) logic — that logic
// was misplaced here and has been moved to its correct location at
// src/app/api/shared/folder/[shareToken]/route.ts, matching what
// src/app/shared/folder/[shareToken]/page.tsx actually calls.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl } from '@/lib/s3';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;

    if (!shareToken) {
      return NextResponse.json({ error: 'Share token required' }, { status: 400 });
    }

    const shareableReview = await prisma.shareableReview.findUnique({
      where: { shareToken },
    });

    if (!shareableReview) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }
    if (!shareableReview.isActive) {
      return NextResponse.json({ error: 'This share link has been deactivated' }, { status: 410 });
    }
    if (shareableReview.expiresAt && shareableReview.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
    }

    const task = await prisma.task.findUnique({
      where: { id: shareableReview.taskId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        monthlyDeliverable: {
          select: {
            type: true,
            platforms: true,
          },
        },
        files: {
          where: { isActive: true },
          orderBy: [
            { folderType: 'asc' },
            { version: 'desc' },
          ],
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Shared task not found' }, { status: 404 });
    }

    // Sign each file's S3 URL (files are private — the raw `url` column
    // isn't directly playable), same pattern as /api/tasks/[id]/files.
    const filesWithSignedUrls = await Promise.all(
      task.files.map(async (file) => {
        let url = file.url;
        if (file.s3Key) {
          try {
            url = await generateSignedUrl(file.s3Key);
          } catch (err) {
            console.error(`❌ Failed to sign URL for shared file ${file.id}:`, err);
          }
        }
        return {
          id: file.id,
          name: file.name,
          url,
          size: Number(file.size),
          mimeType: file.mimeType,
          version: file.version,
          folderType: file.folderType,
          uploadedAt: file.uploadedAt,
          createdAt: file.createdAt,
        };
      })
    );

    // Bump view count + last-viewed, best-effort (don't fail the request over it)
    try {
      await prisma.shareableReview.update({
        where: { shareToken },
        data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
      });
    } catch (err) {
      console.error('⚠️ Failed to update share view count:', err);
    }

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        driveLinks: task.driveLinks || [],
        files: filesWithSignedUrls,
        client: task.client,
        monthlyDeliverable: task.monthlyDeliverable,
        createdAt: task.createdAt,
        socialMediaLinks: task.socialMediaLinks,
      },
      shareInfo: {
        viewCount: shareableReview.viewCount + 1,
        expiresAt: shareableReview.expiresAt,
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