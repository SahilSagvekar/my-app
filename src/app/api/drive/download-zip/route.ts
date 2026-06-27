export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — large folders need time

// POST /api/drive/download-zip
// Accepts an array of S3 keys (files) or a folder prefix.
// Fetches each file from R2, zips them with JSZip, returns a zip blob.
// Intended for: Download All, Download Selected, Download Folder.

import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/lib/s3';
import JSZip from 'jszip';
import { getCurrentUser2 } from '@/lib/auth';

const s3 = getS3();

// Safety limit — refuse to zip more than this to avoid OOM on the server.
// Users downloading huge folders should use individual file downloads instead.
const MAX_ZIP_TOTAL_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_ZIP_FILE_COUNT = 500;

// ── Expand a folder prefix into all file keys + sizes under it ────────────────
async function listAllObjects(prefix: string): Promise<{ key: string; size: number }[]> {
  const objects: { key: string; size: number }[] = [];
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
        objects.push({ key: obj.Key, size: obj.Size });
      }
    }

    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return objects;
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

// ── Helper: process items in batches (concurrent downloads) ───────────────────
async function processBatch<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, j) => fn(item, i + j)),
    );
    results.push(...batchResults);
  }
  return results;
}

// ── Format bytes for logging ──────────────────────────────────────────────────
function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function POST(req: NextRequest) {
  try {
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

    // ── 1. Resolve the full list of S3 keys + sizes ──────────────────────────
    let objects: { key: string; size: number }[] = [];

    if (folderPrefix) {
      console.log(`[download-zip] Listing objects under prefix: ${folderPrefix}`);
      objects = await listAllObjects(folderPrefix);
    } else if (keys?.length) {
      // For explicit keys we don't have sizes yet — we'll skip the size guard
      // and just fetch them (these are user-selected, typically a handful).
      objects = keys.map(k => ({ key: k, size: 0 }));
    }

    if (objects.length === 0) {
      return NextResponse.json({ error: 'No files found in this folder' }, { status: 404 });
    }

    // ── 2. Safety checks ─────────────────────────────────────────────────────
    const totalSize = objects.reduce((sum, o) => sum + o.size, 0);

    if (objects.length > MAX_ZIP_FILE_COUNT) {
      return NextResponse.json({
        error: `Too many files (${objects.length}). Maximum is ${MAX_ZIP_FILE_COUNT}. Try downloading a subfolder instead.`,
      }, { status: 413 });
    }

    if (totalSize > MAX_ZIP_TOTAL_BYTES) {
      return NextResponse.json({
        error: `Total size is too large (${fmtBytes(totalSize)}). Maximum is ${fmtBytes(MAX_ZIP_TOTAL_BYTES)}. Try downloading a subfolder or individual files.`,
      }, { status: 413 });
    }

    console.log(`[download-zip] Zipping ${objects.length} files (${fmtBytes(totalSize)}) for user ${user.id}`);

    // ── 3. Build the zip ─────────────────────────────────────────────────────
    const zip = new JSZip();
    const allKeys = objects.map(o => o.key);
    const commonPrefix = getCommonPrefix(allKeys);

    let fetched = 0;
    await processBatch(objects, 5, async (obj) => {
      const buf = await fetchFileBuffer(obj.key);
      // Strip the common prefix so the zip has clean relative paths
      const relativePath = obj.key.slice(commonPrefix.length) || obj.key.split('/').pop() || 'file';
      zip.file(relativePath, buf);
      fetched++;
      if (fetched % 10 === 0 || fetched === objects.length) {
        console.log(`[download-zip] Progress: ${fetched}/${objects.length} files fetched`);
      }
    });

    // ── 4. Generate and return the zip ───────────────────────────────────────
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 }, // fast compression — files are usually already compressed
    });

    const finalName = zipName || 'download.zip';
    const safeName = finalName.replace(/[^a-zA-Z0-9._-]/g, '_');

    console.log(`[download-zip] ✅ Zip ready: ${safeName} (${fmtBytes(zipBuffer.length)})`);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(zipBuffer.length),
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    });
  } catch (err: any) {
    console.error('[download-zip] ❌ Error:', err.message, err.cause || '');
    return NextResponse.json(
      { error: err.message || 'Failed to create zip' },
      { status: 500 },
    );
  }
}