import { NextRequest, NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { mediaPreview } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

// Batch lookup used by Files & Drive. It deliberately returns an app image
// route, not a raw R2 URL, so preview objects can stay private.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rawKeys = new URL(req.url).searchParams.get('keys');
  if (!rawKeys) return NextResponse.json({ previews: {} });

  const keys = [...new Set(rawKeys.split(',').map(decodeURIComponent).filter(Boolean))].slice(0, 100);
  if (!keys.length) return NextResponse.json({ previews: {} });

  const db = getDbHttp();
  const rows = await db
    .select({
      s3Key: mediaPreview.s3Key,
      status: mediaPreview.status,
      previewS3Key: mediaPreview.previewS3Key,
      width: mediaPreview.width,
      height: mediaPreview.height,
    })
    .from(mediaPreview)
    .where(inArray(mediaPreview.s3Key, keys));

  const previews = Object.fromEntries(rows.map(row => [row.s3Key, {
    status: row.status,
    width: row.width,
    height: row.height,
    url: row.status === 'READY' && row.previewS3Key
      ? `/api/media-previews/image?key=${encodeURIComponent(row.previewS3Key)}`
      : null,
  }]));

  return NextResponse.json({ previews });
}
