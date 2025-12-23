// src/app/api/upload/initiate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, CreateMultipartUploadCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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
    const { fileName, fileType, taskId, clientId, folderType } = await request.json();
    
    // Validate required fields
    if (!fileName || !fileType || !taskId || !clientId || !folderType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        companyName: true,
        name: true,
        rawFootageFolderId: true,
        essentialsFolderId: true,
        outputsFolderId: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const companyName = client.companyName || client.name;
    
    if (!companyName) {
      return NextResponse.json({ error: 'Company name missing' }, { status: 400 });
    }

    let key: string;

    if (folderType === 'rawFootage') {
      // 🔥 Get current month (e.g., "December-2024")
      const currentMonth = getCurrentMonthFolder();
      
      // 🔥 Build the path: companyName/raw-footage/December-2024/
      const rawFootageBase = `${companyName}/raw-footage/`;
      const monthFolderPath = `${rawFootageBase}${currentMonth}/`;
      
      // 🔥 Create the month folder (if it doesn't exist)
      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: monthFolderPath, // This creates the folder
            ContentType: "application/x-directory",
          })
        );
        console.log('✅ Month folder ensured:', monthFolderPath);
      } catch (error) {
        console.log('⚠️ Folder might already exist (ok):', error);
      }
      
      // 🔥 Upload file inside the month folder
      key = `${monthFolderPath}${Date.now()}-${fileName}`;
      
      console.log('📁 Uploading to:', key);
      
    } else if (folderType === 'elements') {
      // Elements folder - no monthly subfolders
      const elementsBase = client.essentialsFolderId || `${companyName}/elements/`;
      key = `${elementsBase}${Date.now()}-${fileName}`;
      
    } else if (folderType === 'output') {
      // Output folder logic (we'll handle this later)
      const outputsBase = client.outputsFolderId || `${companyName}/outputs/`;
      key = `${outputsBase}${Date.now()}-${fileName}`;
      
    } else {
      return NextResponse.json({ error: 'Invalid folder type' }, { status: 400 });
    }

    // Initiate multipart upload
    const command = new CreateMultipartUploadCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      ContentType: fileType,
    });

    const response = await s3Client.send(command);

    return NextResponse.json({
      uploadId: response.UploadId,
      key,
      taskId,
      clientId,
      folderType,
    });
    
  } catch (error: any) {
    console.error('❌ Error initiating upload:', error);
    return NextResponse.json(
      { error: 'Failed to initiate upload', message: error.message },
      { status: 500 }
    );
  }
}
