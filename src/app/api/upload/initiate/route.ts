export const dynamic = 'force-dynamic';
// src/app/api/upload/initiate/route.ts
// Auth + DB logic stays here. R2 CreateMultipartUpload goes to file server.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initiateMultipart } from '@/lib/file-server';
import { getClientStorageInfo } from '@/lib/storage-service';

function normalizeUploadPathSegment(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.')
    .join('/');
}

function inferMimeType(fileName: string): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    mov: 'video/quicktime', mp4: 'video/mp4', mkv: 'video/x-matroska',
    avi: 'video/x-msvideo', webm: 'video/webm', m4v: 'video/x-m4v',
    mts: 'video/mp2t', m2ts: 'video/mp2t', wmv: 'video/x-ms-wmv',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}

function getCurrentMonthFolder(): string {
  const date = new Date();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${month}-${year}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fileName,
      fileType,
      fileSize,
      taskId,
      clientId,
      folderType,
      taskTitle,
      subfolder,
      relativePath,
    } = body;

    if (!fileName || !taskId || !clientId) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Infer MIME type from filename if browser didn't provide one (common for .mov folder uploads)
    const resolvedFileType = fileType || inferMimeType(fileName);

    // ── Storage limit check for raw-footage uploads ──────────────────────────
    const isRawFootageUpload =
      folderType === 'rawFootage' ||
      (folderType === 'drive' && subfolder?.includes('raw-footage'));

    if (isRawFootageUpload && clientId && clientId !== 'unknown') {
      const storageInfo = await getClientStorageInfo(clientId);
      const projectedUsage = storageInfo.used + (fileSize || 0);
      if (projectedUsage > storageInfo.limit || storageInfo.isAtLimit) {
        return NextResponse.json(
          {
            message: storageInfo.isAtLimit
              ? 'Storage limit reached. Please upgrade your plan.'
              : 'Storage limit exceeded',
            error: storageInfo.isAtLimit ? 'STORAGE_LIMIT_REACHED' : 'STORAGE_LIMIT_EXCEEDED',
            storageInfo: {
              used: storageInfo.usedFormatted,
              limit: storageInfo.limitFormatted,
              percentage: storageInfo.percentage,
            },
          },
          { status: 403 }
        );
      }
    }

    // ── Resolve company name ─────────────────────────────────────────────────
    let companyName = '';
    if (folderType !== 'drive') {
      if (!clientId) {
        return NextResponse.json({ message: 'Missing clientId' }, { status: 400 });
      }
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { companyName: true, name: true },
      });
      if (!client) {
        return NextResponse.json({ message: 'Client not found' }, { status: 404 });
      }
      companyName = client.companyName || client.name;
    }

    // ── Build S3 key ─────────────────────────────────────────────────────────
    let s3Key: string;
    const currentMonth = getCurrentMonthFolder();

    if (folderType === 'outputs') {
      if (!taskTitle) {
        return NextResponse.json(
          { message: 'Task title required for outputs upload' },
          { status: 400 }
        );
      }
      const taskFolderPath = `${companyName}/outputs/${currentMonth}/${taskTitle}/`;
      if (subfolder && subfolder.trim() !== '' && subfolder !== 'main') {
        s3Key = `${taskFolderPath}${subfolder}/${Date.now()}-${fileName}`;
      } else {
        s3Key = `${taskFolderPath}${Date.now()}-${fileName}`;
      }
    } else if (folderType === 'rawFootage') {
      s3Key = `${companyName}/raw-footage/${currentMonth}/${Date.now()}-${fileName}`;
    } else if (folderType === 'essentials') {
      s3Key = `${companyName}/elements/${Date.now()}-${fileName}`;
    } else if (folderType === 'drive') {
      let drivePath = normalizeUploadPathSegment(subfolder || '');
      if (drivePath !== '' && !drivePath.endsWith('/')) drivePath += '/';
      if (relativePath) {
        const safeRelativePath = normalizeUploadPathSegment(relativePath);
        s3Key = `${drivePath}${safeRelativePath}`;
      } else {
        s3Key = `${drivePath}${fileName}`;
      }
    } else {
      return NextResponse.json({ message: 'Invalid folder type' }, { status: 400 });
    }

    console.log('🎯 Initiating multipart via file server for key:', s3Key);

    // ── Delegate CreateMultipartUpload to file server ────────────────────────
    try {
      const { uploadId, key } = await initiateMultipart(
        clientId,
        'uploader',
        s3Key,
        resolvedFileType,
        fileSize,
      );
      return NextResponse.json({ uploadId, key });
    } catch (err: any) {
      // File server returns USE_SINGLE_PUT for files < 16MB — fall back to presigned PUT
      if (err.Code === 'USE_SINGLE_PUT' || err.message?.includes('USE_SINGLE_PUT') || err.message?.includes('too small')) {
        const { presignUpload } = await import('@/lib/file-server');
        const { uploadUrl, fileUrl } = await presignUpload(clientId, 'uploader', s3Key, resolvedFileType);
        return NextResponse.json({ singlePut: true, uploadUrl, fileUrl, key: s3Key });
      }
      throw err;
    }
  } catch (error: any) {
    console.error('❌ Initiate upload error:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to initiate upload' },
      { status: 500 }
    );
  }
}