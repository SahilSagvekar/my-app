export const dynamic = 'force-dynamic';
// src/app/api/drive/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET, getFileUrl } from '@/lib/s3';
import { sendDriveUploadNotification } from '@/lib/upload-notifications';

const s3Client = getS3();

// Helper to get current month folder name
function getCurrentMonthFolder(): string {
  const date = new Date();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${month}-${year}`; // "December-2024"
}


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    console.log('Received upload request with formData keys:', Array.from(formData.keys()));

    const file = formData.get('file') as File;
    const folderPath = formData.get('folderPath') as string;
    const userId = formData.get('id') as string;
    const role = formData.get('role') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('Upload request:', {
      fileName: file.name,
      folderPath,
      userId,
      role
    });

    // 🔥 FIX: Extract company name from folderPath
    let basePath = '';

    if (role === 'client') {
      let clientRecord = null;

      // Method 1: Try linkedClientId (new multi-user method)
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: {
          linkedClient: {
            select: { companyName: true, name: true }
          }
        },
      });

      if (user?.linkedClient) {
        clientRecord = user.linkedClient;
      }

      // Method 2: Fallback to old Client.userId (backward compat)
      if (!clientRecord) {
        clientRecord = await prisma.client.findFirst({
          where: { userId: parseInt(userId) },
          select: { companyName: true, name: true },
        });
      }

      if (clientRecord) {
        const companyName = clientRecord.companyName || clientRecord.name;
        basePath = `${companyName}/`;
      }
    } else {
      // 🔥 For admin/other roles, extract company name from folderPath
      const pathParts = folderPath.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const companyName = pathParts[0];
        basePath = `${companyName}/`;
      }
    }

    let s3Key = '';

    // 🔥 Check if uploading to raw-footage folder
    if (folderPath.includes('raw-footage')) {
      const pathAfterRawFootage = folderPath.split('raw-footage/')[1] || '';
      const hasMonthFolder = /^[A-Z][a-z]+-\d{4}\//.test(pathAfterRawFootage);
      
      if (hasMonthFolder) {
        // Path already structured, use as-is
        const folderParts = folderPath.split('/').filter(Boolean);
        let currentPath = '';
        
        for (const part of folderParts) {
          currentPath += `${part}/`;
          try {
            await s3Client.send(
              new PutObjectCommand({
                Bucket: BUCKET,
                Key: currentPath,
                ContentType: "application/x-directory",
              })
            );
          } catch (error) {
            // Folder might already exist, that's ok
          }
        }
        
        s3Key = `${folderPath}${file.name}`;
        console.log('📁 Uploading to structured path:', s3Key);
        
      } else {
        // Legacy behavior: auto-add current month folder
        const currentMonth = getCurrentMonthFolder();
        const folderPathWithoutCompany = folderPath.replace(basePath, '');
        const monthFolderPath = `${basePath}raw-footage/${currentMonth}/`;

        try {
          await s3Client.send(
            new PutObjectCommand({
              Bucket: BUCKET,
              Key: monthFolderPath,
              ContentType: "application/x-directory",
            })
          );
          console.log('✅ Month folder ensured:', monthFolderPath);
        } catch (error) {
          console.log('⚠️ Folder might already exist (ok):', error);
        }

        s3Key = `${monthFolderPath}${file.name}`;
        console.log('📁 Uploading to monthly folder:', s3Key);
      }

    } else {
      // For other folders (elements, outputs, etc.), use folderPath as-is
      s3Key = `${folderPath}${file.name}`;
      console.log('📁 Uploading to:', s3Key);
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    const fileUrl = getFileUrl(s3Key);

    console.log('✅ Upload successful:', fileUrl);

    // 🔥 SEND SLACK NOTIFICATION
    const pathParts = s3Key.split('/').filter(Boolean);
    const companyName = pathParts[0];
    
    // Find client by company name
    let clientIdForNotification: string | undefined;
    if (companyName) {
      const client = await prisma.client.findFirst({
        where: {
          OR: [
            { companyName: companyName },
            { name: companyName }
          ]
        },
        select: { id: true }
      });
      clientIdForNotification = client?.id;
    }

    if (userId) {
      sendDriveUploadNotification({
        fileName: file.name,
        fileSize: buffer.length,
        uploadedBy: parseInt(userId),
        s3Key,
        clientId: clientIdForNotification,
      }).catch((err) => {
        console.error(`[DriveUpload] Slack notification failed:`, err);
      });
    }

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName: file.name,
      s3Key,
    });

  } catch (error: any) {
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error.message },
      { status: 500 }
    );
  }
}