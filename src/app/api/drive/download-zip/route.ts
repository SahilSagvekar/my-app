export const dynamic = 'force-dynamic';
// POST /api/drive/download-zip
// Accepts an array of S3 keys (files) or a folder prefix.
// Streams each file from R2, zips them in memory with JSZip, returns a zip blob.
// Intended for: Download All, Download Selected, Download Folder.

import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/lib/s3';
import JSZip from 'jszip';
import { getCurrentUser2 } from '@/lib/auth';
import { streamZip } from '@/lib/file-server';

const s3 = getS3();

// ── Expand a folder prefix into all file keys under it ────────────────────────
async function listAllKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));

    for (const obj of res.Contents || []) {
      if (obj.Key && obj.Size && obj.Size > 0) {
        keys.push(obj.Key);
      }
    }

    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

// ── Fetch one S3 object as a Buffer ───────────────────────────────────────────
async function fetchFileBuffer(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) throw new Error(`Empty body for key: ${key}`);

  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { keys, folderPrefix, zipName } = body;

    if (!keys?.length && !folderPrefix) {
      return NextResponse.json({ error: 'Provide keys[] or folderPrefix' }, { status: 400 });
    }

    const fsRes = await streamZip(user.id, user.role, { keys, folderPrefix, zipName });

    if (!fsRes.ok) {
      const err = await fsRes.json().catch(() => ({ error: 'File server error' }));
      return NextResponse.json(err, { status: fsRes.status });
    }

    return new NextResponse(fsRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': fsRes.headers.get('Content-Disposition') || 'attachment; filename="download.zip"',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err: any) {
    console.error('download-zip error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create zip' }, { status: 500 });
  }
}

// ── Find the longest common prefix of an array of keys ────────────────────────
function getCommonPrefix(keys: string[]): string {
  if (!keys.length) return '';
  const parts = keys[0].split('/');
  let prefix = '';
  for (let depth = 0; depth < parts.length - 1; depth++) {
    const segment = parts.slice(0, depth + 1).join('/') + '/';
    if (keys.every(k => k.startsWith(segment))) {
      prefix = segment;
    } else {
      break;
    }
  }
  return prefix;
}