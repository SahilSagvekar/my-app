// src/app/api/drive/structure/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl } from '@/lib/s3';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const role = searchParams.get('role');
    const userId = searchParams.get('userId');

    console.log('🔍 Drive structure request:', { clientId, role, userId });

    let prefix = '';
    let companyName = '';

    // Determine which folders to show based on role
    if (role === 'client') {
      // Clients only see their own company folder's raw-footage
      let clientRecord;
      
      if (clientId) {
        clientRecord = await prisma.client.findUnique({
          where: { id: clientId },
          select: { companyName: true, name: true },
        });
      } else if (userId) {
        clientRecord = await prisma.client.findFirst({
          where: { userId: parseInt(userId) },
          select: { companyName: true, name: true },
        });
      }

      if (!clientRecord) {
        console.error('❌ Client not found for:', { clientId, userId });
        return NextResponse.json(
          { error: 'Client not found' }, 
          { status: 404 }
        );
      }

      companyName = clientRecord.companyName || clientRecord.name;
      prefix = `${companyName}/raw-footage/`;
      
      console.log('👤 Client prefix:', prefix);
    } else if (role === 'editor') {
      // Editors see all raw-footage folders across all companies
      prefix = '';
      console.log('✏️ Editor: Will filter for raw-footage folders');
    } else {
      // Admin/Manager see everything
      prefix = '';
      console.log('👑 Admin/Manager: Full access');
    }

    // List all objects in S3
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET!,
      Prefix: prefix,
    });

    console.log('📦 Listing S3 objects with prefix:', prefix || '(none)');

    const response = await s3Client.send(command);
    
    console.log(`📊 S3 response: ${response.Contents?.length || 0} objects found`);

    if (!response.Contents || response.Contents.length === 0) {
      return NextResponse.json({
        name: prefix ? prefix.replace(/\/$/, '').split('/').pop() || 'Root' : 'Root',
        type: 'folder',
        path: '/',
        children: []
      });
    }

    // 🔥 Filter objects based on role BEFORE building tree
    let filteredObjects = response.Contents;
    
    if (role === 'editor') {
      // Editors only see items inside raw-footage folders
      filteredObjects = response.Contents.filter(obj => {
        return obj.Key?.includes('/raw-footage/');
      });
      console.log(`✏️ Filtered for editor: ${filteredObjects.length} objects in raw-footage`);
    }

    // Build folder tree
    const tree = await buildFolderTree(filteredObjects, prefix);

    console.log('✅ Tree built successfully');
    return NextResponse.json(tree);
  } catch (error: any) {
    console.error('❌ Error fetching drive structure:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch drive structure', 
        details: error.message,
      },
      { status: 500 }
    );
  }
}

async function buildFolderTree(objects: any[], rootPrefix: string) {
  const root: any = {
    name: rootPrefix ? rootPrefix.replace(/\/$/, '').split('/').pop() || 'Root' : 'Root',
    type: 'folder',
    path: '/',
    children: []
  };

  const folderMap = new Map();
  folderMap.set('/', root);

  // Sort objects
  objects.sort((a, b) => a.Key.localeCompare(b.Key));

  for (const obj of objects) {
    try {
      const relativePath = rootPrefix ? obj.Key.replace(rootPrefix, '') : obj.Key;
      if (!relativePath) continue;

      const parts = relativePath.split('/').filter(Boolean);
      let currentPath = '/';
      let currentFolder = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLastPart = i === parts.length - 1;
        const fullPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;

        if (isLastPart && !obj.Key.endsWith('/')) {
          // It's a file - generate signed URL
          let signedUrl = null;
          try {
            signedUrl = await generateSignedUrl(obj.Key);
          } catch (error) {
            console.error(`Failed to generate signed URL for ${obj.Key}:`, error);
          }
          
          currentFolder.children.push({
            name: part,
            type: 'file',
            path: fullPath,
            s3Key: obj.Key,
            size: obj.Size,
            url: signedUrl,
            lastModified: obj.LastModified?.toISOString(),
          });
        } else {
          // It's a folder
          if (!folderMap.has(fullPath)) {
            const folder = {
              name: part,
              type: 'folder',
              path: fullPath,
              s3Key: obj.Key,
              children: []
            };
            currentFolder.children.push(folder);
            folderMap.set(fullPath, folder);
          }
          currentFolder = folderMap.get(fullPath);
          currentPath = fullPath;
        }
      }
    } catch (error) {
      console.error('Error processing object:', obj.Key, error);
    }
  }

  return root;
}