export const dynamic = 'force-dynamic';
// src/app/api/drive/structure/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl, getS3, BUCKET } from '@/lib/s3';
import { getStructure } from '@/lib/file-server';

const s3Client = getS3();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const role = searchParams.get('role') || 'admin';
    const userId = searchParams.get('userId') || '0';

    console.log('🔍 Drive structure request:', { clientId, role, userId });

    let prefix = '';

    if (role === 'client') {
      let clientRecord = null;

      if (clientId) {
        clientRecord = await prisma.client.findUnique({
          where: { id: clientId },
          select: { companyName: true, name: true },
        });
      } else if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: parseInt(userId) },
          select: {
            email: true,
            linkedClientId: true,
            linkedClient: { select: { companyName: true, name: true } },
          },
        });
        if (user?.linkedClient) {
          clientRecord = user.linkedClient;
        } else if (user?.email) {
          clientRecord = await prisma.client.findFirst({
            where: { email: user.email },
            select: { companyName: true, name: true },
          });
        }
        if (!clientRecord) {
          clientRecord = await prisma.client.findFirst({
            where: { userId: parseInt(userId) },
            select: { companyName: true, name: true },
          });
        }
      }

      if (!clientRecord) {
        return NextResponse.json({ error: 'Client not found', code: 'CLIENT_NOT_LINKED' }, { status: 404 });
      }
      const companyName = clientRecord.companyName || clientRecord.name;
      prefix = `${companyName}/`;

    } else if (role === 'admin' || role === 'manager') {
      // Admin/manager must pass a clientId — file server blocks empty-prefix scans
      if (clientId) {
        const clientRecord = await prisma.client.findUnique({
          where: { id: clientId },
          select: { companyName: true, name: true },
        });
        if (clientRecord) {
          const companyName = clientRecord.companyName || clientRecord.name;
          prefix = `${companyName}/`;
        }
      }
      // If no clientId passed, prefix stays '' — file server will block and return empty root

    } else if (role === 'editor') {
      const editorId = parseInt(userId);
      const permissions = await prisma.editorClientPermission.findMany({
        where: { editorId },
        include: { client: { select: { companyName: true, name: true } } },
      });
      const permNames = permissions.map(p => p.client.companyName || p.client.name).filter(Boolean);
      const taskClients = await prisma.task.findMany({
        where: { assignedTo: editorId, clientId: { not: null } },
        select: { client: { select: { companyName: true, name: true } } },
        distinct: ['clientId'],
      });
      const taskNames = taskClients.map(t => t.client?.companyName || t.client?.name || '').filter(Boolean);
      const assigned = [...new Set([...permNames, ...taskNames])];
      prefix = assigned.length === 1 ? `${assigned[0]}/` : '';
    }

    const tree = await getStructure(userId, role, prefix);
    return NextResponse.json(tree);

  } catch (error: any) {
    console.error('❌ Structure error:', error);
    return NextResponse.json({ error: 'Failed to fetch structure', details: error.message }, { status: 500 });
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

  // Sort all folder children smartly
  sortFolderChildren(root);

  return root;
}

// ─── Month name to index for chronological sorting ───
const MONTH_ORDER: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3,
  may: 4, june: 5, july: 6, august: 7,
  september: 8, october: 9, november: 10, december: 11,
};

// Parse "April-2026" or "January-2025" into sortable value
function getMonthSortValue(name: string): number | null {
  const match = name.match(/^([A-Za-z]+)-(\d{4})$/);
  if (!match) return null;
  const monthIdx = MONTH_ORDER[match[1].toLowerCase()];
  if (monthIdx === undefined) return null;
  const year = parseInt(match[2]);
  return year * 12 + monthIdx; // e.g. 2025*12+0=24300 for Jan 2025
}

// Natural number sort: extract leading number from name
function getLeadingNumber(name: string): number | null {
  const match = name.match(/^(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Recursively sort all children in the tree
function sortFolderChildren(folder: any) {
  if (!folder.children || folder.children.length === 0) return;

  folder.children.sort((a: any, b: any) => {
    // 1. Folders first, files second
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;

    // 2. Try month sort (April-2026, January-2025)
    const aMonth = getMonthSortValue(a.name);
    const bMonth = getMonthSortValue(b.name);
    if (aMonth !== null && bMonth !== null) {
      return aMonth - bMonth;
    }

    // 3. Try numeric sort (1, 2, 10, 34)
    const aNum = getLeadingNumber(a.name);
    const bNum = getLeadingNumber(b.name);
    if (aNum !== null && bNum !== null) {
      return aNum - bNum;
    }

    // 4. Fallback: alphabetical
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Recurse into subfolders
  for (const child of folder.children) {
    if (child.type === 'folder') {
      sortFolderChildren(child);
    }
  }
}