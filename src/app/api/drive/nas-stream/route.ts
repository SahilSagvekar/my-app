export const dynamic = 'force-dynamic';
// src/app/api/drive/nas-stream/route.ts
//
// Streams a file that has been archived to the NAS and removed from R2.
// Every caller (/api/drive/download, /api/drive/file, /api/files/[id]/stream)
// requests /api/drive/nas-stream — but the route file was still sitting one
// folder too deep at src/app/api/drive/share/nas-stream/, so the real path
// 404'd. This is that route at the path callers actually use, plus an access
// check (before, any logged-in user could pull any archived key).
//
// Same-origin so the session cookie covers auth. Proxies to e8-file-server's
// /nas-download over the service binding and passes the stream straight
// through without buffering it in Worker memory.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { nasDownloadStream } from '@/lib/file-server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { userCanAccessKey } from '@/lib/drive/access';

export async function GET(req: NextRequest) {
  const { env } = getCloudflareContext();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const s3Key = searchParams.get('s3Key');
    const fileName = searchParams.get('fileName') || undefined;
    if (!s3Key) return NextResponse.json({ error: 'Missing s3Key' }, { status: 400 });
    if (!(await userCanAccessKey(user, s3Key))) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const upstream = await nasDownloadStream(env, user.id, user.role, s3Key, fileName);

    const headers = new Headers();
    for (const [key, value] of upstream.headers.entries()) {
      if (['content-type', 'content-disposition', 'content-length'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    if (!headers.has('content-disposition')) {
      headers.set('content-disposition', `attachment; filename="${(fileName || s3Key.split('/').pop() || 'file').replace(/"/g, '')}"`);
    }

    return new Response(upstream.body, { status: upstream.ok ? 200 : upstream.status, headers });
  } catch (err: any) {
    console.error('NAS stream error:', err);
    return NextResponse.json({ error: 'Failed to stream file from NAS' }, { status: 500 });
  }
}
