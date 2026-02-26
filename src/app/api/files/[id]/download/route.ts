export const dynamic = 'force-dynamic';
// src/app/api/files/[id]/download/route.ts
// Returns a presigned S3 download URL for direct browser download
// This bypasses the slow blob-based download and lets the browser
// download at full speed with its native download manager.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractS3KeyFromUrl, generateDownloadUrl } from '@/lib/s3';

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: fileId } = await context.params;

        // Find the file record
        const file = await prisma.file.findUnique({
            where: { id: fileId },
            select: {
                id: true,
                url: true,
                s3Key: true,
                name: true,
            },
        });

        if (!file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Get the S3 key
        const s3Key = file.s3Key || extractS3KeyFromUrl(file.url);

        if (!s3Key) {
            // Not an S3 file — redirect to the original URL
            return NextResponse.redirect(file.url);
        }

        // Generate a presigned download URL (with Content-Disposition: attachment)
        // This tells the browser to download the file instead of displaying it
        const downloadUrl = await generateDownloadUrl(s3Key, file.name);

        // Redirect the browser directly to the presigned S3 download URL
        // The browser's native download manager handles the rest at full speed
        return NextResponse.redirect(downloadUrl);

    } catch (err: any) {
        console.error('❌ Download URL generation error:', err.message);
        return NextResponse.json(
            { error: 'Failed to generate download URL' },
            { status: 500 }
        );
    }
}
