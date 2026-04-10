export const dynamic = 'force-dynamic';
// src/app/api/drive/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET, getFileUrl } from '@/lib/s3';

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
    const file = formData.get('file') as File;
    const folderPath = formData.get('folderPath') as string;
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as string;

    //     if ((role === 'editor' || role === 'client') && !folderPath.includes('raw-footage')) {
    //   return NextResponse.json(
    //     { error: 'You can only upload to raw-footage folders' },
    //     { status: 403 }
    //   );
    // }

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
    // folderPath will be like "CompanyName/raw-footage/" or "CompanyName/elements/"
    let basePath = '';

    if (role === 'client') {
      // 🔥 FIX: Check linkedClientId first, then fallback to Client.userId
      // This ensures ALL users linked to the same client upload to the same folder
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
      // folderPath format: "CompanyName/raw-footage/" or "CompanyName/elements/"
      const pathParts = folderPath.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const companyName = pathParts[0]; // First part is company name
        basePath = `${companyName}/`;
      }
    }

    let s3Key = '';

    // 🔥 Check if uploading to raw-footage folder
    if (folderPath.includes('raw-footage')) {
      // Check if path already includes a month folder (from RawFootageUploadDialog)
      // Pattern: CompanyName/raw-footage/Month-Year/DeliverableType/...
      const pathAfterRawFootage = folderPath.split('raw-footage/')[1] || '';
      const hasMonthFolder = /^[A-Z][a-z]+-\d{4}\//.test(pathAfterRawFootage);
      
      if (hasMonthFolder) {
        // Path already structured (from RawFootageUploadDialog), use as-is
        // Ensure all intermediate folders exist
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
        const currentMonth = getCurrentMonthFolder(); // "December-2024"

        // Remove company name from folderPath if it exists, and rebuild
        const folderPathWithoutCompany = folderPath.replace(basePath, '');

        // Build path with month folder: companyName/raw-footage/December-2024/
        const monthFolderPath = `${basePath}raw-footage/${currentMonth}/`;

        // Create the month folder (if it doesn't exist)
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

        // Upload file inside the month folder
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