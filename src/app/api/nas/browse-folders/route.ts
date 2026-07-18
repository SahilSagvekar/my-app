export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3, BUCKET as R2_BUCKET } from '@/lib/s3';
import { getCurrentUser2 } from '@/lib/auth';

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

    // Normalize: no leading/trailing slashes on subPath, we add them ourselves.
    const cleanSubPath = subPath.replace(/^\/+|\/+$/g, '');
    const prefix = cleanSubPath
      ? `${clientName}/${folderType}/${cleanSubPath}/`
      : `${clientName}/${folderType}/`;

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