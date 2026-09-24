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

        // 3. Redirect straight to a presigned R2 URL instead of proxying the
        // video bytes through the Worker. This route used to fetch() the
        // signed URL itself and pipe the response body through — meaning
        // every concurrent QC viewer's video stream (Range requests included,
        // for scrubbing) ran through this Worker's shared isolate memory
        // alongside uploads and everyone else's requests. R2 presigned GET
        // URLs don't sign the Range header (confirmed by the old code above
        // successfully adding one after signing), so the browser's <video>
        // element can issue its own Range requests directly against this URL
        // — same as it always could for uploads via presigned PUT URLs.
        // Browsers resolve a 302 on a media src and reuse the resolved URL
        // for subsequent Range requests during that playback session, so the
        // signed URL's lifetime needs to outlast a normal viewing session,
        // not just this one redirect.
        const signedUrl = await generateSignedUrl(fileRow.s3Key, 3600);
        return NextResponse.redirect(signedUrl, 302);

    } catch (error: any) {
        console.error('Streaming error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}