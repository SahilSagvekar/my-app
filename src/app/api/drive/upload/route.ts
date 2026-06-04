export const dynamic = 'force-dynamic';
// src/app/api/drive/upload/route.ts

// Returns a presigned URL — browser uploads directly to R2, main EC2 never touches the bytes

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { presignUpload } from '@/lib/file-server';
import { sendDriveUploadNotification } from '@/lib/upload-notifications';

function getCurrentMonthFolder(): string {
  const date = new Date();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${month}-${year}`;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // ── Mode 1: JSON presign request (new flow) ──────────────────────────────
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { fileName, folderPath, contentType: fileType, userId, role, fileSize } = body;

      if (!fileName || !folderPath) {
        return NextResponse.json({ error: 'fileName and folderPath are required' }, { status: 400 });
      }

      const s3Key = await resolveS3Key(fileName, folderPath, userId, role);
      const { uploadUrl, fileUrl } = await presignUpload(userId || 0, role || 'admin', s3Key, fileType || 'application/octet-stream');

      return NextResponse.json({ presignedUrl: uploadUrl, s3Key, fileUrl });
    }

    // ── Mode 2: FormData (legacy — still supported) ──────────────────────────
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folderPath = formData.get('folderPath') as string;
    const userId = formData.get('id') as string;
    const role = formData.get('role') as string;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const s3Key = await resolveS3Key(file.name, folderPath, userId, role);
    const fileType = file.type || 'application/octet-stream';
    const { uploadUrl, fileUrl } = await presignUpload(userId || 0, role || 'admin', s3Key, fileType);

    // Send Slack notification
    const companyName = s3Key.split('/')[0];
    const client = companyName ? await prisma.client.findFirst({
      where: { OR: [{ companyName }, { name: companyName }] },
      select: { id: true },
    }) : null;

    if (userId) {
      sendDriveUploadNotification({
        fileName: file.name,
        fileSize: file.size,
        uploadedBy: parseInt(userId),
        s3Key,
        clientId: client?.id,
      }).catch(err => console.error('[DriveUpload] Slack notification failed:', err));
    }

    return NextResponse.json({
      success: true,
      presignedUrl: uploadUrl,
      fileUrl,
      fileName: file.name,
      s3Key,
    });

  } catch (error: any) {
    console.error('❌ Drive upload error:', error);
    return NextResponse.json({ error: 'Upload failed', details: error.message }, { status: 500 });
  }
}

async function resolveS3Key(fileName: string, folderPath: string, userId: string, role: string): Promise<string> {
  let basePath = '';

  if (role === 'client') {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { linkedClient: { select: { companyName: true, name: true } } },
    });
    if (user?.linkedClient) {
      const companyName = user.linkedClient.companyName || user.linkedClient.name;
      basePath = `${companyName}/`;
    } else {
      const clientRecord = await prisma.client.findFirst({
        where: { userId: parseInt(userId) },
        select: { companyName: true, name: true },
      });
      if (clientRecord) {
        basePath = `${clientRecord.companyName || clientRecord.name}/`;
      }
    }
  } else {
    const pathParts = folderPath.split('/').filter(Boolean);
    if (pathParts.length > 0) basePath = `${pathParts[0]}/`;
  }

  if (folderPath.includes('raw-footage')) {
    const pathAfterRawFootage = folderPath.split('raw-footage/')[1] || '';
    const hasMonthFolder = /^[A-Z][a-z]+-\d{4}\//.test(pathAfterRawFootage);

    if (hasMonthFolder) {
      return `${folderPath}${fileName}`;
    } else {
      const currentMonth = getCurrentMonthFolder();
      return `${basePath}raw-footage/${currentMonth}/${fileName}`;
    }
  }

  return `${folderPath}${fileName}`;
}