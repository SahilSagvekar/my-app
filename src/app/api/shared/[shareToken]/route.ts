export const dynamic = 'force-dynamic';
// src/app/api/shared/folder/[shareToken]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getDbHttp } from '@/lib/db';
import { shareableFile as shareableFileTable } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateSignedUrl, getS3, BUCKET } from '@/lib/s3';

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

    const [shareableFile] = await db.select().from(shareableFileTable)
      .where(eq(shareableFileTable.shareToken, shareToken)).limit(1);

    if (!shareableFile) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }
    if (!shareableFile.isActive) {
      return NextResponse.json({ error: 'This share link has been deactivated' }, { status: 410 });
    }
    if (shareableFile.expiresAt && new Date(shareableFile.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
    }
    if (shareableFile.mimeType !== 'application/x-directory') {
      return NextResponse.json({ error: 'Not a folder share link' }, { status: 400 });
    }

    const folderPrefix = shareableFile.s3Key.endsWith('/')
      ? shareableFile.s3Key
      : `${shareableFile.s3Key}/`;

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

    // ShareableFile.updatedAt is @updatedAt in Prisma (client-managed) — set
    // explicitly here, matching that behavior.
    await db.update(shareableFileTable).set({
      viewCount: sql`${shareableFileTable.viewCount} + 1`,
      lastViewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(shareableFileTable.shareToken, shareToken));

    return NextResponse.json({
      folderName: shareableFile.fileName,
      s3Key: folderPrefix,
      items: [...folders, ...files],
      createdAt: new Date(shareableFile.createdAt).toISOString(),
    });
  } catch (error: any) {
    console.error('[shared/folder] error:', error);
    return NextResponse.json({ error: 'Failed to load folder', details: error.message }, { status: 500 });
  }
}