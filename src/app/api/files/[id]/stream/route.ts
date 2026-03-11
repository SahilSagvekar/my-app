export const dynamic = 'force-dynamic';
// src/app/api/files/[id]/stream/route.ts
// Video streaming proxy with HTTP Range request support
// This enables efficient video playback by serving byte ranges from S3

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getS3, extractS3KeyFromUrl } from '@/lib/s3';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.AWS_S3_BUCKET!;

// Cache content info for 5 minutes to avoid repeated HEAD requests
const contentInfoCache = new Map<string, { size: number; contentType: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getContentInfo(s3Key: string): Promise<{ size: number; contentType: string }> {
    const cached = contentInfoCache.get(s3Key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return { size: cached.size, contentType: cached.contentType };
    }

    const s3 = getS3();
    const headCommand = new HeadObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
    });

    const headResult = await s3.send(headCommand);
    const info = {
        size: headResult.ContentLength || 0,
        contentType: headResult.ContentType || 'video/mp4',
    };

    contentInfoCache.set(s3Key, { ...info, timestamp: Date.now() });
    return info;
}

/**
 * GET /api/files/[id]/stream
 * 
 * Streams video content from S3 with Range request support.
 * This enables:
 * - Instant video playback (no need to download entire file)
 * - Smooth seeking to any position
 * - Efficient bandwidth usage
 * 
 * The browser's native video player sends Range headers automatically.
 */
export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: fileId } = await context.params;

        // 1. Find the file record in the database
        const file = await prisma.file.findUnique({
            where: { id: fileId },
            select: {
                id: true,
                url: true,
                s3Key: true,
                name: true,
                mimeType: true,
            },
        });

        if (!file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // 2. Determine S3 key
        const s3Key = file.s3Key || extractS3KeyFromUrl(file.url);
        if (!s3Key) {
            // Not an S3 file — redirect to original URL
            return NextResponse.redirect(file.url);
        }

        // 3. Get file size and content type
        const { size: fileSize, contentType } = await getContentInfo(s3Key);

        if (fileSize === 0) {
            return NextResponse.json({ error: 'File has zero size' }, { status: 404 });
        }

        // 4. Parse Range header
        const rangeHeader = req.headers.get('range');
        const s3 = getS3();

        if (rangeHeader) {
            // Handle Range request (206 Partial Content)
            const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            if (!rangeMatch) {
                return new Response('Invalid Range header', { status: 416 });
            }

            const start = parseInt(rangeMatch[1], 10);
            // Default chunk size: 1MB to reduce latency on high-latency connections
            const DEFAULT_CHUNK_SIZE = 1 * 1024 * 1024;
            const requestedEnd = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : undefined;
            const end = requestedEnd !== undefined
                ? Math.min(requestedEnd, fileSize - 1)
                : Math.min(start + DEFAULT_CHUNK_SIZE - 1, fileSize - 1);

            if (start >= fileSize) {
                return new Response('Range Not Satisfiable', {
                    status: 416,
                    headers: { 'Content-Range': `bytes */${fileSize}` },
                });
            }

            const getCommand = new GetObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
                Range: `bytes=${start}-${end}`,
            });

            const s3Response = await s3.send(getCommand);
            const bodyStream = s3Response.Body as ReadableStream;

            return new Response(bodyStream as any, {
                status: 206,
                headers: {
                    'Content-Type': contentType,
                    'Content-Length': String(end - start + 1),
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
                },
            });
        } else {
            // No Range header — return full file with Accept-Ranges to signal support
            // Browsers will typically follow up with range requests
            const getCommand = new GetObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
            });

            const s3Response = await s3.send(getCommand);
            const bodyStream = s3Response.Body as ReadableStream;

            return new Response(bodyStream as any, {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Content-Length': String(fileSize),
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
                },
            });
        }
    } catch (err: any) {
        console.error('❌ Video stream error:', err.message);

        if (err.name === 'NoSuchKey') {
            return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
        }

        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * HEAD /api/files/[id]/stream
 * 
 * Returns file metadata without the body.
 * The browser uses this to determine file size before sending Range requests.
 */
export async function HEAD(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: fileId } = await context.params;

        const file = await prisma.file.findUnique({
            where: { id: fileId },
            select: {
                id: true,
                url: true,
                s3Key: true,
                mimeType: true,
            },
        });

        if (!file) {
            return new Response(null, { status: 404 });
        }

        const s3Key = file.s3Key || extractS3KeyFromUrl(file.url);
        if (!s3Key) {
            return new Response(null, { status: 404 });
        }

        const { size: fileSize, contentType } = await getContentInfo(s3Key);

        return new Response(null, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(fileSize),
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
            },
        });
    } catch (err: any) {
        console.error('❌ Video stream HEAD error:', err.message);
        return new Response(null, { status: 500 });
    }
}

// Handle CORS preflight
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
        },
    });
}
