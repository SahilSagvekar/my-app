export const dynamic = 'force-dynamic';
// src/app/api/drive/structure/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl, getS3, BUCKET } from '@/lib/s3';

const s3Client = getS3();

// export async function GET(request: NextRequest) {
//   try {
//     const { searchParams } = new URL(request.url);
//     const clientId = searchParams.get('clientId');
//     const role = searchParams.get('role');
//     const userId = searchParams.get('userId');

//     console.log('🔍 Drive structure request:', { clientId, role, userId });

//     let prefix = '';
//     let companyName = '';

//     // Determine which folders to show based on role
//     if (role === 'client') {
//       // Clients only see their own company folder's raw-footage
//       let clientRecord;

//       if (clientId) {
//         clientRecord = await prisma.client.findUnique({
//           where: { id: clientId }, 
//           select: { companyName: true, name: true },
//         });

//         console.log('👤 clientRecord:', clientRecord);
//       } else if (userId) {
//         // 🔥 NEW: Look for linkedClientId on User instead of userId on Client
//         const user = await prisma.user.findUnique({
//           where: { id: parseInt(userId) },
//           select: {
//             linkedClientId: true,
//             linkedClient: {
//               select: { companyName: true, name: true }
//             }
//           },
//         });

//         console.log('👤 user:', user);

//         if (user?.linkedClient) {
//           clientRecord = user.linkedClient;

//           console.log('👤 clientRecord:', clientRecord);
//         } else {
//           // Fallback to old method (Client.userId) for backward compatibility
//           clientRecord = await prisma.client.findFirst({
//             where: { userId: parseInt(userId) },
//             select: { companyName: true, name: true },
//           });
//         }
//       }

//       if (!clientRecord) {
//         console.error('❌ Client not found for:', { clientId, userId });

//         // Check if this is a user with 'client' role but not linked to any client
//         if (userId) {
//           const user = await prisma.user.findUnique({
//             where: { id: parseInt(userId) },
//             select: { id: true, name: true, role: true },
//           });

//           console.log('👤 user:', userId);
//           console.log('👤 user:', user);

//           if (user && user.role === 'client') {
//             return NextResponse.json(
//               {
//                 error: 'Your account is not linked to any client. Please contact an administrator to link your account to a client.',
//                 code: 'CLIENT_NOT_LINKED',
//                 userId: userId,
//               },
//               { status: 404 }
//             );
//           }
//         }

//         return NextResponse.json(
//           { error: 'Client not found' },
//           { status: 404 }
//         );
//       }

//       companyName = clientRecord.companyName || clientRecord.name;
//       prefix = `${companyName}/raw-footage/`;

//       console.log('👤 Client prefix:', prefix);
//     } else if (role === 'editor') {
//       // Editors see all raw-footage folders across all companies
//       prefix = '';
//       console.log('✏️ Editor: Will filter for raw-footage folders');
//     } else if (role === 'admin' || role === 'manager') {
//       // Admin/Manager see everything - no prefix restriction
//       prefix = '';
//       console.log('👑 Admin/Manager: Full access to all files and folders');
//     } else {
//       // Default case - treat as admin for backward compatibility
//       prefix = '';
//       console.log('⚠️ Unknown role, defaulting to full access:', role);
//     }

//     // List ALL objects in S3 with pagination (S3 returns max 1000 per request)
//     let allContents: any[] = [];
//     let continuationToken: string | undefined = undefined;

//     do {
//       const command = new ListObjectsV2Command({
//         Bucket: process.env.AWS_S3_BUCKET!,
//         Prefix: prefix,
//         ContinuationToken: continuationToken,
//       });

//       console.log('📦 Listing S3 objects with prefix:', prefix || '(none)', continuationToken ? '(continuing...)' : '');

//       const response = await s3Client.send(command);

//       if (response.Contents) {
//         allContents = allContents.concat(response.Contents);
//       }

//       continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
//     } while (continuationToken);

//     console.log(`📊 S3 response: ${allContents.length} total objects found`);

//     if (allContents.length === 0) {
//       return NextResponse.json({
//         name: prefix ? prefix.replace(/\/$/, '').split('/').pop() || 'Root' : 'Root',
//         type: 'folder',
//         path: '/',
//         children: []
//       });
//     }

//     // 🔥 Filter objects based on role BEFORE building tree
//     let filteredObjects = allContents;

//     if (role === 'editor') {
//       // Editors only see items inside raw-footage folders
//       filteredObjects = allContents.filter(obj => {
//         return obj.Key?.includes('/raw-footage/');
//       });
//       console.log(`✏️ Filtered for editor: ${filteredObjects.length} objects in raw-footage`);
//     }

//     // Build folder tree
//     const tree = await buildFolderTree(filteredObjects, prefix);

//     console.log('✅ Tree built successfully');
//     return NextResponse.json(tree);
//   } catch (error: any) {
//     console.error('❌ Error fetching drive structure:', error);
//     return NextResponse.json(
//       {
//         error: 'Failed to fetch drive structure',
//         details: error.message,
//       },
//       { status: 500 }
//     );
//   }
// }

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
        // Direct clientId provided
        clientRecord = await prisma.client.findUnique({
          where: { id: clientId },
          select: { companyName: true, name: true },
        });

        console.log('👤 clientRecord (via clientId):', clientRecord);
      } else if (userId) {
        // Find client via userId - try multiple methods
        const user = await prisma.user.findUnique({
          where: { id: parseInt(userId) },
          select: {
            id: true,
            email: true,
            linkedClientId: true,
            linkedClient: {
              select: { companyName: true, name: true }
            }
          },
        });

        console.log('👤 user:', user);

        if (user?.linkedClient) {
          // Method 1: User has linkedClientId set
          clientRecord = user.linkedClient;
          console.log('👤 clientRecord (via linkedClientId):', clientRecord);
        } else if (user?.email) {
          // Method 2: Find Client by matching email (for clients onboarded via form)
          clientRecord = await prisma.client.findFirst({
            where: { email: user.email },
            select: { companyName: true, name: true },
          });
          console.log('👤 clientRecord (via email match):', clientRecord);
        }

        // Method 3: Fallback to old method (Client.userId) for backward compatibility
        if (!clientRecord) {
          clientRecord = await prisma.client.findFirst({
            where: { userId: parseInt(userId) },
            select: { companyName: true, name: true },
          });
          console.log('👤 clientRecord (via Client.userId fallback):', clientRecord);
        }
      }

      if (!clientRecord) {
        console.error('❌ Client not found for:', { clientId, userId });

        // Check if this is a user with 'client' role but not linked to any client
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) },
            select: { id: true, name: true, email: true, role: true },
          });

          console.log('👤 Unlinked user check:', user);

          if (user && user.role === 'client') {
            return NextResponse.json(
              {
                error: 'Your account is not linked to any client. Please contact an administrator to link your account to a client.',
                code: 'CLIENT_NOT_LINKED',
                userId: userId,
                userEmail: user.email,
              },
              { status: 404 }
            );
          }
        }

        return NextResponse.json(
          { error: 'Client not found' },
          { status: 404 }
        );
      }

      companyName = clientRecord.companyName || clientRecord.name;
      // prefix = `${companyName}/raw-footage/`;
      prefix = `${companyName}/`; // 🔥 Expose all files in company folder

      console.log('👤 Client prefix:', prefix);
    } else if (role === 'editor') {
      // Editors see files for clients they are assigned to
      // Source 1: EditorClientPermission table (admin-managed)
      // Source 2: Distinct clients from tasks assigned to this editor (ground truth)
      let assignedCompanyNames: string[] = [];
      if (userId) {
        const editorId = parseInt(userId);

        // Source 1: Explicit permissions
        const permissions = await prisma.editorClientPermission.findMany({
          where: { editorId },
          include: {
            client: { select: { companyName: true, name: true } },
          },
        });
        const permNames = permissions
          .map(p => p.client.companyName || p.client.name)
          .filter(Boolean);

        // Source 2: Clients from tasks actually assigned to this editor
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

        // Merge and deduplicate
        assignedCompanyNames = [...new Set([...permNames, ...taskNames])];
        console.log(`✏️ Editor ${userId} — perms: [${permNames.join(', ')}], tasks: [${taskNames.join(', ')}], merged: [${assignedCompanyNames.join(', ')}]`);
      }
      prefix = '';
      // Store for filtering later
      (request as any).__editorAssignedClients = assignedCompanyNames;
      console.log('✏️ Editor: Will filter for assigned client folders');
    } else if (role === 'admin' || role === 'manager') {
      // Admin/Manager see everything - no prefix restriction
      prefix = '';
      console.log('👑 Admin/Manager: Full access to all files and folders');
    } else {
      // Default case - treat as admin for backward compatibility
      prefix = '';
      console.log('⚠️ Unknown role, defaulting to full access:', role);
    }

    // List ALL objects in S3 with pagination (S3 returns max 1000 per request)
    let allContents: any[] = [];
    let continuationToken: string | undefined = undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      console.log('📦 Listing S3 objects with prefix:', prefix || '(none)', continuationToken ? '(continuing...)' : '');

      const response = await s3Client.send(command);

      if (response.Contents) {
        allContents = allContents.concat(response.Contents);
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    console.log(`📊 S3 response: ${allContents.length} total objects found`);

    if (allContents.length === 0) {
      return NextResponse.json({
        name: prefix ? prefix.replace(/\/$/, '').split('/').pop() || 'Root' : 'Root',
        type: 'folder',
        path: '/',
        children: []
      });
    }

    // 🔥 Filter objects based on role BEFORE building tree
    let filteredObjects = allContents;

    if (role === 'editor') {
      const assignedClients: string[] = (request as any).__editorAssignedClients || [];
      if (assignedClients.length > 0) {
        // Show all files/folders for assigned clients
        filteredObjects = allContents.filter(obj => {
          const key = obj.Key || '';
          return assignedClients.some(clientName => key.startsWith(`${clientName}/`));
        });
      } else {
        // Fallback: editors with no assignments see raw-footage across all companies
        filteredObjects = allContents.filter(obj => {
          return obj.Key?.includes('/raw-footage/');
        });
      }
      console.log(`✏️ Filtered for editor: ${filteredObjects.length} objects (${assignedClients.length} assigned clients)`);
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