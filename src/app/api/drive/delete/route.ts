export const dynamic = 'force-dynamic';
// src/app/api/drive/delete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET } from '@/lib/s3';
import { updateClientStorageAfterDelete } from '@/lib/storage-service';
import { getCurrentUser2 } from '@/lib/auth';
import { deleteItem } from '@/lib/file-server';

const s3Client = getS3();

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser2(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { s3Key, type } = await request.json();
    if (!s3Key) return NextResponse.json({ error: 'No s3Key provided' }, { status: 400 });

    if (user.role === 'editor') {
      return NextResponse.json({ error: 'Editors cannot delete files' }, { status: 403 });
    }

    if (user.role === 'client') {
      if (!s3Key.includes('raw-footage')) {
        return NextResponse.json({ error: 'You can only delete items in your raw footage folder' }, { status: 403 });
      }
      const pathParts = s3Key.split('/').filter(Boolean);
      const rfIndex = pathParts.findIndex((p: string) => p === 'raw-footage');
      const depth = rfIndex >= 0 ? pathParts.length - rfIndex - 1 : -1;
      if (depth < 3) {
        return NextResponse.json({ error: 'You can only delete items inside your deliverable folders' }, { status: 403 });
      }
      const u = await prisma.user.findUnique({
        where: { id: user.id },
        select: { linkedClient: { select: { companyName: true, name: true } } },
      });
      const company = u?.linkedClient?.companyName || u?.linkedClient?.name;
      if (company && !s3Key.startsWith(company)) {
        return NextResponse.json({ error: 'You can only delete items in your own folder' }, { status: 403 });
      }
    }

    const result = await deleteItem(user.id, user.role, s3Key, type);

    if (s3Key.includes('raw-footage') && result.deletedSize > 0) {
      const companyName = s3Key.split('/')[0];
      const client = await prisma.client.findFirst({
        where: { OR: [{ companyName }, { name: companyName }] },
        select: { id: true },
      });
      if (client) await updateClientStorageAfterDelete(client.id, result.deletedSize);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Delete failed', details: error.message }, { status: 500 });
  }
}

// Helper function to get total size of a folder
async function getFolderSize(folderKey: string): Promise<number> {
  const prefix = folderKey.endsWith('/') ? folderKey : `${folderKey}/`;
  let totalSize = 0;
  let continuationToken: string | undefined;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(listCommand);
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        totalSize += obj.Size || 0;
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return totalSize;
}

// Helper function to delete folder and all contents recursively
async function deleteFolderRecursive(folderKey: string) {
  // Ensure folder key ends with /
  const prefix = folderKey.endsWith('/') ? folderKey : `${folderKey}/`;

  console.log('Deleting folder:', prefix);

  // List all objects in the folder
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
  });

  const listResponse = await s3Client.send(listCommand);

  if (!listResponse.Contents || listResponse.Contents.length === 0) {
    console.log('Folder is empty or does not exist');
    return;
  }

  // Delete all objects in batches (S3 allows max 1000 per request)
  const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key! }));

  const deleteCommand = new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: {
      Objects: objectsToDelete,
    },
  });

  const deleteResponse = await s3Client.send(deleteCommand);
  
  console.log('Deleted objects:', deleteResponse.Deleted?.length);

  // If there are more objects (pagination), continue deleting
  if (listResponse.IsTruncated) {
    await deleteFolderRecursive(folderKey);
  }
}