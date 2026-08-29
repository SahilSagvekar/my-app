export const dynamic = 'force-dynamic';
// src/app/api/admin/nas-sweep/status/route.ts
//
// Reports per-file status for a manually-triggered batch. Cross-references
// two sources rather than adding new tracking: Postgres for "done" and the
// Redis failed-jobs list for "failed" (with the real error message).
// Anything in neither bucket is still queued/copying.
//
// IDs may belong to either File (outputs) or NasBackupRecord
// (raw-footage/elements) — checked against both since a single polling
// call doesn't know which table each id came from.
//
// GET ?fileIds=id1,id2,id3

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable, nasBackupRecord } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { getRecentFailedNasSweepJobs } from '@/lib/nas-sweep-queue';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fileIds = (searchParams.get('fileIds') || '').split(',').filter(Boolean);
    if (fileIds.length === 0) {
      return NextResponse.json({ error: 'fileIds required' }, { status: 400 });
    }

    const db = getDbHttp();
    const [fileRows, backupRecordRows, failedJobs] = await Promise.all([
      db
        .select({ id: fileTable.id, archivedToNas: fileTable.archivedToNas, nasArchivedAt: fileTable.nasArchivedAt, nasPath: fileTable.nasPath })
        .from(fileTable)
        .where(inArray(fileTable.id, fileIds)),
      db
        .select({ id: nasBackupRecord.id, archivedToNas: nasBackupRecord.archivedToNas, nasArchivedAt: nasBackupRecord.nasArchivedAt, nasPath: nasBackupRecord.nasPath })
        .from(nasBackupRecord)
        .where(inArray(nasBackupRecord.id, fileIds)),
      getRecentFailedNasSweepJobs(),
    ]);

    const failedByFileId = new Map(
      failedJobs.map((j) => [j.fileId || j.backupRecordId, j.error])
    );
    const doneById = new Map([...fileRows, ...backupRecordRows].map((r) => [r.id, r]));

    const statuses = fileIds.map((id) => {
      const done = doneById.get(id);
      if (done?.archivedToNas) {
        return { fileId: id, status: 'done' as const, nasArchivedAt: done.nasArchivedAt, nasPath: done.nasPath };
      }
      const failedError = failedByFileId.get(id);
      if (failedError) {
        return { fileId: id, status: 'failed' as const, error: failedError };
      }
      return { fileId: id, status: 'queued' as const };
    });

    return NextResponse.json({ statuses });
  } catch (err: any) {
    console.error('[NAS Status] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Status check failed' }, { status: 500 });
  }
}