export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// POST /api/drive/download-zip
// Fetches files directly from R2 and streams a zip to the browser.
// Does NOT go through the file server — avoids the extra hop and socket issues.
// Uses archiver for streaming zip generation (no full-buffer in memory).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { getS3, BUCKET } from '@/lib/s3';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { PassThrough } from 'stream';

// ── List all keys under a prefix ─────────────────────────────────────────────
async function listAllKeys(prefix: string): Promise<string[]> {
  const s3 = getS3();
  const keys: string[] = [];
  let token: string | undefined;
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: normalizedPrefix,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    for (const obj of res.Contents || []) {
      if (obj.Key && obj.Size && obj.Size > 0) keys.push(obj.Key);
    }
    token = res.NextContinuationToken;
  } while (token);
  return keys;
}

// ── Common prefix helper ──────────────────────────────────────────────────────
function getCommonPrefix(keys: string[]): string {
  if (!keys.length) return '';
  const parts = keys[0].split('/');
  let prefix = '';
  for (let depth = 0; depth < parts.length - 1; depth++) {
    const segment = parts.slice(0, depth + 1).join('/') + '/';
    if (keys.every(k => k.startsWith(segment))) prefix = segment;
    else break;
  }
  return prefix;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { keys, folderPrefix, zipName } = body as {
    keys?: string[];
    folderPrefix?: string;
    zipName?: string;
  };

  if (!keys?.length && !folderPrefix) {
    return NextResponse.json({ error: 'Provide keys[] or folderPrefix' }, { status: 400 });
  }

  // Resolve file keys
  let fileKeys: string[] = [];
  if (folderPrefix) {
    fileKeys = await listAllKeys(folderPrefix);
    if (!fileKeys.length) return NextResponse.json({ error: 'Folder is empty' }, { status: 404 });
  } else {
    fileKeys = keys!;
  }

  if (fileKeys.length > 500) {
    return NextResponse.json({ error: 'Too many files (max 500). Try a subfolder.' }, { status: 400 });
  }

  const outputName = zipName || (folderPrefix
    ? `${folderPrefix.split('/').filter(Boolean).pop() || 'download'}.zip`
    : 'download.zip');

  console.log(`[download-zip] user=${user.id} | ${fileKeys.length} files | "${outputName}"`);

  const basePrefix = folderPrefix
    ? (folderPrefix.endsWith('/') ? folderPrefix : `${folderPrefix}/`)
    : getCommonPrefix(fileKeys);

  // PassThrough bridges archiver (Node writable) → ReadableStream (Next.js response)
  const pass = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 1 } }); // level 1 = fast, videos are already compressed

  archive.on('error', (err) => {
    console.error('[download-zip] archiver error:', err.message);
    pass.destroy(err);
  });

  archive.pipe(pass);

  // Run the zip build async — don't await it here so we can return the stream immediately
  (async () => {
    const s3 = getS3();
    for (const key of fileKeys) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        if (!res.Body) { console.warn(`[download-zip] empty body: ${key}`); continue; }

        // Collect into buffer — archiver needs full control of backpressure,
        // piping a live S3 stream causes deadlocks when archiver pauses it.
        const chunks: Uint8Array[] = [];
        for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        const buf = Buffer.concat(chunks);
        const zipPath = key.startsWith(basePrefix) ? key.slice(basePrefix.length) : key.split('/').pop() || 'file';
        archive.append(buf, { name: zipPath });
        console.log(`[download-zip] ✅ ${zipPath} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
      } catch (e: any) {
        console.warn(`[download-zip] skipped ${key}: ${e.message}`);
      }
    }
    await archive.finalize();
    console.log(`[download-zip] ✅ done: "${outputName}"`);
  })();

  // Convert Node PassThrough → web ReadableStream for Next.js
  const webStream = new ReadableStream({
    start(controller) {
      pass.on('data', (chunk) => controller.enqueue(chunk));
      pass.on('end', () => controller.close());
      pass.on('error', (err) => controller.error(err));
    },
    cancel() {
      archive.abort();
      pass.destroy();
    },
  });

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${outputName.replace(/[^a-zA-Z0-9._\- ]/g, '_')}"`,
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}