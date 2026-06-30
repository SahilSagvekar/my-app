export const dynamic = 'force-dynamic';

// POST /api/drive/download-zip
// Returns presigned R2 download URLs for all files in a folder or key list.
// The frontend downloads each file individually — no server-side zipping,
// no RAM usage, no OOM. Works for folders of any size.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { getS3, BUCKET } from '@/lib/s3';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { presignDownload } from '@/lib/file-server';

async function listAllKeys(prefix: string): Promise<{ key: string; size: number }[]> {
  const s3 = getS3();
  const objects: { key: string; size: number }[] = [];
  let token: string | undefined;
  const p = prefix.endsWith('/') ? prefix : `${prefix}/`;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: p, ContinuationToken: token, MaxKeys: 1000 }));
    for (const obj of res.Contents || []) {
      if (obj.Key && obj.Size && obj.Size > 0) objects.push({ key: obj.Key, size: obj.Size });
    }
    token = res.NextContinuationToken;
  } while (token);
  return objects;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { keys, folderPrefix, zipName } = body as { keys?: string[]; folderPrefix?: string; zipName?: string };

  if (!keys?.length && !folderPrefix) {
    return NextResponse.json({ error: 'Provide keys[] or folderPrefix' }, { status: 400 });
  }

  let objects: { key: string; size: number }[] = [];
  if (folderPrefix) {
    objects = await listAllKeys(folderPrefix);
    if (!objects.length) return NextResponse.json({ error: 'Folder is empty' }, { status: 404 });
  } else {
    objects = keys!.map(k => ({ key: k, size: 0 }));
  }

  if (objects.length > 500) {
    return NextResponse.json({ error: 'Too many files (max 500). Try a subfolder.' }, { status: 400 });
  }

  // Generate presigned download URLs for all files in parallel batches
  const BATCH = 20;
  const files: { key: string; name: string; size: number; url: string }[] = [];

  const basePrefix = folderPrefix
    ? (folderPrefix.endsWith('/') ? folderPrefix : `${folderPrefix}/`)
    : '';

  for (let i = 0; i < objects.length; i += BATCH) {
    const batch = objects.slice(i, i + BATCH);
    const signed = await Promise.all(
      batch.map(async (obj) => {
        const name = obj.key.startsWith(basePrefix)
          ? obj.key.slice(basePrefix.length)
          : obj.key.split('/').pop() || 'file';
        const fileName = name.split('/').pop() || name;
        const { downloadUrl } = await presignDownload(user.id, user.role, obj.key, fileName);
        return { key: obj.key, name, size: obj.size, url: downloadUrl };
      })
    );
    files.push(...signed);
  }

  console.log(`[download-zip] user=${user.id} | ${files.length} presigned URLs for "${zipName || folderPrefix}"`);

  return NextResponse.json({ files, folderName: zipName?.replace('.zip', '') || folderPrefix?.split('/').filter(Boolean).pop() || 'download' });
}