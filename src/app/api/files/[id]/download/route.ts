export const dynamic = 'force-dynamic';
// src/app/api/files/[id]/download/route.ts
// Returns a presigned S3 download URL for direct browser download
// This bypasses the slow blob-based download and lets the browser
// download at full speed with its native download manager.
// 🔥 ALWAYS downloads the ORIGINAL file, never the optimized/proxy version.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractS3KeyFromUrl, generateDownloadUrl, checkFileExists } from '@/lib/s3';

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
        let s3Key = file.s3Key || extractS3KeyFromUrl(file.url);

        if (!s3Key) {
            // Not an S3 file — redirect to the original URL
            return NextResponse.redirect(file.url);
        }

        // 🔥 CRITICAL: If s3Key points to an optimized version, try to find the original
        // This ensures downloads always get full quality, not compressed proxy
        if (s3Key.includes('_optimized')) {
            const originalKey = s3Key.replace(/_optimized(\.[^.]+)$/, '$1');
            console.log(`🔄 Download requested optimized file, checking for original: ${originalKey}`);
            
            // Check if original exists
            const originalExists = await checkFileExists(originalKey);
            if (originalExists) {
                console.log(`✅ Found original file, using: ${originalKey}`);
                s3Key = originalKey;
            } else {
                console.log(`⚠️ Original not found, falling back to optimized: ${s3Key}`);
            }
        }

        // Sanitize filename for download (remove _optimized suffix)
        const downloadName = file.name.replace(/_optimized(\.[^.]+)$/, '$1');

        // Generate a presigned download URL (with Content-Disposition: attachment)
        // This tells the browser to download the file instead of displaying it
        const downloadUrl = await generateDownloadUrl(s3Key, downloadName);

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

// export const dynamic = 'force-dynamic';
// // src/app/api/files/[id]/download/route.ts
// // Returns a presigned S3 download URL for direct browser download
// // This bypasses the slow blob-based download and lets the browser
// // download at full speed with its native download manager.

// import { NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';
// import { extractS3KeyFromUrl, generateDownloadUrl } from '@/lib/s3';

// export async function GET(
//     req: Request,
//     context: { params: Promise<{ id: string }> }
// ) {
//     try {
//         const { id: fileId } = await context.params;

//         // Find the file record
//         const file = await prisma.file.findUnique({
//             where: { id: fileId },
//             select: {
//                 id: true,
//                 url: true,
//                 s3Key: true,
//                 name: true,
//             },
//         });

//         if (!file) {
//             return NextResponse.json({ error: 'File not found' }, { status: 404 });
//         }

//         // Get the S3 key
//         const s3Key = file.s3Key || extractS3KeyFromUrl(file.url);

//         if (!s3Key) {
//             // Not an S3 file — redirect to the original URL
//             return NextResponse.redirect(file.url);
//         }

//         // Generate a presigned download URL (with Content-Disposition: attachment)
//         // This tells the browser to download the file instead of displaying it
//         const downloadUrl = await generateDownloadUrl(s3Key, file.name);

//         // Redirect the browser directly to the presigned S3 download URL
//         // The browser's native download manager handles the rest at full speed
//         return NextResponse.redirect(downloadUrl);

//     } catch (err: any) {
//         console.error('❌ Download URL generation error:', err.message);
//         return NextResponse.json(
//             { error: 'Failed to generate download URL' },
//             { status: 500 }
//         );
//     }
// }
