// src/lib/drive/serve-r2.ts
//
// Stream an R2 object to the browser through the Worker's R2 binding, with
// HTTP Range support (so <video> can seek). Used for Drive "Open"/preview,
// thumbnails and HLS segments. No presigning, no CORS, same-origin cookies.

import { getR2Bucket, type R2BucketLike } from './r2';
import { mimeFromName } from './keys';

function parseRange(header: string | null, size: number): { offset: number; length: number } | 'invalid' | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null; // multi-range etc. — just send the whole thing
  const [, a, b] = m;
  if (a === '' && b === '') return 'invalid';
  let start: number;
  let end: number;
  if (a === '') {
    const suffix = parseInt(b, 10);
    if (!suffix) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = parseInt(a, 10);
    end = b === '' ? size - 1 : Math.min(parseInt(b, 10), size - 1);
  }
  if (start >= size || end < start) return 'invalid';
  return { offset: start, length: end - start + 1 };
}

// Only these render inline; anything else (html, svg, js, office docs…) downloads.
function isSafeInlineType(contentType: string): boolean {
  const t = contentType.split(';')[0].trim().toLowerCase();
  if (t === 'image/svg+xml') return false;
  return t.startsWith('video/') || t.startsWith('audio/') || t.startsWith('image/') || t === 'application/pdf' || t === 'text/plain';
}

export async function serveR2Object(
  request: Request,
  key: string,
  opts: { bucket?: R2BucketLike; cacheControl?: string; disposition?: 'inline' | 'attachment'; fileName?: string; contentType?: string } = {},
): Promise<Response> {
  const bucket = opts.bucket || getR2Bucket();
  const head = await bucket.head(key);
  if (!head) return new Response('Not found', { status: 404 });

  const size = head.size;
  const contentType = opts.contentType || head.httpMetadata?.contentType || mimeFromName(key);
  const headers = new Headers({
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': opts.cacheControl || 'private, max-age=3600',
    ETag: head.httpEtag,
    // These files are user uploads served from OUR origin. Never let one run
    // script here (an uploaded .html/.svg opened by an admin would otherwise
    // execute with the admin's session): no sniffing, and a sandbox CSP.
    'X-Content-Type-Options': 'nosniff',
  });
  // (Not on PDFs: Chrome refuses to open its PDF viewer in a sandboxed document,
  // and a PDF's own scripts run in the viewer, not in our origin.)
  if (!contentType.toLowerCase().startsWith('application/pdf')) {
    headers.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'unsafe-inline'");
  }
  let disposition = opts.disposition;
  if (disposition === 'inline' && !isSafeInlineType(contentType)) disposition = 'attachment';
  if (disposition) {
    const name = (opts.fileName || key.split('/').pop() || 'file').replace(/["\r\n]/g, '');
    headers.set('Content-Disposition', `${disposition}; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  }

  if (request.method === 'HEAD') {
    headers.set('Content-Length', String(size));
    return new Response(null, { status: 200, headers });
  }

  if (request.headers.get('if-none-match') === head.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  const range = parseRange(request.headers.get('range'), size);
  if (range === 'invalid') {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response('Range not satisfiable', { status: 416, headers });
  }

  const obj = await bucket.get(key, range ? { range } : undefined);
  if (!obj) return new Response('Not found', { status: 404 });

  if (range) {
    headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`);
    headers.set('Content-Length', String(range.length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(size));
  return new Response(obj.body, { status: 200, headers });
}
