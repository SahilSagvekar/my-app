import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { file } from '@/lib/db/schema';
import { generateSignedUrl } from '@/lib/s3';
import { getCurrentUser2 } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: fileId } = await params;

        // 1. Auth check
        const user = await getCurrentUser2(request);
        if (!user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 2. Get file details (Drizzle — Prisma's native engine can't run
        // on Cloudflare Workers, same reason the other ~330 routes were
        // already converted)
        const db = getDbHttp();
        const [fileRow] = await db
            .select()
            .from(file)
            .where(eq(file.id, fileId))
            .limit(1);

        if (!fileRow || !fileRow.s3Key) {
            return new NextResponse('File not found', { status: 404 });
        }

        if (fileRow.deletedFromCloud) {
            // No longer in R2 — redirect to the NAS proxy instead of hard-
            // blocking. KNOWN LIMITATION: /api/drive/nas-stream (and
            // e8-file-server's /nas-download underneath it) does not
            // support Range requests, so video scrubbing/seeking on a
            // NAS-only file won't work smoothly the way it does from R2 —
            // playback will start, but seeking may re-fetch from the start.
            // Fine for occasional archived-file playback; if this becomes
            // a common case, nas-upload-server's /download endpoint needs
            // Range support end-to-end.
            const params = new URLSearchParams({ s3Key: fileRow.s3Key, fileName: fileRow.name || fileRow.s3Key.split('/').pop() || 'file' });
            return NextResponse.redirect(new URL(`/api/drive/nas-stream?${params.toString()}`, request.url));
        }

        // 3. Handle Range Requests (Crucial for video scrubbing/streaming)
        const range = request.headers.get('range');

        // Presign, then plain fetch() — do NOT let the AWS SDK sign-and-send
        // the request from inside the Worker. Cloudflare Workers' fetch()
        // runtime can normalize/alter outgoing headers (especially Range),
        // which invalidates a SigV4 signature computed just beforehand and
        // produces SignatureDoesNotMatch even with correct credentials.
        // Presigned URLs avoid this because signing happens once, up front,
        // and the header set that gets signed is fixed in the query string —
        // the same pattern already used successfully for uploads.
        const signedUrl = await generateSignedUrl(fileRow.s3Key, 3600);

        const upstream = await fetch(signedUrl, {
            headers: range ? { Range: range } : {},
        });

        if (!upstream.ok && upstream.status !== 206) {
            console.error('Streaming error: upstream fetch failed', upstream.status, await upstream.text().catch(() => ''));
            return new NextResponse('Could not fetch file from storage', { status: 502 });
        }

        // 4. Build Response Headers
        const headers = new Headers();
        headers.set('Content-Type', fileRow.mimeType || upstream.headers.get('content-type') || 'video/mp4');
        headers.set('Accept-Ranges', 'bytes');

        const contentLength = upstream.headers.get('content-length');
        if (contentLength) {
            headers.set('Content-Length', contentLength);
        }

        const contentRange = upstream.headers.get('content-range');
        if (contentRange) {
            headers.set('Content-Range', contentRange);
        }

        headers.set('Cache-Control', 'public, max-age=3600');

        // 5. Return stream
        const status = range ? 206 : 200;
        return new NextResponse(upstream.body, {
            status,
            headers,
        });

    } catch (error: any) {
        console.error('Streaming error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}