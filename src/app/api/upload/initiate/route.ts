// app/api/upload/initiate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { createMonthFolder, createTaskOutputFolder } from '@/lib/s3';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// export async function POST(request: NextRequest) {
//   try {
//     const { fileName, fileType, taskId, clientId, folderType } = await request.json();
    
//     // Validate required fields
//     if (!fileName || !fileType || !taskId || !clientId || !folderType) {
//       return NextResponse.json(
//         { error: 'Missing required fields' },
//         { status: 400 }
//       );
//     }

//     // Get client folder prefix
//     const client = await prisma.client.findUnique({
//       where: { id: clientId },
//       select: {
//         rawFootageFolderId: true,
//         essentialsFolderId: true,
//       },
//     });

//     if (!client) {
//       return NextResponse.json(
//         { error: 'Client not found' },
//         { status: 404 }
//       );
//     }

//     const folderPrefix =
//       folderType === 'rawFootage'
//         ? client.rawFootageFolderId
//         : client.essentialsFolderId;

//     if (!folderPrefix) {
//       return NextResponse.json(
//         { error: `Missing S3 prefix for ${folderType}` },
//         { status: 400 }
//       );
//     }

//     // Generate unique key
//     const key = `${folderPrefix}${Date.now()}-${fileName}`;
    
//     const command = new CreateMultipartUploadCommand({
//       Bucket: process.env.AWS_S3_BUCKET!,
//       Key: key,
//       ContentType: fileType,
//     });

//     const response = await s3Client.send(command);

//     return NextResponse.json({
//       uploadId: response.UploadId,
//       key,
//       taskId,
//       clientId,
//       folderType,
//     });
//   } catch (error: any) {
//     console.error('Error initiating upload:', error);
//     return NextResponse.json(
//       { error: 'Failed to initiate upload', message: error.message },
//       { status: 500 }
//     );
//   }
// }


// src/app/api/upload/initiate/route.ts - UPDATED

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileType, taskId, clientId, folderType } = await request.json();
    
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        companyName: true,
        rawFootageFolderId: true,
        essentialsFolderId: true,
        outputsFolderId: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const companyName = client.companyName || client.name;
    let key: string;

    if (folderType === 'rawFootage') {
      // NEW: Upload to current month folder
      const monthYear = format(new Date(), 'MMMM-yyyy'); // "January-2025"
      const monthFolder = `${client.rawFootageFolderId}${monthYear}/`;
      
      // Create month folder if doesn't exist
      await createMonthFolder(companyName, monthYear);
      
      key = `${monthFolder}${Date.now()}-${fileName}`;
      
      // Save month folder to task
      await prisma.task.update({
        where: { id: taskId },
        data: { monthFolder }
      });
      
    } else if (folderType === 'elements') {
      // Elements stays the same
      key = `${client.essentialsFolderId}${Date.now()}-${fileName}`;
      
    } else if (folderType === 'output') {
      // NEW: Upload to task-specific output folder
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { title: true, outputFolderId: true }
      });
      
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      // Create task output folder if doesn't exist
      let taskFolder = task.outputFolderId;
      if (!taskFolder) {
        taskFolder = await createTaskOutputFolder(companyName, taskId, task.title || 'untitled');
        await prisma.task.update({
          where: { id: taskId },
          data: { outputFolderId: taskFolder }
        });
      }
      
      // File naming: match task title
      const sanitizedTitle = (task.title || 'untitled')
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .toLowerCase();
      const timestamp = Date.now();
      const extension = fileName.split('.').pop();
      key = `${taskFolder}${sanitizedTitle}-${timestamp}.${extension}`;
    }

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
    console.error('Error initiating upload:', error);
    return NextResponse.json(
      { error: 'Failed to initiate upload', message: error.message },
      { status: 500 }
    );
  }
}