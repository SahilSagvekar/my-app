import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl } from '@/lib/s3';

// GET /api/shared/file/[shareToken] - Access a shared file
export async function GET(
    req: NextRequest,
    { params }: { params: { shareToken: string } }
) {
    try {
        const { shareToken } = params;

        if (!shareToken) {
            return NextResponse.json({ error: 'Share token required' }, { status: 400 });
        }

        // Find the shareable file
        const shareableFile = await prisma.shareableFile.findUnique({
            where: { shareToken },
        });

        if (!shareableFile) {
            return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
        }

        // Check if the link is active
        if (!shareableFile.isActive) {
            return NextResponse.json({ error: 'This share link has been deactivated' }, { status: 410 });
        }

        // Check if the link has expired
        if (shareableFile.expiresAt && shareableFile.expiresAt < new Date()) {
            return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
        }

        // Generate a fresh signed URL for the file (lasts 7 days)
        const signedUrl = await generateSignedUrl(shareableFile.s3Key);

        // Update view count and last viewed timestamp
        await prisma.shareableFile.update({
            where: { shareToken },
            data: {
                viewCount: { increment: 1 },
                lastViewedAt: new Date(),
            }
        });

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
