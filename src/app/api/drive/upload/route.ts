// src/app/api/drive/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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
      // Find client's company name
      const client = await prisma.client.findFirst({
        where: { userId: parseInt(userId) },
        select: { companyName: true, name: true },
      });

      if (client) {
        const companyName = client.companyName || client.name;
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
      // Get current month folder
      const currentMonth = getCurrentMonthFolder(); // "December-2024"
      
      // 🔥 FIX: Build path correctly
      // Remove company name from folderPath if it exists, and rebuild
      const folderPathWithoutCompany = folderPath.replace(basePath, '');
      
      // Build path with month folder: companyName/raw-footage/December-2024/
      const monthFolderPath = `${basePath}raw-footage/${currentMonth}/`;
      
      // 🔥 Create the month folder (if it doesn't exist)
      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: monthFolderPath,
            ContentType: "application/x-directory",
          })
        );
        console.log('✅ Month folder ensured:', monthFolderPath);
      } catch (error) {
        console.log('⚠️ Folder might already exist (ok):', error);
      }
      
      // 🔥 Upload file inside the month folder
      s3Key = `${monthFolderPath}${file.name}`;
      
      console.log('📁 Uploading to monthly folder:', s3Key);
      
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
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${s3Key}`;

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