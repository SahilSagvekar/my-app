export const dynamic = 'force-dynamic';
// src/app/api/shared/folder/[shareToken]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getDbHttp } from '@/lib/db';
import { shareableFile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateSignedUrl, getS3, BUCKET } from '@/lib/s3';
import { checkShareAccess } from '@/lib/share-access';

const s3 = getS3();

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

    const [folder] = await db.select().from(shareableFile).where(eq(shareableFile.shareToken, shareToken)).limit(1);

    if (!folder) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }
    if (!folder.isActive) {
      return NextResponse.json({ error: 'This share link has been deactivated' }, { status: 410 });
    }
    if (folder.expiresAt && new Date(folder.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
    }
    if (folder.mimeType !== 'application/x-directory') {
      return NextResponse.json({ error: 'Not a folder share link' }, { status: 400 });
    }

    // Recipient-gated access — see src/lib/share-access.ts. The link alone
    // is never enough; the requester's verified email must be invited.
    const access = await checkShareAccess(req, shareToken, folder.id);
    if (!access.authorized) {
      return NextResponse.json(
        { error: 'EMAIL_VERIFICATION_REQUIRED', message: 'Verify your email to view this folder.' },
        { status: 403 }
      );
    }

    const folderRoot = folder.s3Key.endsWith('/') ? folder.s3Key : `${folder.s3Key}/`;

    // Optional subpath for browsing into nested folders within the share.
    // Sanitize hard against traversal — strip any ".." segments and leading
    // slashes so the resolved prefix can never leave folderRoot.
    const rawSubpath = req.nextUrl.searchParams.get('subpath') || '';
    const safeSubpath = rawSubpath
      .split('/')
      .filter((seg) => seg && seg !== '..' && seg !== '.')
      .join('/');
    const folderPrefix = safeSubpath ? `${folderRoot}${safeSubpath}/` : folderRoot;

    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: folderPrefix,
        Delimiter: '/',
      })
    );

    const folders = (res.CommonPrefixes ?? []).map((cp) => {
      const full = cp.Prefix ?? '';
      const name = full.slice(folderPrefix.length).replace(/\/$/, '');
      return { name, type: 'folder' as const, s3Key: full };
    });

    const files = await Promise.all(
      (res.Contents ?? [])
        .filter((obj) => obj.Key !== folderPrefix)
        .map(async (obj) => {
          const name = (obj.Key ?? '').slice(folderPrefix.length);
          const signedUrl = await generateSignedUrl(obj.Key!, 60 * 60 * 24 * 7);
          return {
            name,
            type: 'file' as const,
            s3Key: obj.Key!,
            size: formatBytes(obj.Size ?? 0),
            rawSize: obj.Size ?? 0,
            lastModified: obj.LastModified?.toISOString() ?? null,
            url: signedUrl,
          };
        })
    );

    await db
      .update(shareableFile)
      .set({ viewCount: folder.viewCount + 1, lastViewedAt: new Date().toISOString() })
      .where(eq(shareableFile.shareToken, shareToken));

    return NextResponse.json({
      folderName: folder.fileName,
      subpath: safeSubpath,
      s3Key: folderPrefix,
      items: [...folders, ...files],
      createdAt: folder.createdAt,
    });
  } catch (error: any) {
    console.error('[shared/folder] error:', error);
    if (error?.cause) console.error('Root cause:', error.cause);
    return NextResponse.json({ error: 'Failed to load folder', details: error?.cause?.message || error.message }, { status: 500 });
  }
}