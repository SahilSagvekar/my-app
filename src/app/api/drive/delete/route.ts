// src/app/api/drive/delete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function DELETE(request: NextRequest) {
  try {
    const { s3Key, type, userId, role } = await request.json();

    if (!s3Key) {
      return NextResponse.json({ error: 'No S3 key provided' }, { status: 400 });
    }

    console.log('Delete request:', { s3Key, type, userId, role });

    // Verify user has permission to delete
    // You can add more permission checks here based on role

    if (type === 'file') {
      // Delete single file
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: s3Key,
      });

      await s3Client.send(command);
      console.log('File deleted:', s3Key);

    } else if (type === 'folder') {
      // Delete folder and all its contents
      await deleteFolderRecursive(s3Key);
    }

    return NextResponse.json({
      success: true,
      message: `${type} deleted successfully`,
    });

  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Delete failed', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to delete folder and all contents recursively
async function deleteFolderRecursive(folderKey: string) {
  // Ensure folder key ends with /
  const prefix = folderKey.endsWith('/') ? folderKey : `${folderKey}/`;

  console.log('Deleting folder:', prefix);

  // List all objects in the folder
  const listCommand = new ListObjectsV2Command({
    Bucket: process.env.AWS_S3_BUCKET!,
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
    Bucket: process.env.AWS_S3_BUCKET!,
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