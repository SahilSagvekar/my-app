export const dynamic = 'force-dynamic';
// src/app/api/files/[id]/stream/route.ts
// Video streaming proxy with HTTP Range request support
// This enables efficient video playback by serving byte ranges from S3

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getS3, extractS3KeyFromUrl } from '@/lib/s3';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.AWS_S3_BUCKET!;

// ─── Bounded cache for S3 HEAD results ───
// Prevents unbounded memory growth that causes daily server crashes.
const MAX_CACHE_ENTRIES = 200;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const contentInfoCache = new Map<string, { size: number; contentType: string; timestamp: number }>();

// Periodic cleanup of expired entries
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function maintainCache() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;

    for (const [key, entry] of contentInfoCache) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
            contentInfoCache.delete(key);
        }
    }
}

async function getContentInfo(s3Key: string): Promise<{ size: number; contentType: string }> {
    maintainCache();

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

    // Evict oldest entries if cache is full
    if (contentInfoCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = contentInfoCache.keys().next().value;
        if (firstKey) contentInfoCache.delete(firstKey);
    }

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

            // Use AbortSignal to clean up the S3 stream when the client disconnects
            // (e.g., user seeks to a new position). Without this, orphaned streams
            // accumulate and leak memory/connections.
            const abortController = new AbortController();
            const s3Response = await s3.send(getCommand, { abortSignal: abortController.signal });
            const bodyStream = s3Response.Body as ReadableStream;

            // If the client disconnects, abort the S3 fetch
            req.signal?.addEventListener('abort', () => {
                abortController.abort();
            });

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

            const abortController = new AbortController();
            const s3Response = await s3.send(getCommand, { abortSignal: abortController.signal });
            const bodyStream = s3Response.Body as ReadableStream;

            req.signal?.addEventListener('abort', () => {
                abortController.abort();
            });

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
