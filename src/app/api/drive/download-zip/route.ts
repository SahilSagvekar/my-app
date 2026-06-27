export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — large folders need time

// POST /api/drive/download-zip
// Accepts keys[] (explicit file S3 keys) or folderPrefix (download whole folder).
// Auth-gates the request, then proxies a streaming zip from the file server.
// The file server uses archiver (stream-per-file, no RAM buffer) so this works
// for large video folders that would OOM the old JSZip approach.
//
// Frontend contract is unchanged — same body shape, same response shape.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { streamZip } from '@/lib/file-server';

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // ── 2. Parse body ─────────────────────────────────────────────────────────
    const body = await req.json();
    const { keys, folderPrefix, zipName } = body as {
      keys?: string[];
      folderPrefix?: string;
      zipName?: string;
    };

    if (!keys?.length && !folderPrefix) {
      return NextResponse.json({ error: 'Provide keys[] or folderPrefix' }, { status: 400 });
    }

    // ── 3. Forward to file server — streams zip back, no RAM buffer ───────────
    console.log(`[download-zip] user=${user.id} role=${user.role} | ${folderPrefix ? `folder: ${folderPrefix}` : `${keys?.length} keys`}`);

    const fsRes = await streamZip(user.id, user.role, { keys, folderPrefix, zipName });

    // File server returns non-200 with a JSON error body on failure
    if (!fsRes.ok) {
      const errBody = await fsRes.json().catch(() => ({ error: 'File server error' }));
      console.error('[download-zip] File server error:', fsRes.status, errBody);
      return NextResponse.json(
        { error: errBody.error || `File server returned ${fsRes.status}` },
        { status: fsRes.status },
      );
    }

    // ── 4. Stream the zip body straight to the browser ────────────────────────
    // Pass through Content-Disposition and Content-Type from the file server.
    // Do NOT set Content-Length — the zip is streamed with Transfer-Encoding: chunked,
    // so the total size isn't known upfront (archiver writes as it goes).
    const disposition = fsRes.headers.get('Content-Disposition') || `attachment; filename="${zipName || 'download.zip'}"`;
    const contentType = fsRes.headers.get('Content-Type') || 'application/zip';

    return new NextResponse(fsRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-store',
        // Allow the browser to show a download progress bar when possible
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    console.error('[download-zip] ❌', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed to create zip' },
      { status: 500 },
    );
  }
}