export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET } from '@/lib/s3';
import { getCurrentUser2 } from '@/lib/auth';
import { createFolder, renameFolder } from '@/lib/file-server';

const s3Client = getS3();

/**
 * POST /api/drive/folder
 * Create a new folder
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser2(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { folderPath, folderName, userId, role } = await request.json();
    if (!folderPath || !folderName) {
      return NextResponse.json({ error: 'Folder path and name are required' }, { status: 400 });
    }

    if (role === 'client') {
      if (!folderPath.includes('raw-footage')) {
        return NextResponse.json({ error: 'You can only create folders in your raw footage area' }, { status: 403 });
      }
      const pathParts = folderPath.split('/').filter(Boolean);
      const rfIndex = pathParts.findIndex((p: string) => p === 'raw-footage');
      const depth = rfIndex >= 0 ? pathParts.length - rfIndex - 1 : -1;
      if (depth < 2) {
        return NextResponse.json({ error: 'You can only create folders inside your deliverable folders' }, { status: 403 });
      }
      if (userId) {
        const u = await prisma.user.findUnique({
          where: { id: parseInt(userId) },
          select: { linkedClient: { select: { companyName: true, name: true } } },
        });
        const company = u?.linkedClient?.companyName || u?.linkedClient?.name;
        if (company && !folderPath.startsWith(company)) {
          return NextResponse.json({ error: 'You can only create folders in your own area' }, { status: 403 });
        }
      }
    }

    const result = await createFolder(user.id, user.role, folderPath, folderName);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Create folder error:', error);
    return NextResponse.json({ error: 'Failed to create folder', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser2(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { oldPath, newName, userId, role } = await request.json();
    if (!oldPath || !newName) {
      return NextResponse.json({ error: 'Old path and new name are required' }, { status: 400 });
    }

    if (role === 'client') {
      if (!oldPath.includes('raw-footage')) {
        return NextResponse.json({ error: 'You can only rename folders in your raw footage area' }, { status: 403 });
      }
      const pathParts = oldPath.split('/').filter(Boolean);
      const rfIndex = pathParts.findIndex((p: string) => p === 'raw-footage');
      const depth = rfIndex >= 0 ? pathParts.length - rfIndex - 1 : -1;
      if (depth < 3) {
        return NextResponse.json({ error: 'You can only rename folders you created inside deliverable folders' }, { status: 403 });
      }
      if (userId) {
        const u = await prisma.user.findUnique({
          where: { id: parseInt(userId) },
          select: { linkedClient: { select: { companyName: true, name: true } } },
        });
        const company = u?.linkedClient?.companyName || u?.linkedClient?.name;
        if (company && !oldPath.startsWith(company)) {
          return NextResponse.json({ error: 'You can only rename folders in your own area' }, { status: 403 });
        }
      }
    }

    const result = await renameFolder(user.id, user.role, oldPath, newName);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Rename folder error:', error);
    return NextResponse.json({ error: 'Failed to rename folder', details: error.message }, { status: 500 });
  }
}