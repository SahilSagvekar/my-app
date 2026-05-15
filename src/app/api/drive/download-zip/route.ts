export const dynamic = 'force-dynamic';
// POST /api/drive/download-zip
// Accepts an array of S3 keys (files) or a folder prefix.
// Streams each file from R2, zips them in memory with JSZip, returns a zip blob.
// Intended for: Download All, Download Selected, Download Folder.

import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/lib/s3';
import JSZip from 'jszip';

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
    const body = await req.json();

    // keys: explicit list of file s3Keys
    // folderPrefix: download an entire folder (mutually exclusive with keys)
    // zipName: optional name for the output zip file
    const { keys, folderPrefix, zipName }: {
      keys?: string[];
      folderPrefix?: string;
      zipName?: string;
    } = body;

    if (!keys?.length && !folderPrefix) {
      return NextResponse.json({ error: 'Provide keys[] or folderPrefix' }, { status: 400 });
    }

    // Resolve final list of file keys
    let fileKeys: string[] = [];

    if (folderPrefix) {
      fileKeys = await listAllKeys(folderPrefix);
      if (fileKeys.length === 0) {
        return NextResponse.json({ error: 'Folder is empty' }, { status: 404 });
      }
    } else {
      fileKeys = keys!;
    }

    // Safety cap — don't try to zip 500 videos at once
    if (fileKeys.length > 200) {
      return NextResponse.json(
        { error: 'Too many files (max 200). Use folder filters to narrow the selection.' },
        { status: 400 }
      );
    }

    const zip = new JSZip();

    // Use the folder prefix (or common path prefix) as the root so that
    // the extracted zip has sensible folder structure.
    const basePrefix = folderPrefix
      ? (folderPrefix.endsWith('/') ? folderPrefix : `${folderPrefix}/`)
      : getCommonPrefix(fileKeys);

    // Fetch all files in parallel (capped at 20 concurrent to avoid R2 rate limits)
    const CONCURRENCY = 20;
    for (let i = 0; i < fileKeys.length; i += CONCURRENCY) {
      const batch = fileKeys.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (key) => {
        try {
          const buffer = await fetchFileBuffer(key);
          // Strip the base prefix so paths inside the zip are relative
          const zipPath = key.startsWith(basePrefix) ? key.slice(basePrefix.length) : key.split('/').pop()!;
          zip.file(zipPath || key.split('/').pop() || 'file', buffer);
        } catch (err) {
          console.warn(`Skipped ${key}:`, err);
          // Don't fail the whole zip — skip missing/errored files
        }
      }));
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 3 }, // fast, reasonable size
    });

    const outputName = zipName || (folderPrefix
      ? `${folderPrefix.split('/').filter(Boolean).pop() || 'download'}.zip`
      : 'download.zip');

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${outputName}"`,
        'Content-Length': zipBuffer.length.toString(),
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