export const dynamic = 'force-dynamic';
// src/app/api/drive/search/route.ts
// Global deep search across all S3/R2 folders

import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl, getS3, BUCKET } from '@/lib/s3';

const s3Client = getS3();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase().trim();
    const role = searchParams.get('role');
    const userId = searchParams.get('userId');
    const maxResults = Math.min(parseInt(searchParams.get('max') || '50'), 100);

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    console.log('🔍 Drive search:', { query, role, userId });

    // Determine prefix based on role (same logic as structure route)
    let prefix = '';

    if (role === 'client') {
      let clientRecord = null;

      if (userId) {
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
        } else {
          // Fallback
          clientRecord = await prisma.client.findFirst({
            where: { userId: parseInt(userId) },
            select: { companyName: true, name: true },
          });
        }
      }

      if (!clientRecord) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }

      const companyName = clientRecord.companyName || clientRecord.name;
      prefix = `${companyName}/`;
    } else if (role === 'editor') {
      // Editors see files for assigned clients — same logic as structure route
      let assignedCompanyNames: string[] = [];
      if (userId) {
        const editorId = parseInt(userId);

        const permissions = await prisma.editorClientPermission.findMany({
          where: { editorId },
          include: {
            client: { select: { companyName: true, name: true } },
          },
        });
        const permNames = permissions
          .map(p => p.client.companyName || p.client.name)
          .filter(Boolean);

        const taskClients = await prisma.task.findMany({
          where: { assignedTo: editorId, clientId: { not: null } },
          select: {
            client: { select: { companyName: true, name: true } },
          },
          distinct: ['clientId'],
        });
        const taskNames = taskClients
          .map(t => t.client?.companyName || t.client?.name || '')
          .filter(Boolean);

        assignedCompanyNames = [...new Set([...permNames, ...taskNames])];
      }
      prefix = '';
      (request as any).__editorAssignedClients = assignedCompanyNames;
    }

    // List ALL objects with pagination
    let allContents: any[] = [];
    let continuationToken: string | undefined = undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        allContents = allContents.concat(response.Contents);
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    // Filter for editors
    if (role === 'editor') {
      const assignedClients: string[] = (request as any).__editorAssignedClients || [];
      if (assignedClients.length > 0) {
        allContents = allContents.filter(obj => {
          const key = obj.Key || '';
          return assignedClients.some(clientName => key.startsWith(`${clientName}/`));
        });
      } else {
        allContents = allContents.filter(obj => obj.Key?.includes('/raw-footage/'));
      }
    }

    // Search: match filename against query
    const results: any[] = [];

    for (const obj of allContents) {
      if (!obj.Key || obj.Key.endsWith('/')) continue; // Skip folders

      const fileName = obj.Key.split('/').pop()?.toLowerCase() || '';
      const fullPath = obj.Key.toLowerCase();

      // Match against filename or full path
      if (fileName.includes(query) || fullPath.includes(query)) {
        // Generate signed URL
        let signedUrl = null;
        try {
          signedUrl = await generateSignedUrl(obj.Key);
        } catch (e) {
          console.error(`Failed to generate signed URL for ${obj.Key}:`, e);
        }

        // Build breadcrumb path parts
        const pathParts = obj.Key.split('/').filter(Boolean);
        const name = pathParts.pop() || '';
        const folderPath = pathParts.join('/');

        results.push({
          name,
          type: 'file',
          path: '/' + pathParts.join('/') + '/' + name,
          s3Key: obj.Key,
          size: obj.Size,
          url: signedUrl,
          lastModified: obj.LastModified?.toISOString(),
          folderPath, // Where the file lives
          breadcrumbParts: pathParts, // For navigation
        });

        if (results.length >= maxResults) break;
      }
    }

    console.log(`🔍 Search found ${results.length} results for "${query}"`);

    return NextResponse.json({
      query,
      results,
      totalScanned: allContents.length,
    });

  } catch (error: any) {
    console.error('❌ Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    );
  }
}