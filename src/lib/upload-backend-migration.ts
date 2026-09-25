// src/lib/upload-backend.ts
//
// Reads/writes the single Postgres row (UploadBackendConfig, id='singleton')
// backing the admin "Primary/Backup" upload switch. Backup upload system —
// see /areas/cloudflare-migration.md for the full design.
//
// Scope: this ONLY controls where new uploads for raw footage and editor
// output files get presigned to (see /api/upload/initiate). It does not
// touch the Files & Drive browser-upload feature, QC/client streaming, or
// thumbnail/HLS generation — those keep depending on the primary bucket
// regardless of this switch.

import { getDbHttp } from "@/lib/db";
import { uploadBackendConfig, file as fileTable } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export type UploadBackend = "r2" | "backup";

const SINGLETON_ID = "singleton";

async function ensureRow() {
  const db = getDbHttp();
  const [row] = await db
    .select()
    .from(uploadBackendConfig)
    .where(eq(uploadBackendConfig.id, SINGLETON_ID))
    .limit(1);

  if (row) return row;

  // First call ever (e.g. before the migration's seed INSERT ran, or in a
  // fresh env) — create it defaulting to primary so nothing surprises.
  const [created] = await db
    .insert(uploadBackendConfig)
    .values({ id: SINGLETON_ID, activeBackend: "r2" })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [row2] = await db
    .select()
    .from(uploadBackendConfig)
    .where(eq(uploadBackendConfig.id, SINGLETON_ID))
    .limit(1);
  return row2;
}

export async function getUploadBackendStatus() {
  const row = await ensureRow();
  return {
    activeBackend: (row?.activeBackend as UploadBackend) || "r2",
    switchedAt: row?.switchedAt || null,
    switchedBy: row?.switchedBy ?? null,
    migrationInProgress: !!row?.migrationInProgress,
    lastCanaryAt: row?.lastCanaryAt || null,
    lastCanaryOk: row?.lastCanaryOk ?? null,
    lastCanaryError: row?.lastCanaryError || null,
  };
}

export async function getActiveUploadBackend(): Promise<UploadBackend> {
  const row = await ensureRow();
  return (row?.activeBackend as UploadBackend) || "r2";
}

export async function setActiveUploadBackend(
  backend: UploadBackend,
  userId?: number
): Promise<void> {
  await ensureRow();
  const db = getDbHttp();
  await db
    .update(uploadBackendConfig)
    .set({
      activeBackend: backend,
      switchedAt: new Date().toISOString(),
      switchedBy: userId ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(uploadBackendConfig.id, SINGLETON_ID));
}

export async function setMigrationInProgress(inProgress: boolean): Promise<void> {
  await ensureRow();
  const db = getDbHttp();
  await db
    .update(uploadBackendConfig)
    .set({ migrationInProgress: inProgress, updatedAt: new Date().toISOString() })
    .where(eq(uploadBackendConfig.id, SINGLETON_ID));
}

export async function recordCanaryResult(ok: boolean, error?: string): Promise<void> {
  await ensureRow();
  const db = getDbHttp();
  await db
    .update(uploadBackendConfig)
    .set({
      lastCanaryAt: new Date().toISOString(),
      lastCanaryOk: ok,
      lastCanaryError: ok ? null : (error || "unknown error"),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(uploadBackendConfig.id, SINGLETON_ID));
}

// Count of File rows whose bytes are still sitting in the backup bucket,
// i.e. files uploaded while the switch was flipped to 'backup' and not yet
// migrated back. Drives the admin panel's "pending migration" counter.
export async function countFilesPendingMigration(): Promise<number> {
  const db = getDbHttp();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fileTable)
    .where(eq(fileTable.storageBackend, "backup"));
  return row?.count ?? 0;
}