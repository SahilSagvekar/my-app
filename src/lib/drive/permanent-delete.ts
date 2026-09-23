// src/lib/drive/permanent-delete.ts
//
// The real, irreversible delete for Drive's Trash — used by "Delete
// forever" and by the 30-day retention purge in the drive tick.
//
// It deletes exactly the keys that were trashed together (rows sharing a
// trashRootKey), NOT everything under a folder prefix: if someone uploads a
// new file into a folder after that folder was trashed, the new file is live
// and must survive the purge. Otherwise the steps match what
// /api/drive/delete always did:
//   1. note which keys were already backed up to the NAS and flip their
//      deletedFromCloud flags, so the NAS copy stays reachable from the
//      NAS Backup page,
//   2. delete the bytes from R2,
//   3. give raw-footage storage back to the client's quota.

import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { client as clientTable, file as fileTable, nasBackupRecord } from '@/lib/db/schema';
import { updateClientStorageAfterDelete } from '@/lib/storage-service';
import { getR2Bucket } from './r2';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function purgeTrashRoot(
  env: any,
  rootKey: string,
): Promise<{ deletedCount: number; deletedSize: number; backedUpToNasCount: number }> {
  const db = getDbHttp();
  const res = await db.execute(sql`
    SELECT "key", "size", "storageTier" FROM "DriveItem"
    WHERE "trashRootKey" = ${rootKey} AND "trashedAt" IS NOT NULL AND "removedAt" IS NULL
  `);
  const items = ((res as any).rows || []) as { key: string; size: string | number; storageTier: string }[];
  if (!items.length) throw new Error('Not in trash');

  const keys = items.map((i) => i.key);
  const fileKeys = keys.filter((k) => !k.endsWith('/'));

  // 1. NAS backup bookkeeping
  const archived = new Set<string>();
  for (const part of chunk(fileKeys, 500)) {
    const [f, r] = await Promise.all([
      db.select({ s3Key: fileTable.s3Key }).from(fileTable)
        .where(and(inArray(fileTable.s3Key, part), eq(fileTable.archivedToNas, true))),
      db.select({ s3Key: nasBackupRecord.s3Key }).from(nasBackupRecord)
        .where(and(inArray(nasBackupRecord.s3Key, part), eq(nasBackupRecord.archivedToNas, true))),
    ]);
    for (const row of f) if (row.s3Key) archived.add(row.s3Key);
    for (const row of r) archived.add(row.s3Key);
  }

  // Tombstone first — if the R2 delete below fails, the next reconcile sees
  // the bytes still exist, un-tombstones the rows (trashedAt is kept) and
  // the item simply shows up in the trash again to be purged later.
  await db.execute(sql`
    UPDATE "DriveItem" SET "removedAt" = now(), "lastEventAt" = GREATEST("lastEventAt", now()::timestamp), "updatedAt" = now()
    WHERE "trashRootKey" = ${rootKey} AND "removedAt" IS NULL
  `);

  // 2. Delete the bytes (R2 binding: up to 1000 keys per call).
  const r2Keys = items.filter((i) => i.storageTier === 'r2').map((i) => i.key);
  const bucket = getR2Bucket(env);
  for (const part of chunk(r2Keys, 1000)) await bucket.delete(part);

  const now = new Date().toISOString();
  const archivedList = [...archived];
  for (const part of chunk(archivedList, 500)) {
    await db.update(fileTable).set({ deletedFromCloud: true, deletedFromCloudAt: now }).where(inArray(fileTable.s3Key, part));
    await db.update(nasBackupRecord).set({ deletedFromCloud: true, deletedFromCloudAt: now, updatedAt: now }).where(inArray(nasBackupRecord.s3Key, part));
  }

  // 3. Raw-footage quota credit, one update per client.
  let deletedSize = 0;
  const rawByCompany = new Map<string, number>();
  for (const i of items) {
    if (i.storageTier !== 'r2' || i.key.endsWith('/')) continue;
    const size = Number(i.size || 0);
    deletedSize += size;
    if (i.key.includes('/raw-footage/')) {
      const company = i.key.split('/')[0];
      rawByCompany.set(company, (rawByCompany.get(company) || 0) + size);
    }
  }
  for (const [companyName, size] of rawByCompany) {
    if (size <= 0) continue;
    const [foundClient] = await db
      .select({ id: clientTable.id })
      .from(clientTable)
      .where(or(eq(clientTable.companyName, companyName), eq(clientTable.name, companyName)))
      .limit(1);
    if (foundClient) await updateClientStorageAfterDelete(foundClient.id, size);
  }

  return { deletedCount: fileKeys.length, deletedSize, backedUpToNasCount: archived.size };
}
