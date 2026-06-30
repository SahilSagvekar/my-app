export const dynamic = 'force-dynamic';

// GET /api/drive/download-zip-stream?token=...
// The browser is redirected here (window.location.assign) after POST
// /api/drive/download-zip issues a one-time token. A plain navigation can't
// carry the Bearer header the file server requires, so this route uses the
// authenticated cookie session instead, then mints an internal token and
// pipes the zip stream straight through to the browser without buffering
// the whole archive in memory.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { fetchZipStream } from '@/lib/file-server';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetchZipStream(user.id, user.role, token);
  } catch (error: unknown) {
    console.error('[download-zip-stream] Failed to reach file server:', error);
    return NextResponse.json({ error: 'Failed to start zip download' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.json().catch(() => ({}));
    return NextResponse.json(
      { error: detail.error || `File server error: ${upstream.status}` },
      { status: upstream.status === 410 ? 410 : 502 },
    );
  }

  // Pass the archive straight through — no buffering, so this scales with
  // file count/size the same way the file server's own streaming does.
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/zip',
      'Content-Disposition': upstream.headers.get('content-disposition') || 'attachment; filename="download.zip"',
      'Transfer-Encoding': 'chunked',
    },
  });
}