export const dynamic = 'force-dynamic';
// src/app/api/drive/thumb/route.ts
//
// Drive thumbnails (.thumbnails/<key>.jpg and MediaPreview images), read
// straight from the R2 binding. The URL is minted in the folder tree with an
// HMAC token for this exact key, so a folder of 200 thumbnails costs 200
// signature checks — no session lookups, no presigning. Long browser cache:
// the tree adds ?v= when a thumbnail changes.

import { NextRequest, NextResponse } from 'next/server';
import { verifyDriveToken } from '@/lib/drive/url-tokens';
import { serveR2Object } from '@/lib/drive/serve-r2';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get('k') || '';
  if (!key || key.includes('..')) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  if (!(await verifyDriveToken('thumb', key, sp.get('e'), sp.get('s')))) {
    return new NextResponse('Link expired', { status: 403 });
  }
  try {
    return await serveR2Object(req, key, { cacheControl: 'private, max-age=86400' });
  } catch (err: any) {
    console.error('[drive/thumb] error:', err?.message);
    return new NextResponse('Thumbnail unavailable', { status: 502 });
  }
}
