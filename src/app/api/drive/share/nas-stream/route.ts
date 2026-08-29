export const dynamic = 'force-dynamic';
// src/app/api/drive/nas-stream/route.ts
//
// The browser navigates here directly (e.g. window.open / <a href>) for
// files that have been deleted from R2 but are confirmed backed up to NAS.
// Same-origin so the existing session cookie covers auth — no separate
// token scheme needed. Internally proxies to e8-file-server's /nas-download
// via the existing Worker service binding (server-to-server, not public).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { nasDownloadStream } from '@/lib/file-server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(req: NextRequest) {
  const { env } = getCloudflareContext();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const s3Key = searchParams.get('s3Key');
    const fileName = searchParams.get('fileName') || undefined;
    if (!s3Key) return NextResponse.json({ error: 'Missing s3Key' }, { status: 400 });

    const upstream = await nasDownloadStream(env, user.id, user.role, s3Key, fileName);

    // Pass the stream straight through — don't buffer the whole file in
    // Worker memory, and preserve whatever headers e8-file-server set
    // (Content-Type, Content-Disposition, Content-Length if known).
    const headers = new Headers();
    for (const [key, value] of upstream.headers.entries()) {
      if (['content-type', 'content-disposition', 'content-length'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    if (!headers.has('content-disposition')) {
      headers.set('content-disposition', `attachment; filename="${fileName || s3Key.split('/').pop()}"`);
    }

    return new Response(upstream.body, { status: 200, headers });
  } catch (err: any) {
    console.error('NAS stream error:', err);
    return NextResponse.json({ error: 'Failed to stream file from NAS' }, { status: 500 });
  }
}