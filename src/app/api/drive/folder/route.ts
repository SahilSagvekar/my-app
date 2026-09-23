export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getDbHttp } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getS3, BUCKET } from '@/lib/s3';
import { getCurrentUser2 } from '@/lib/auth';
import { createFolder, renameFolder } from '@/lib/file-server';
import { logDriveActivity, rewriteStarsForMove } from '@/lib/drive/index-store';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const s3Client = getS3();

/**
 * POST /api/drive/folder
 * Create a new folder
 */
export async function POST(request: NextRequest) {
  const db = getDbHttp();
  const { env } = getCloudflareContext();
  try {
    const user = await getCurrentUser2(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { folderPath, folderName } = await request.json();
    // 🔒 Identity from the session — `role`/`userId` in the body used to be
    // trusted, so a client could send role:'admin' to skip the checks below.
    const role = user.role as string;
    const userId = String(user.id);
    if (!folderPath || !folderName) {
      return NextResponse.json({ error: 'Folder path and name are required' }, { status: 400 });
    }

    if (role === 'client') {
      if (!folderPath.includes('raw-footage')) {
        return NextResponse.json({ error: 'You can only create folders in your raw footage area' }, { status: 403 });
      }
      const pathParts = folderPath.split('/').filter(Boolean);
      const rfIndex = pathParts.findIndex((p: string) => p === 'raw-footage');
      const depth = rfIndex >= 0 ? pathParts.length - rfIndex - 1 : -1;
      if (depth < 2) {
        return NextResponse.json({ error: 'You can only create folders inside your deliverable folders' }, { status: 403 });
      }
      if (userId) {
        const u = await db.query.user.findFirst({
          where: eq(userTable.id, parseInt(userId)),
          with: { client: { columns: { companyName: true, name: true } } },
        });
        const company = u?.client?.companyName || u?.client?.name;
        if (company && !folderPath.startsWith(company)) {
          return NextResponse.json({ error: 'You can only create folders in your own area' }, { status: 403 });
        }
      }
    }

    const result = await createFolder(env, user.id, user.role, folderPath, folderName);
    if (result?.folderPath) {
      await logDriveActivity([{ key: result.folderPath, action: 'folder_created', userId: user.id }]);
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Create folder error:', error);
    return NextResponse.json({ error: 'Failed to create folder', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const db = getDbHttp();
  const { env } = getCloudflareContext();
  try {
    const user = await getCurrentUser2(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { oldPath, newName } = await request.json();
    const role = user.role as string;
    const userId = String(user.id);
    if (!oldPath || !newName) {
      return NextResponse.json({ error: 'Old path and new name are required' }, { status: 400 });
    }

    if (role === 'client') {
      if (!oldPath.includes('raw-footage')) {
        return NextResponse.json({ error: 'You can only rename folders in your raw footage area' }, { status: 403 });
      }
      const pathParts = oldPath.split('/').filter(Boolean);
      const rfIndex = pathParts.findIndex((p: string) => p === 'raw-footage');
      const depth = rfIndex >= 0 ? pathParts.length - rfIndex - 1 : -1;
      if (depth < 3) {
        return NextResponse.json({ error: 'You can only rename folders you created inside deliverable folders' }, { status: 403 });
      }
      if (userId) {
        const u = await db.query.user.findFirst({
          where: eq(userTable.id, parseInt(userId)),
          with: { client: { columns: { companyName: true, name: true } } },
        });
        const company = u?.client?.companyName || u?.client?.name;
        if (company && !oldPath.startsWith(company)) {
          return NextResponse.json({ error: 'You can only rename folders in your own area' }, { status: 403 });
        }
      }
    }

    const result = await renameFolder(env, user.id, user.role, oldPath, newName);
    if (result?.oldPath && result?.newPath) {
      await rewriteStarsForMove(result.oldPath, result.newPath, true).catch(() => {});
      await logDriveActivity([{ key: result.newPath, action: 'renamed', userId: user.id, details: { from: result.oldPath } }]);
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Rename folder error:', error);
    return NextResponse.json({ error: 'Failed to rename folder', details: error.message }, { status: 500 });
  }
}