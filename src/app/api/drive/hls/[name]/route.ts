export const dynamic = 'force-dynamic';
// src/app/api/drive/hls/[name]/route.ts
//
// Serves a video's 720p HLS rendition and scrub sprites from R2
// (.hls/<id>/index.m3u8, seg_00000.ts…, sprite_001.jpg…, sprite.vtt), which
// the file server's transcoder produced. Everything is read through the R2
// binding — segments never need presigning.
//
// Auth: the player gets a signed URL from /api/drive/preview. The playlist
// and VTT reference their segments/sprites by RELATIVE name, and a relative
// URL drops the query string — so this route rewrites those references to
// carry the same token. Segment requests then cost one HMAC check each.

import { NextRequest, NextResponse } from 'next/server';
import { verifyDriveToken } from '@/lib/drive/url-tokens';
import { getR2Bucket } from '@/lib/drive/r2';
import { serveR2Object } from '@/lib/drive/serve-r2';

const ALLOWED = /^(index\.m3u8|seg_\d{5}\.ts|sprite_\d{3}\.jpg|sprite\.vtt)$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const sp = req.nextUrl.searchParams;
  const key = sp.get('k') || '';
  const prefix = sp.get('p') || '';
  if (!ALLOWED.test(name) || !prefix.startsWith('.hls/') || !prefix.endsWith('/') || prefix.includes('..')) {
    return new NextResponse('Not found', { status: 404 });
  }
  if (!(await verifyDriveToken('hls', `${key}\n${prefix}`, sp.get('e'), sp.get('s')))) {
    return new NextResponse('Link expired', { status: 403 });
  }

  const token = new URLSearchParams({ k: key, p: prefix, e: sp.get('e') || '', s: sp.get('s') || '' }).toString();
  const objectKey = `${prefix}${name}`;

  try {
    if (name === 'index.m3u8' || name === 'sprite.vtt') {
      const obj = await getR2Bucket().get(objectKey);
      if (!obj) return new NextResponse('Not found', { status: 404 });
      const text = await obj.text();
      const body = name === 'index.m3u8'
        ? text.split('\n').map((line) => (line && !line.startsWith('#') ? `${line.trim()}?${token}` : line)).join('\n')
        : text.replace(/(sprite_\d{3}\.jpg)(#xywh=)/g, `$1?${token}$2`);
      return new NextResponse(body, {
        headers: {
          'Content-Type': name === 'index.m3u8' ? 'application/vnd.apple.mpegurl' : 'text/vtt; charset=utf-8',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }
    return await serveR2Object(req, objectKey, {
      cacheControl: 'private, max-age=31536000, immutable',
      contentType: name.endsWith('.ts') ? 'video/mp2t' : 'image/jpeg',
    });
  } catch (err: any) {
    console.error('[drive/hls] error:', err?.message);
    return new NextResponse('Preview unavailable', { status: 502 });
  }
}
