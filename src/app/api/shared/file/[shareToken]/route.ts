export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shareableFile as shareableFileTable } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateSignedUrl } from '@/lib/s3';

// GET /api/shared/file/[shareToken] - Access a shared file
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

        // Find the shareable file
        const [shareableFile] = await db.select().from(shareableFileTable)
            .where(eq(shareableFileTable.shareToken, shareToken)).limit(1);

        if (!shareableFile) {
            return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
        }

        // Check if the link is active
        if (!shareableFile.isActive) {
            return NextResponse.json({ error: 'This share link has been deactivated' }, { status: 410 });
        }

        // Check if the link has expired
        if (shareableFile.expiresAt && new Date(shareableFile.expiresAt) < new Date()) {
            return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
        }

        // Generate a fresh signed URL for the file (lasts 7 days)
        const signedUrl = await generateSignedUrl(shareableFile.s3Key);

        // Update view count and last viewed timestamp.
        // ShareableFile.updatedAt is @updatedAt in Prisma (client-managed) —
        // set explicitly here, matching that behavior.
        await db.update(shareableFileTable).set({
            viewCount: sql`${shareableFileTable.viewCount} + 1`,
            lastViewedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }).where(eq(shareableFileTable.shareToken, shareToken));

        // Format file size
        const formatBytes = (bytes: BigInt | number | null): string => {
            if (!bytes) return 'Unknown size';
            const b = Number(bytes);
            if (b === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(b) / Math.log(k));
            return Math.round((b / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
        };

        return NextResponse.json({
            success: true,
            fileName: shareableFile.fileName,
            fileSize: formatBytes(shareableFile.fileSize),
            mimeType: shareableFile.mimeType,
            url: signedUrl,
            // NOTE: original Prisma code returned the raw Date here (no
            // .toISOString() call) — JSON.stringify auto-serialized it to
            // ISO-8601. Drizzle's string-mode timestamp is in Postgres's
            // native format instead; left as-is to match this file's
            // original code (unlike the sibling shared/[shareToken] route,
            // which did call .toISOString() explicitly and is preserved).
            createdAt: shareableFile.createdAt,
        });

    } catch (error: any) {
        console.error('Error accessing shared file:', error);
        return NextResponse.json(
            { error: 'Failed to load shared file' },
            { status: 500 }
        );
    }
}
