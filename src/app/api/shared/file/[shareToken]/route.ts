export const dynamic = 'force-dynamic';
// src/app/api/shared/file/[shareToken]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shareableFile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateSignedUrl } from '@/lib/s3';
import { checkShareAccess } from '@/lib/share-access';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const db = getDbHttp();
  try {
    const { shareToken } = await params;

    if (!shareToken) {
      return NextResponse.json({ error: 'Share token required' }, { status: 400 });
    }

    const [file] = await db.select().from(shareableFile).where(eq(shareableFile.shareToken, shareToken)).limit(1);

    if (!file) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }
    if (!file.isActive) {
      return NextResponse.json({ error: 'This share link has been deactivated' }, { status: 410 });
    }
    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
    }
    if (file.mimeType === 'application/x-directory') {
      return NextResponse.json({ error: 'This is a folder share link' }, { status: 400 });
    }

    // Recipient-gated access — see src/lib/share-access.ts. The link alone
    // is never enough; the requester's verified email must be invited.
    const access = await checkShareAccess(req, shareToken, file.id);
    if (!access.authorized) {
      return NextResponse.json(
        { error: 'EMAIL_VERIFICATION_REQUIRED', message: 'Verify your email to view this file.' },
        { status: 403 }
      );
    }

    const signedUrl = await generateSignedUrl(file.s3Key, 60 * 60 * 24 * 7);

    await db
      .update(shareableFile)
      .set({ viewCount: file.viewCount + 1, lastViewedAt: new Date().toISOString() })
      .where(eq(shareableFile.shareToken, shareToken));

    return NextResponse.json({
      fileName: file.fileName,
      fileSize: formatBytes(file.fileSize ?? 0),
      mimeType: file.mimeType,
      url: signedUrl,
      createdAt: file.createdAt,
    });
  } catch (error: any) {
    console.error('[shared/file] error:', error);
    return NextResponse.json({ error: 'Failed to load shared file', details: error.message }, { status: 500 });
  }
}