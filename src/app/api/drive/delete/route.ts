export const dynamic = 'force-dynamic';
// src/app/api/drive/delete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET } from '@/lib/s3';
import { updateClientStorageAfterDelete } from '@/lib/storage-service';

const s3Client = getS3();

export async function DELETE(request: NextRequest) {
  try {
    const { s3Key, type, userId, role } = await request.json();

    if (!s3Key) {
      return NextResponse.json({ error: 'No S3 key provided' }, { status: 400 });
    }

    console.log('Delete request:', { s3Key, type, userId, role });

    // 🔥 Permission checks based on role
    if (role === 'editor') {
      // Editors cannot delete anything
      return NextResponse.json(
        { error: "Editors cannot delete files" },
        { status: 403 }
      );
    }
    
    if (role === 'client') {
      // Clients can only delete within their own raw-footage folder, inside a deliverable folder
      if (!s3Key.includes('raw-footage')) {
        return NextResponse.json(
          { error: "You can only delete items in your raw footage folder" },
          { status: 403 }
        );
      }
      
      // Check depth: must be inside a deliverable folder (depth 2+)
      // Path format: CompanyName/raw-footage/Month/DeliverableType/...
      const pathParts = s3Key.split('/').filter(Boolean);
      const rawFootageIndex = pathParts.findIndex((p: string) => p === 'raw-footage');
      const depthFromRawFootage = rawFootageIndex >= 0 ? pathParts.length - rawFootageIndex - 1 : -1;
      
      // depth 0 = raw-footage, depth 1 = month, depth 2 = deliverable type, depth 3+ = custom folders
      // Clients can only delete at depth 3+ (inside deliverable folders, not the deliverable folder itself)
      if (depthFromRawFootage < 3) {
        return NextResponse.json(
          { error: "You can only delete items inside your deliverable folders" },
          { status: 403 }
        );
      }
      
      // Verify the client owns this folder by checking their linked client
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: parseInt(userId) },
          select: {
            linkedClient: {
              select: { companyName: true, name: true }
            }
          }
        });
        
        const companyName = user?.linkedClient?.companyName || user?.linkedClient?.name;
        if (companyName && !s3Key.startsWith(companyName)) {
          return NextResponse.json(
            { error: "You can only delete items in your own folder" },
            { status: 403 }
          );
        }
      }
    }

    // Proceed with deletion
    
    // 🔥 Track storage reduction for raw-footage deletions
    const isRawFootageDelete = s3Key.includes('raw-footage');
    let deletedSize = 0;
    let clientId: string | null = null;
    
    if (isRawFootageDelete) {
      // Get client from path
      const pathParts = s3Key.split('/');
      const companyName = pathParts[0];
      
      const client = await prisma.client.findFirst({
        where: {
          OR: [
            { companyName: companyName },
            { name: companyName }
          ]
        },
        select: { id: true }
      });
      
      clientId = client?.id || null;
    }

    if (type === 'file') {
      // Get file size before deleting
      if (isRawFootageDelete && clientId) {
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
          });
          const headResponse = await s3Client.send(headCommand);
          deletedSize = headResponse.ContentLength || 0;
        } catch (e) {
          console.log('Could not get file size before delete');
        }
      }
      
      // Delete single file
      const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
      });

      await s3Client.send(command);
      console.log('File deleted:', s3Key);

    } else if (type === 'folder') {
      // Get total size of folder before deleting
      if (isRawFootageDelete && clientId) {
        deletedSize = await getFolderSize(s3Key);
      }
      
      // Delete folder and all its contents
      await deleteFolderRecursive(s3Key);
    }
    
    // 🔥 Update storage after deletion
    if (isRawFootageDelete && clientId && deletedSize > 0) {
      await updateClientStorageAfterDelete(clientId, deletedSize);
      console.log(`📊 Storage reduced by ${(deletedSize / 1024 / 1024).toFixed(2)} MB for client ${clientId}`);
    }

    return NextResponse.json({
      success: true,
      message: `${type} deleted successfully`,
      deletedSize,
    });

  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Delete failed', details: error.message },
      { status: 500 }
    );
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