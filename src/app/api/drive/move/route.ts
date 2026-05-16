export const dynamic = 'force-dynamic';
// src/app/api/drive/move/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/lib/s3';
import { getCurrentUser2 } from '@/lib/auth';

const s3 = getS3();

async function copyObject(sourceKey: string, destKey: string) {
  await s3.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${sourceKey}`,
      Key: destKey,
    })
  );
}

async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

async function listPrefix(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

async function deleteObjects(keys: string[]) {
  const batches: string[][] = [];
  for (let i = 0; i < keys.length; i += 1000) {
    batches.push(keys.slice(i, i + 1000));
  }
  for (const batch of batches) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: batch.map((k) => ({ Key: k })) },
      })
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role === 'client') {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const { sourceKey, destinationFolderKey, type } = await req.json();

    if (!sourceKey || !destinationFolderKey) {
      return NextResponse.json({ error: 'sourceKey and destinationFolderKey are required' }, { status: 400 });
    }

    const itemName = sourceKey.replace(/\/$/, '').split('/').pop()!;
    const destPrefix = destinationFolderKey.endsWith('/') ? destinationFolderKey : `${destinationFolderKey}/`;

    if (type === 'folder') {
      const sourcePrefix = sourceKey.endsWith('/') ? sourceKey : `${sourceKey}/`;
      const destFolderKey = `${destPrefix}${itemName}/`;

      if (destFolderKey.startsWith(sourcePrefix)) {
        return NextResponse.json({ error: 'Cannot move a folder into itself' }, { status: 400 });
      }

      const allKeys = await listPrefix(sourcePrefix);

      for (const key of allKeys) {
        const relativePath = key.slice(sourcePrefix.length);
        const newKey = `${destFolderKey}${relativePath}`;
        await copyObject(key, newKey);
      }

      if (allKeys.length === 0) {
        await s3.send(
          new CopyObjectCommand({
            Bucket: BUCKET,
            CopySource: `${BUCKET}/${sourcePrefix}`,
            Key: `${destFolderKey}.keep`,
          })
        ).catch(() => {});
      }

      if (allKeys.length > 0) {
        await deleteObjects(allKeys);
      }
    } else {
      const destKey = `${destPrefix}${itemName}`;
      await copyObject(sourceKey, destKey);
      await deleteObject(sourceKey);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[drive/move] error:', error);
    return NextResponse.json({ error: 'Move failed', details: error.message }, { status: 500 });
  }
}