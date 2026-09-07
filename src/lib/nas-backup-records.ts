// src/lib/nas-backup-records.ts
//
// Raw-footage and elements files aren't tracked in the File table (it
// requires a non-nullable taskId; these files aren't tied to a task), so
// they can't be discovered/tracked the way outputs are. This lists them
// directly from R2 by the client's known prefix and tracks their NAS
// backup status via NasBackupRecord (keyed by s3Key) instead.

import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/lib/s3';
import { getDbHttp } from '@/lib/db';
import { nasBackupRecord, client as clientTable } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { createId } from '@/lib/db/id';

export type TrackedFolderType = 'raw-footage' | 'elements';

export interface BackupListFile {
  s3Key: string;
  fileName: string;
  fileSize: number;
  backupRecordId: string;
  archivedToNas: boolean;
  nasArchivedAt: string | null;
  nasPath: string | null;
}

function prefixFor(
  client: { companyName: string | null; name: string; rawFootageFolderId: string | null; essentialsFolderId: string | null },
  folderType: TrackedFolderType,
): string | null {
  // rawFootageFolderId / essentialsFolderId are meant to hold a ready-to-use
  // S3 prefix (see upload/route.ts), but this was never backfilled for every
  // client — plenty of clients have it null despite having real raw-footage
  // or elements files in R2. Prefer the stored value when present (respects
  // any client with a non-standard path), but always fall back to deriving
  // it the same way the rest of the app already assumes files are laid out:
  // {companyName or name}/raw-footage/ or {companyName or name}/elements/.
  const stored = folderType === 'raw-footage' ? client.rawFootageFolderId : client.essentialsFolderId;
  if (stored) return stored.endsWith('/') ? stored : `${stored}/`;

  const company = client.companyName || client.name;
  if (!company) return null;
  const folderName = folderType === 'raw-footage' ? 'raw-footage' : 'elements';
  return `${company}/${folderName}/`;
}

/**
 * Lists every file under a client's raw-footage or elements prefix in R2,
 * ensuring a NasBackupRecord row exists for each (creating one — status
 * "not backed up" — the first time a given s3Key is seen), and returns the
 * merged view the admin panel needs.
 */
export async function listTrackedFiles(clientId: string, folderType: TrackedFolderType): Promise<BackupListFile[]> {
  const db = getDbHttp();

  const [client] = await db
    .select({ id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName, rawFootageFolderId: clientTable.rawFootageFolderId, essentialsFolderId: clientTable.essentialsFolderId })
    .from(clientTable)
    .where(eq(clientTable.id, clientId))
    .limit(1);
  if (!client) return [];

  const prefix = prefixFor(client, folderType);
  if (!prefix) return []; // client has no folder of this type configured

  const s3 = getS3();
  const objects: { Key: string; Size: number }[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents || []) {
      if (obj.Key && !obj.Key.endsWith('/') && obj.Size) {
        objects.push({ Key: obj.Key, Size: obj.Size });
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  if (objects.length === 0) return [];

  const keys = objects.map((o) => o.Key);
  const existing = await db
    .select()
    .from(nasBackupRecord)
    .where(inArray(nasBackupRecord.s3Key, keys));
  const existingByKey = new Map(existing.map((r) => [r.s3Key, r]));

  const now = new Date().toISOString();
  const toInsert = objects
    .filter((o) => !existingByKey.has(o.Key))
    .map((o) => ({
      id: createId(),
      clientId,
      folderType,
      s3Key: o.Key,
      fileName: o.Key.split('/').pop() || o.Key,
      fileSize: o.Size,
      archivedToNas: false,
      updatedAt: now,
    }));

  if (toInsert.length > 0) {
    const inserted = await db.insert(nasBackupRecord).values(toInsert).returning();
    for (const r of inserted) existingByKey.set(r.s3Key, r);
  }

  return objects.map((o) => {
    const record = existingByKey.get(o.Key)!;
    return {
      s3Key: o.Key,
      fileName: record.fileName,
      fileSize: o.Size,
      backupRecordId: record.id,
      archivedToNas: record.archivedToNas,
      nasArchivedAt: record.nasArchivedAt,
      nasPath: record.nasPath,
    };
  });
}

/** All active clients — used by the weekly auto-sweep. Every active client
 * qualifies now that prefixFor() derives a usable prefix even when
 * rawFootageFolderId/essentialsFolderId isn't set (see prefixFor above) —
 * previously this filtered out any client missing that column, silently
 * excluding them from the automatic sweep even when they had real files. */
export async function getClientsWithTrackedFolders(folderType: TrackedFolderType): Promise<{ id: string; name: string }[]> {
  const db = getDbHttp();
  const rows = await db
    .select({ id: clientTable.id, name: clientTable.name })
    .from(clientTable)
    .where(eq(clientTable.status, 'active'));
  return rows;
}