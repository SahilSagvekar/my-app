export const dynamic = 'force-dynamic';
// src/app/api/admin/nas-sweep/delete-archived/route.ts
//
// Deletes files from Cloudflare R2 — but ONLY files already confirmed
// backed up to NAS (archivedToNas === true). This is the one place in the
// app where that rule is enforced; the general Drive delete
// (/api/drive/delete) does not gate on NAS backup status at all.
//
// Body: { ids: string[], folderType }
//   - folderType 'outputs'                 -> ids are File.id
//   - folderType 'raw-footage'/'elements'   -> ids are NasBackupRecord.id
//
// Any id whose row is not archivedToNas is skipped (never deleted), and
// reported back in `skipped` so the admin panel can show why.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable, nasBackupRecord } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { deleteItem } from '@/lib/file-server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function POST(req: NextRequest) {
  const { env } = getCloudflareContext();
  const user = await getCurrentUser2(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ids } = body as { ids?: string[] };
    const folderType = (body.folderType || 'outputs') as 'outputs' | 'raw-footage' | 'elements';

    if (!ids?.length) {
      return NextResponse.json({ error: 'Provide ids' }, { status: 400 });
    }

    const db = getDbHttp();
    const now = new Date().toISOString();

    const deleted: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    const failed: { id: string; reason: string }[] = [];

    if (folderType === 'raw-footage' || folderType === 'elements') {
      const rows = await db.select().from(nasBackupRecord).where(inArray(nasBackupRecord.id, ids));
      const rowsById = new Map(rows.map((r) => [r.id, r]));

      for (const id of ids) {
        const row = rowsById.get(id);
        if (!row) { skipped.push({ id, reason: 'Not found' }); continue; }
        if (!row.archivedToNas) { skipped.push({ id, reason: 'Not backed up to NAS yet' }); continue; }
        if (row.deletedFromCloud) { skipped.push({ id, reason: 'Already deleted from cloud' }); continue; }

        try {
          await deleteItem(env, user.id, user.role, row.s3Key, 'file');
          await db.update(nasBackupRecord)
            .set({ deletedFromCloud: true, deletedFromCloudAt: now, updatedAt: now })
            .where(eq(nasBackupRecord.id, id));
          deleted.push(id);
        } catch (err: any) {
          failed.push({ id, reason: err.message || 'Delete failed' });
        }
      }
    } else {
      const rows = await db.select().from(fileTable).where(inArray(fileTable.id, ids));
      const rowsById = new Map(rows.map((r) => [r.id, r]));

      for (const id of ids) {
        const row = rowsById.get(id);
        if (!row || !row.s3Key) { skipped.push({ id, reason: 'Not found' }); continue; }
        if (!row.archivedToNas) { skipped.push({ id, reason: 'Not backed up to NAS yet' }); continue; }
        if (row.deletedFromCloud) { skipped.push({ id, reason: 'Already deleted from cloud' }); continue; }

        try {
          await deleteItem(env, user.id, user.role, row.s3Key, 'file');
          await db.update(fileTable)
            .set({ deletedFromCloud: true, deletedFromCloudAt: now })
            .where(and(eq(fileTable.id, id)));
          deleted.push(id);
        } catch (err: any) {
          failed.push({ id, reason: err.message || 'Delete failed' });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      deletedCount: deleted.length,
      deleted,
      skipped,
      failed,
    });
  } catch (err: any) {
    console.error('[NAS Delete Archived] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 });
  }
}