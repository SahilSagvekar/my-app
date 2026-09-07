import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getMediaPreviewStream } from '@/lib/file-server';
import { getDbHttp } from '@/lib/db';
import { mediaPreview } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const key = new URL(req.url).searchParams.get('key');
  if (!key || key.includes('..') || key.startsWith('/')) {
    return new NextResponse('Invalid preview key', { status: 400 });
  }

  // Do not let an authenticated caller turn this endpoint into a generic R2
  // proxy. Only preview keys recorded by the generator may be streamed.
  const [knownPreview] = await getDbHttp()
    .select({ id: mediaPreview.id })
    .from(mediaPreview)
    .where(eq(mediaPreview.previewS3Key, key))
    .limit(1);
  if (!knownPreview) return new NextResponse('Preview not found', { status: 404 });

  try {
    try {
      const { env } = getCloudflareContext();
      if (env?.FILE_SERVER) {
        const upstream = await getMediaPreviewStream(env, user.id, user.role, key);
        const headers = new Headers();
        headers.set('Content-Type', upstream.headers.get('content-type') || 'image/webp');
        headers.set('Cache-Control', 'private, max-age=3600');
        const length = upstream.headers.get('content-length');
        if (length) headers.set('Content-Length', length);
        return new NextResponse(upstream.body, { status: 200, headers });
      }
    } catch (cfError: unknown) {
      // Fall through to direct S3/R2 presigned URL fetch
    }

    // Direct S3/R2 fallback
    const { generateSignedUrl } = await import('@/lib/s3');
    const signedUrl = await generateSignedUrl(key, 3600);
    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      return new NextResponse('Preview unavailable', { status: 502 });
    }
    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('content-type') || 'image/webp');
    headers.set('Cache-Control', 'private, max-age=3600');
    const length = upstream.headers.get('content-length');
    if (length) headers.set('Content-Length', length);
    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error: unknown) {
    console.error('[media-preview] image stream failed:', error);
    return new NextResponse('Preview unavailable', { status: 502 });
  }
}
