import { getR2Bucket } from '@/lib/drive/r2';
import { serveR2Object } from '@/lib/drive/serve-r2';

export const dynamic = 'force-dynamic';

/** Same-origin delivery for revision comment uploads stored under comments/. */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!key.startsWith('comments/') || key.split('/').some((part) => !part || part === '.' || part === '..')) {
    return new Response('Not found', { status: 404 });
  }

  try {
    return await serveR2Object(request, key, {
      disposition: 'inline',
      cacheControl: 'private, max-age=3600',
    });
  } catch (error) {
    console.error('[GET /api/revision-media] Failed to read revision media:', error);
    return new Response('Media unavailable', { status: 502 });
  }
}
