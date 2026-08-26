export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3, BUCKET as R2_BUCKET } from '@/lib/s3';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { client as clientTable } from '@/lib/db/schema';
import { or, eq } from 'drizzle-orm';

// GET /api/nas/browse-folders?clientName=...&folderType=raw-footage&path=June-2025
// Lists real subfolders directly from R2 (not the database) at the given
// level, so the raw-footage folder browser always reflects what's actually
// there. `path` is optional — omit for the top level.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const clientName = req.nextUrl.searchParams.get('clientName');
    const folderType = req.nextUrl.searchParams.get('folderType') || 'raw-footage';
    const subPath = req.nextUrl.searchParams.get('path') || '';

    if (!clientName) {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
    }

    // 🔥 Resolve the ACTUAL raw-footage root, same source of truth uploads
    // use (see taskService.ts / tasks/route.ts), instead of reconstructing
    // "<clientName>/raw-footage/" from the client's current display name.
    // If a client was renamed after its folders were provisioned,
    // rawFootageFolderId still points at the OLD name — reconstructing from
    // the current name silently looks at a prefix that was never used,
    // which is why the browser can come up empty even though footage exists.
    let rawFootageRoot = `${clientName}/raw-footage/`;
    if (folderType === 'raw-footage') {
      const db = getDbHttp();
      const [foundClient] = await db
        .select({ rawFootageFolderId: clientTable.rawFootageFolderId })
        .from(clientTable)
        .where(or(eq(clientTable.companyName, clientName), eq(clientTable.name, clientName)))
        .limit(1);
      if (foundClient?.rawFootageFolderId) {
        rawFootageRoot = foundClient.rawFootageFolderId.endsWith('/')
          ? foundClient.rawFootageFolderId
          : `${foundClient.rawFootageFolderId}/`;
      }
    }

    // Normalize: no leading/trailing slashes on subPath, we add them ourselves.
    const cleanSubPath = subPath.replace(/^\/+|\/+$/g, '');
    const prefix = folderType === 'raw-footage'
      ? (cleanSubPath ? `${rawFootageRoot}${cleanSubPath}/` : rawFootageRoot)
      : (cleanSubPath ? `${clientName}/${folderType}/${cleanSubPath}/` : `${clientName}/${folderType}/`);

    const s3 = getS3();
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      Delimiter: '/',
    }));

    // CommonPrefixes are the "folders" at this level.
    const folders = (result.CommonPrefixes || [])
      .map(p => p.Prefix || '')
      .filter(Boolean)
      .map(fullPrefix => {
        // Strip the base prefix to get just this level's folder name.
        const relative = fullPrefix.slice(prefix.length).replace(/\/$/, '');
        return relative;
      })
      .filter(Boolean)
      .sort();

    // Also report how many files sit directly at this level (not in a subfolder) — informational only.
    const fileCountAtThisLevel = (result.Contents || []).filter(o => o.Key && o.Key !== prefix).length;

    return NextResponse.json({
      clientName,
      folderType,
      path: cleanSubPath,
      folders,
      fileCountAtThisLevel,
    });
  } catch (err: any) {
    console.error('[NAS Browse Folders]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}