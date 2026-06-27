export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// POST /api/drive/download-zip
// Streams each R2 file one at a time into archiver with proper backpressure.
// Each file is appended and we await the archiver 'entry' event before fetching
// the next — 'entry' fires only after archiver has fully written that file out,
// so memory stays flat (one file in flight at a time) regardless of folder size.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { getS3, BUCKET } from '@/lib/s3';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';

async function listAllKeys(prefix: string): Promise<string[]> {
  const s3 = getS3();
  const keys: string[] = [];
  let token: string | undefined;
  const p = prefix.endsWith('/') ? prefix : `${prefix}/`;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: p, ContinuationToken: token, MaxKeys: 1000 }));
    for (const obj of res.Contents || []) {
      if (obj.Key && obj.Size && obj.Size > 0) keys.push(obj.Key);
    }
    token = res.NextContinuationToken;
  } while (token);
  return keys;
}

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

// Convert AWS SDK AsyncIterable body to Node Readable without buffering
function sdkBodyToReadable(body: AsyncIterable<Uint8Array>): Readable {
  const readable = new Readable({ read() {} });
  (async () => {
    try {
      for await (const chunk of body) readable.push(chunk);
      readable.push(null);
    } catch (e: any) {
      readable.destroy(e);
    }
  })();
  return readable;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { keys, folderPrefix, zipName } = body as { keys?: string[]; folderPrefix?: string; zipName?: string };

  if (!keys?.length && !folderPrefix) {
    return NextResponse.json({ error: 'Provide keys[] or folderPrefix' }, { status: 400 });
  }

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

  const basePrefix = folderPrefix
    ? (folderPrefix.endsWith('/') ? folderPrefix : `${folderPrefix}/`)
    : getCommonPrefix(fileKeys);

  console.log(`[download-zip] user=${user.id} | ${fileKeys.length} files | "${outputName}"`);

  const pass = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 0 } }); // store-only: videos are already compressed

  // Raise listener limit — we add one 'entry' listener per file sequentially
  archive.setMaxListeners(fileKeys.length + 10);

  archive.on('error', (err) => {
    console.error('[download-zip] archiver error:', err.message);
    pass.destroy(err);
  });

  archive.pipe(pass);

  (async () => {
    const s3 = getS3();
    for (const key of fileKeys) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        if (!res.Body) { console.warn(`[download-zip] empty body: ${key}`); continue; }

        const zipPath = key.startsWith(basePrefix)
          ? key.slice(basePrefix.length)
          : (key.split('/').pop() || 'file');

        const nodeStream = sdkBodyToReadable(res.Body as AsyncIterable<Uint8Array>);

        // Wait for archiver to fully write this entry before fetching the next file.
        // The 'entry' event fires AFTER archiver has flushed the file data to output,
        // so awaiting it keeps only one file's data in memory at a time.
        await new Promise<void>((resolve, reject) => {
          const onEntry = (entry: any) => {
            if (entry.name === zipPath) {
              archive.removeListener('error', reject);
              resolve();
            }
          };
          archive.once('error', reject);
          archive.on('entry', onEntry);
          nodeStream.once('error', (e) => {
            archive.removeListener('entry', onEntry);
            archive.removeListener('error', reject);
            reject(e);
          });
          archive.append(nodeStream, { name: zipPath });
        });

        const sizeMB = res.ContentLength ? (res.ContentLength / 1024 / 1024).toFixed(1) : '?';
        console.log(`[download-zip] ✅ ${zipPath} (${sizeMB} MB)`);
      } catch (e: any) {
        console.warn(`[download-zip] skipped ${key}: ${e.message}`);
      }
    }
    await archive.finalize();
    console.log(`[download-zip] ✅ done: "${outputName}"`);
  })();

  // Bridge Node PassThrough → web ReadableStream for Next.js response
  const webStream = new ReadableStream({
    start(controller) {
      pass.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
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
    },
  });
}
