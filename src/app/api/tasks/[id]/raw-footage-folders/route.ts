export const dynamic = 'force-dynamic';
// src/app/api/tasks/[id]/raw-footage-folders/route.ts
//
// Lists folders (and files, for context) at any depth under the task's
// client's raw-footage root, for the "Link Raw Footage" picker. Accepts
// ?subpath= to drill into nested folders — same safe-prefix pattern as
// /api/shared/folder/[shareToken] (path-traversal sanitized).

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task as taskTable, client as clientTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/lib/s3';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = getDbHttp();

    const [row] = await db
      .select({ rawFootageFolderId: clientTable.rawFootageFolderId })
      .from(taskTable)
      .innerJoin(clientTable, eq(taskTable.clientId, clientTable.id))
      .where(eq(taskTable.id, id))
      .limit(1);

    if (!row?.rawFootageFolderId) {
      return NextResponse.json({ folders: [], files: [], subpath: '' });
    }

    const root = row.rawFootageFolderId.endsWith('/') ? row.rawFootageFolderId : `${row.rawFootageFolderId}/`;

    // Sanitize hard against traversal — strip any ".." segments so the
    // resolved prefix can never leave the raw-footage root.
    const rawSubpath = req.nextUrl.searchParams.get('subpath') || '';
    const safeSubpath = rawSubpath
      .split('/')
      .filter((seg) => seg && seg !== '..' && seg !== '.')
      .join('/');
    const prefix = safeSubpath ? `${root}${safeSubpath}/` : root;

    const s3 = getS3();
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, Delimiter: '/' }));

    const folders = (res.CommonPrefixes || [])
      .map((cp) => cp.Prefix || '')
      .filter(Boolean)
      .map((full) => ({
        name: full.slice(prefix.length).replace(/\/$/, ''),
        // Path relative to the raw-footage root — this is what actually
        // gets saved when a folder is linked.
        path: full.slice(root.length).replace(/\/$/, ''),
      }))
      .filter((f) => f.name);

    const files = (res.Contents || [])
      .filter((obj) => obj.Key && obj.Key !== prefix)
      .map((obj) => ({
        name: obj.Key!.slice(prefix.length),
        size: obj.Size || 0,
      }))
      .filter((f) => f.name && !f.name.includes('/'));

    return NextResponse.json({ folders, files, subpath: safeSubpath });
  } catch (err: any) {
    console.error('[GET raw-footage-folders]', err);
    if (err?.cause) console.error('Root cause:', err.cause);
    return NextResponse.json({ error: err?.cause?.message || 'Failed to list folders' }, { status: 500 });
  }
}