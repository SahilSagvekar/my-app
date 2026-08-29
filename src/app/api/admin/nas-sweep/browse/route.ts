export const dynamic = 'force-dynamic';
// src/app/api/admin/nas-sweep/browse/route.ts
//
// Lists files for a client with their current NAS backup status, for the
// manual NAS backup admin panel's file picker. Split by folderType:
//   - outputs: from the File table (joined via task), same as before.
//   - raw-footage / elements: listed directly from R2 by the client's
//     known prefix and tracked via NasBackupRecord — see nas-backup-records.ts.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable, task as taskTable, client as clientTable } from '@/lib/db/schema';
import { and, eq, not, like, desc } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { listTrackedFiles } from '@/lib/nas-backup-records';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const folderType = (searchParams.get('folderType') || 'outputs') as 'outputs' | 'raw-footage' | 'elements';

    if (!clientId) {
      // No client selected yet — just return the client list for the picker.
      const clients = await getDbHttp()
        .select({ id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName })
        .from(clientTable)
        .orderBy(clientTable.name);
      return NextResponse.json({ clients });
    }

    if (folderType === 'raw-footage' || folderType === 'elements') {
      const files = await listTrackedFiles(clientId, folderType);
      return NextResponse.json({
        files: files.map((f) => ({
          id: f.backupRecordId,
          name: f.fileName,
          s3Key: f.s3Key,
          size: f.fileSize,
          archivedToNas: f.archivedToNas,
          nasArchivedAt: f.nasArchivedAt,
          nasPath: f.nasPath,
          taskTitle: null,
        })),
      });
    }

    const db = getDbHttp();
    const rows = await db
      .select({
        id: fileTable.id,
        name: fileTable.name,
        s3Key: fileTable.s3Key,
        size: fileTable.size,
        archivedToNas: fileTable.archivedToNas,
        nasArchivedAt: fileTable.nasArchivedAt,
        nasPath: fileTable.nasPath,
        taskTitle: taskTable.title,
        uploadedAt: fileTable.uploadedAt,
      })
      .from(fileTable)
      .innerJoin(taskTable, eq(fileTable.taskId, taskTable.id))
      .where(and(
        eq(taskTable.clientId, clientId),
        eq(fileTable.isActive, true),
        not(eq(fileTable.deletedFromCloud, true)),
        not(like(fileTable.s3Key, '%raw-footage%')),
      ))
      .orderBy(desc(fileTable.uploadedAt))
      .limit(500);

    const eligible = rows.filter((r) => !!r.s3Key);

    return NextResponse.json({ files: eligible });
  } catch (err: any) {
    console.error('[NAS Browse] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Failed to load files' }, { status: 500 });
  }
}