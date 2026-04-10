export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET } from '@/lib/s3';

const s3Client = getS3();

/**
 * POST /api/drive/folder
 * Create a new folder
 */
export async function POST(request: NextRequest) {
  try {
    const { folderPath, folderName, userId, role } = await request.json();

    if (!folderPath || !folderName) {
      return NextResponse.json(
        { error: 'Folder path and name are required' },
        { status: 400 }
      );
    }

    console.log('Create folder request:', { folderPath, folderName, userId, role });

    // Sanitize folder name
    const sanitizedName = folderName.trim()
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, '-'); // Replace spaces with hyphens

    if (!sanitizedName) {
      return NextResponse.json(
        { error: 'Invalid folder name' },
        { status: 400 }
      );
    }

    // 🔥 Permission checks
    if (role === 'client') {
      // Clients can only create folders within their raw-footage deliverable folders
      if (!folderPath.includes('raw-footage')) {
        return NextResponse.json(
          { error: 'You can only create folders in your raw footage area' },
          { status: 403 }
        );
      }

      // Check depth: must be inside a deliverable folder (depth 2+)
      // Path format: CompanyName/raw-footage/Month/DeliverableType/...
      const pathParts = folderPath.split('/').filter(Boolean);
      const rawFootageIndex = pathParts.findIndex((p: string) => p === 'raw-footage');
      const depthFromRawFootage = rawFootageIndex >= 0 ? pathParts.length - rawFootageIndex - 1 : -1;
      
      // depth 0 = raw-footage, depth 1 = month, depth 2 = deliverable type
      // Clients can only create folders at depth 2+ (inside deliverable folders)
      if (depthFromRawFootage < 2) {
        return NextResponse.json(
          { error: 'You can only create folders inside your deliverable folders (e.g., LF, SF)' },
          { status: 403 }
        );
      }

      // Verify client owns this folder
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
        if (companyName && !folderPath.startsWith(companyName)) {
          return NextResponse.json(
            { error: 'You can only create folders in your own area' },
            { status: 403 }
          );
        }
      }
    }

    // Build full folder path
    const basePath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    const newFolderKey = `${basePath}${sanitizedName}/`;

    // Create the folder in S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: newFolderKey,
        ContentType: 'application/x-directory',
      })
    );

    console.log('✅ Folder created:', newFolderKey);

    return NextResponse.json({
      success: true,
      folderPath: newFolderKey,
      folderName: sanitizedName,
    });

  } catch (error: any) {
    console.error('❌ Create folder error:', error);
    return NextResponse.json(
      { error: 'Failed to create folder', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/drive/folder
 * Rename a folder
 */
export async function PATCH(request: NextRequest) {
  try {
    const { oldPath, newName, userId, role } = await request.json();

    if (!oldPath || !newName) {
      return NextResponse.json(
        { error: 'Old path and new name are required' },
        { status: 400 }
      );
    }

    console.log('Rename folder request:', { oldPath, newName, userId, role });

    // Sanitize new name
    const sanitizedName = newName.trim()
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '-');

    if (!sanitizedName) {
      return NextResponse.json(
        { error: 'Invalid folder name' },
        { status: 400 }
      );
    }

    // 🔥 Permission checks
    if (role === 'client') {
      if (!oldPath.includes('raw-footage')) {
        return NextResponse.json(
          { error: 'You can only rename folders in your raw footage area' },
          { status: 403 }
        );
      }

      // Check depth: must be inside a deliverable folder (depth 3+)
      // Path format: CompanyName/raw-footage/Month/DeliverableType/CustomFolder
      const checkParts = oldPath.split('/').filter(Boolean);
      const rawFootageIndex = checkParts.findIndex((p: string) => p === 'raw-footage');
      const depthFromRawFootage = rawFootageIndex >= 0 ? checkParts.length - rawFootageIndex - 1 : -1;
      
      // depth 0 = raw-footage, depth 1 = month, depth 2 = deliverable type, depth 3+ = custom folders
      // Clients can only rename folders they created (depth 3+)
      if (depthFromRawFootage < 3) {
        return NextResponse.json(
          { error: 'You can only rename folders you created inside deliverable folders' },
          { status: 403 }
        );
      }

      // Verify client owns this folder
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
        if (companyName && !oldPath.startsWith(companyName)) {
          return NextResponse.json(
            { error: 'You can only rename folders in your own area' },
            { status: 403 }
          );
        }
      }
    }

    // Build paths
    const oldPrefix = oldPath.endsWith('/') ? oldPath : `${oldPath}/`;
    const pathParts = oldPrefix.split('/').filter(Boolean);
    pathParts.pop(); // Remove old folder name
    const parentPath = pathParts.join('/') + '/';
    const newPrefix = `${parentPath}${sanitizedName}/`;

    // List all objects in the old folder
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: oldPrefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const objects = listResponse.Contents || [];

    if (objects.length === 0) {
      // Empty folder - just create new and delete old
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: newPrefix,
          ContentType: 'application/x-directory',
        })
      );

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: oldPrefix,
        })
      );
    } else {
      // Copy all objects to new location
      for (const obj of objects) {
        if (!obj.Key) continue;

        const newKey = obj.Key.replace(oldPrefix, newPrefix);
        
        await s3Client.send(
          new CopyObjectCommand({
            Bucket: BUCKET,
            CopySource: `${BUCKET}/${obj.Key}`,
            Key: newKey,
          })
        );
      }

      // Delete old objects
      const objectsToDelete = objects.map(obj => ({ Key: obj.Key! }));
      
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: {
            Objects: objectsToDelete,
          },
        })
      );
    }

    console.log('✅ Folder renamed from', oldPrefix, 'to', newPrefix);

    return NextResponse.json({
      success: true,
      oldPath: oldPrefix,
      newPath: newPrefix,
      newName: sanitizedName,
    });

  } catch (error: any) {
    console.error('❌ Rename folder error:', error);
    return NextResponse.json(
      { error: 'Failed to rename folder', details: error.message },
      { status: 500 }
    );
  }
}