export const dynamic = 'force-dynamic';
// src/app/api/drive/structure/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { client as clientTable, user as userTable, editorClientPermission, task as taskTable, file as fileTable, nasBackupRecord } from '@/lib/db/schema';
import { and, eq, isNotNull, or } from 'drizzle-orm';
import { getStructure } from '@/lib/file-server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Merges NAS-only files (deleted from R2, still backed up) into the R2 tree
// e8-file-server returned, so Files & Drive shows them seamlessly. See the
// Files & Drive NAS-merge feature.
async function mergeNasOnlyFiles(tree: any, resolvedClientId: string | null, rootPrefix: string) {
  if (!resolvedClientId || !tree || tree.error) return tree;
  // Defensive — a malformed value (e.g. an accidentally-stringified object)
  // should just skip the merge, not blow up the whole request.
  if (resolvedClientId.includes('[object') || resolvedClientId.length > 100) {
    console.warn('⚠️  Skipping NAS merge — clientId looks malformed:', resolvedClientId);
    return tree;
  }

  const db = getDbHttp();
  const [nasFiles, nasRecords] = await Promise.all([
    db.select({ s3Key: fileTable.s3Key, name: fileTable.name, size: fileTable.size })
      .from(fileTable)
      .innerJoin(taskTable, eq(fileTable.taskId, taskTable.id))
      .where(and(eq(taskTable.clientId, resolvedClientId), eq(fileTable.archivedToNas, true), eq(fileTable.deletedFromCloud, true))),
    db.select({ s3Key: nasBackupRecord.s3Key, name: nasBackupRecord.fileName, size: nasBackupRecord.fileSize })
      .from(nasBackupRecord)
      .where(and(eq(nasBackupRecord.clientId, resolvedClientId), eq(nasBackupRecord.archivedToNas, true), eq(nasBackupRecord.deletedFromCloud, true))),
  ]);

  const nasOnly = [...nasFiles, ...nasRecords].filter((f) => !!f.s3Key);
  if (nasOnly.length === 0) return tree;

  for (const f of nasOnly) {
    const relativePath = rootPrefix ? f.s3Key!.replace(rootPrefix, '') : f.s3Key!;
    if (!relativePath) continue;
    const parts = relativePath.split('/').filter(Boolean);

    let currentFolder = tree;
    let currentPath = '/';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;
      const fullPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;

      if (isLastPart) {
        // Skip if a live R2 entry with this name already exists in this folder.
        if (!currentFolder.children.some((c: any) => c.type === 'file' && c.name === part)) {
          currentFolder.children.push({
            name: part, type: 'file', path: fullPath, s3Key: f.s3Key,
            size: Number(f.size) || 0, url: null, thumbnailUrl: null,
            lastModified: null, source: 'nas',
          });
        }
      } else {
        let folder = currentFolder.children.find((c: any) => c.type === 'folder' && c.name === part);
        if (!folder) {
          folder = { name: part, type: 'folder', path: fullPath, s3Key: f.s3Key, children: [] };
          currentFolder.children.push(folder);
        }
        currentFolder = folder;
        currentPath = fullPath;
      }
    }
  }

  return tree;
}

export async function GET(request: NextRequest) {
  const db = getDbHttp();
  const { env } = getCloudflareContext();
  console.log('api started')

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
        const [row] = await db
          .select({ companyName: clientTable.companyName, name: clientTable.name })
          .from(clientTable)
          .where(eq(clientTable.id, clientId))
          .limit(1);
        clientRecord = row ?? null;

        console.log('📂 clientId provided, found clientRecord:', clientRecord);

      } else if (userId) {
        const foundUser = await db.query.user.findFirst({
          where: eq(userTable.id, parseInt(userId)),
          columns: { email: true, linkedClientId: true },
          with: { client: { columns: { companyName: true, name: true } } },
        });
        console.log('📂 userId provided, found user:', foundUser);

        if (foundUser?.client) {
          clientRecord = foundUser.client;
          console.log('📂 derived clientRecord from linked client:', clientRecord);

        } else if (foundUser?.email) {
          const [row] = await db
            .select({ companyName: clientTable.companyName, name: clientTable.name })
            .from(clientTable)
            .where(eq(clientTable.email, foundUser.email))
            .limit(1);
          clientRecord = row ?? null;
        }
        console.log('📂 derived clientRecord:', clientRecord);
        
        if (!clientRecord) {
          console.log('📂 no clientRecord found, checking userId:', userId);
          const [row] = await db
            .select({ companyName: clientTable.companyName, name: clientTable.name })
            .from(clientTable)
            .where(eq(clientTable.userId, parseInt(userId)))
            .limit(1);
          clientRecord = row ?? null;
        }
      }

      if (!clientRecord) {
        console.log('📂 no clientRecord found for userId:', userId);
        return NextResponse.json({ error: 'Client not found', code: 'CLIENT_NOT_LINKED' }, { status: 404 });
      }
      const companyName = clientRecord.companyName || clientRecord.name;
      prefix = `${companyName}/`;

      console.log('📂 client role, using prefix:', prefix, companyName);

    } else if (role === 'admin' || role === 'manager' || role === 'scheduler') {
      // Admin/manager must pass a clientId — file server blocks empty-prefix scans
      if (clientId) {
        const [clientRecord] = await db
          .select({ companyName: clientTable.companyName, name: clientTable.name })
          .from(clientTable)
          .where(eq(clientTable.id, clientId))
          .limit(1);
        if (clientRecord) {
          prefix = `${clientRecord.companyName || clientRecord.name}/`;
          console.log('📂 admin/manager role, using prefix:', prefix);
        }
      }
      // No clientId = prefix stays '' = file server returns empty root (show "select a client")

    } else if (role === 'editor') {
      const editorId = parseInt(userId);

      // If a specific clientId is passed (editor selected a client), use it directly
      if (clientId) {
        const [clientRecord] = await db
          .select({ companyName: clientTable.companyName, name: clientTable.name })
          .from(clientTable)
          .where(eq(clientTable.id, clientId))
          .limit(1);
        if (clientRecord) {
          prefix = `${clientRecord.companyName || clientRecord.name}/`;
          console.log('📂 editor role with clientId, using prefix:', prefix);
        }
      } else {
        // Derive from assigned tasks/permissions
        const permissions = await db.query.editorClientPermission.findMany({
          where: eq(editorClientPermission.editorId, editorId),
          with: { client: { columns: { companyName: true, name: true } } },
        });
        const permNames = permissions.map(p => p.client.companyName || p.client.name).filter(Boolean);
        const taskClients = await db.query.task.findMany({
          where: and(eq(taskTable.assignedTo, editorId), isNotNull(taskTable.clientId)),
          with: { client: { columns: { companyName: true, name: true } } },
        });
        const taskNames = taskClients.map(t => t.client?.companyName || t.client?.name || '').filter(Boolean);
        const assigned = [...new Set([...permNames, ...taskNames])];
        // Only auto-scope if exactly one client — otherwise wait for selector
        console.log('📂 derived assigned clients:', assigned);
        prefix = assigned.length === 1 ? `${assigned[0]}/` : '';
      }
    }

    console.log('📂 userId, role, prefix:', userId, role, prefix);

    let resolvedClientId: string | null = clientId;
    if (!resolvedClientId && prefix) {
      const companyName = prefix.replace(/\/$/, '');
      const [row] = await db
        .select({ id: clientTable.id })
        .from(clientTable)
        .where(or(eq(clientTable.companyName, companyName), eq(clientTable.name, companyName)))
        .limit(1);
      resolvedClientId = row?.id || null;
    }

    const tree = await getStructure(env, userId, role, prefix);
    try {
      await mergeNasOnlyFiles(tree, resolvedClientId, prefix);
    } catch (mergeError: any) {
      // The NAS merge is an enhancement on top of the core R2 listing — it
      // must never be able to take the whole response down. Log it and
      // just return the plain R2 tree instead.
      console.error('⚠️  NAS merge failed (returning R2-only tree):', mergeError.message);
      if (mergeError.cause) console.error('Root cause:', mergeError.cause);
    }

    console.log('✅ tree:', { tree });
    return NextResponse.json(tree);

  } catch (error: any) {
    console.error('❌ Structure error:', error);
    if (error.cause) console.error('Root cause:', error.cause);
    return NextResponse.json({
      error: 'Failed to fetch structure',
      details: error?.cause?.message || error.message,
      stack: error.stack,
      cause: error.cause,
    }, { status: 500 });
  }
}