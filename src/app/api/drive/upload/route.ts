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

    // Determine the base path based on role
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
    }

    // Construct full S3 key
    const s3Key = basePath + folderPath + file.name;

    console.log('Uploading to S3 key:', s3Key);

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

    console.log('Upload successful:', fileUrl);

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName: file.name,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error.message },
      { status: 500 }
    );
  }
}