// src/lib/drive/index-store.ts
//
// The Files & Drive metadata index — "the Metadata Service" from the
// Drive architecture discussion.
//
// WHY: Drive used to have no metadata layer. Opening a client listed every
// object under that client's R2 prefix on the file server, then presigned
// every file and thumbnail one by one, then cached the whole result in
// memory for 5 minutes (lost on any change or container restart). Search
// re-listed the bucket on every keystroke. This table replaces all of that
// with indexed Postgres queries.
//
// HOW IT STAYS IN SYNC — without hooking every upload path:
//   1. R2 event notifications (object-create / object-delete on
//      e8-app-r2-prod) -> Cloudflare Queue `drive-events` -> worker.ts ->
//      applyR2Events() below. Every write to the bucket produces one,
//      whoever made it: browser presigned PUTs, multipart completes, the
//      file server's moves/renames/deletes, the NAS sweep, scripts.
//   2. Queue delivery is at-least-once and unordered, so every row carries
//      `lastEventAt` and an event older than what's already applied is
//      ignored. Deletes leave a tombstone (`removedAt`) for a week so a late
//      create event can't resurrect a deleted file.
//   3. A mark-and-sweep reconcile against a full R2 listing (runs daily from
//      the drive tick, and is also the one-time backfill) fixes anything the
//      event stream missed.
//
// Paths still equal keys: moves and renames still copy bytes in R2 (a
// deliberate choice — task files, raw-footage links, NAS backups, zip jobs
// and share links all key on the R2 key). The index just follows along via
// the CopyObject/DeleteObject events those operations emit.

import { sql, type SQL } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { createId } from '@/lib/db/id';
import {
  isInternalKey,
  sourceKeyForThumbnail,
  thumbnailKeyFor,
  isFolderKey,
  nameOf,
  parentKeyOf,
  clientPrefixOf,
  escapeLike,
  mimeFromName,
  isVideoName,
  isOutputKey,
} from './keys';
import { signedFileUrl, signedThumbUrl } from './url-tokens';
import { getR2Bucket, normalizeEtag, deletePrefix, type R2BucketLike } from './r2';

type Db = ReturnType<typeof getDbHttp>;

// ─── Feature flags ───────────────────────────────────────────────────────────
// The event consumer and sync ALWAYS write the index (so it can be backfilled
// and verified before anything reads from it). These only gate the reads.

/** Drive listing + search served from Postgres instead of the file server. */
export function isDriveIndexEnabled(): boolean {
  return process.env.DRIVE_INDEX_ENABLED === 'true';
}

/** Delete = move to Trash (30-day restore). Needs the index. */
export function isDriveTrashEnabled(): boolean {
  return isDriveIndexEnabled() && process.env.DRIVE_TRASH_ENABLED !== 'false';
}

/** 720p HLS previews + scrub sprites, transcoded on the file server. Opt-in (CPU cost). */
export function isDrivePreviewsEnabled(): boolean {
  return process.env.DRIVE_PREVIEWS_ENABLED === 'true';
}

export const TRASH_RETENTION_DAYS = 30;
const TOMBSTONE_RETENTION_DAYS = 7;
const PENDING_RETENTION_DAYS = 3;
const AUTO_PREVIEW_MAX_BYTES = Number(process.env.DRIVE_PREVIEW_AUTO_MAX_BYTES || 2 * 1024 * 1024 * 1024);

/** Which new videos get a preview automatically (the rest are on-demand from the player). */
function autoPreviewStatus(key: string, size: number): 'queued' | 'none' {
  if (!isDrivePreviewsEnabled() || !isVideoName(key)) return 'none';
  // Deliverables are watched constantly — always. Raw footage only when it's
  // small enough to be cheap; big camera files are transcoded on first view.
  if (isOutputKey(key) || size <= AUTO_PREVIEW_MAX_BYTES) return 'queued';
  return 'none';
}

async function rows<T = any>(db: Db, query: SQL): Promise<T[]> {
  const res = await db.execute(query);
  return (res as any).rows as T[];
}

/**
 * Timestamp columns are `timestamp(3)` WITHOUT time zone holding UTC wall
 * time. Depending on the driver path they come back as a string
 * ("2026-09-23 10:11:12.345") or a Date — normalize both to ISO-8601 UTC.
 */
export function tsToIso(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  const str = String(value).trim();
  if (!str) return undefined;
  const hasZone = /(Z|[+-]\d{2}(:?\d{2})?)$/.test(str);
  const d = new Date(hasZone ? str.replace(' ', 'T') : `${str.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// ─── R2 events ───────────────────────────────────────────────────────────────

export interface R2EventMessage {
  account?: string;
  action: 'PutObject' | 'CopyObject' | 'CompleteMultipartUpload' | 'DeleteObject' | 'LifecycleDeletion' | string;
  bucket?: string;
  object: { key: string; size?: number; eTag?: string };
  eventTime: string;
  copySource?: { bucket?: string; object?: string };
}

const CREATE_ACTIONS = new Set(['PutObject', 'CopyObject', 'CompleteMultipartUpload']);
const DELETE_ACTIONS = new Set(['DeleteObject', 'LifecycleDeletion']);

function decodeEventKey(key: string): string {
  // R2's docs don't say whether event keys are URL-encoded. Our keys often
  // contain spaces and '&', so decode only when it's clearly encoded.
  if (!/%[0-9A-Fa-f]{2}/.test(key)) return key;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

function toTs(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Apply a batch of R2 event notifications. Idempotent and order-tolerant:
 * safe to call with duplicates, and with events arriving out of order.
 */
export async function applyR2Events(events: R2EventMessage[], env?: any): Promise<void> {
  if (events.length === 0) return;
  const db = getDbHttp();

  // Keep only the newest event per key within this batch.
  const latest = new Map<string, R2EventMessage & { key: string; ts: string }>();
  for (const ev of events) {
    if (!ev?.object?.key || !ev.action) continue;
    const key = decodeEventKey(ev.object.key);
    const ts = toTs(ev.eventTime);
    const prev = latest.get(key);
    if (!prev || prev.ts <= ts) latest.set(key, { ...ev, key, ts });
  }

  const creates: Array<R2EventMessage & { key: string; ts: string }> = [];
  const deletes: Array<{ key: string; ts: string }> = [];
  const thumbSet: Array<{ source: string; present: boolean; ts: string }> = [];

  for (const ev of latest.values()) {
    const thumbSource = sourceKeyForThumbnail(ev.key);
    if (thumbSource) {
      thumbSet.push({ source: thumbSource, present: CREATE_ACTIONS.has(ev.action), ts: ev.ts });
      continue;
    }
    if (isInternalKey(ev.key)) continue;
    if (CREATE_ACTIONS.has(ev.action)) creates.push(ev);
    else if (DELETE_ACTIONS.has(ev.action)) deletes.push({ key: ev.key, ts: ev.ts });
  }

  if (creates.length) await applyCreates(db, creates, env);
  if (deletes.length) await applyDeletes(db, deletes);
  for (const t of thumbSet) {
    await db.execute(sql`
      UPDATE "DriveItem" SET "hasThumbnail" = ${t.present}, "updatedAt" = now()
      WHERE "key" = ${t.source} AND "hasThumbnail" IS DISTINCT FROM ${t.present}
    `);
  }
}

async function applyCreates(db: Db, creates: Array<R2EventMessage & { key: string; ts: string }>, env?: any) {
  const keys = creates.map((c) => c.key);
  // Prior state — only used to decide what activity to log. Correctness of
  // the row itself is guarded inside the upsert, not by this read.
  const before = await rows<{ key: string; pending: boolean; removedAt: string | null; etag: string | null; uploadedBy: number | null }>(
    db,
    sql`SELECT "key", "pending", "removedAt", "etag", "uploadedBy" FROM "DriveItem" WHERE "key" IN (${sql.join(keys.map((k) => sql`${k}`), sql`, `)})`,
  );
  const beforeByKey = new Map(before.map((r) => [r.key, r]));

  const values = creates.map((c) => {
    const size = Number(c.object.size || 0);
    const etag = normalizeEtag(c.object.eTag);
    const folder = isFolderKey(c.key);
    const preview = folder ? 'none' : autoPreviewStatus(c.key, size);
    return sql`(
      ${c.key}, ${parentKeyOf(c.key)}, ${clientPrefixOf(c.key)}, ${nameOf(c.key)}, ${folder},
      ${size}, ${etag}, ${folder ? null : mimeFromName(c.key)}, 'r2', ${c.ts}::timestamp,
      false, ${c.ts}::timestamp, ${preview}, ${preview === 'queued' ? c.ts : null}::timestamp, now()
    )`;
  });

  // `sameBytes`: same etag as before (event redelivery, or the synthetic
  // event /api/upload/complete sends, which may not know the etag) — keep
  // the existing preview instead of starting over.
  const applied = await rows<{ key: string }>(db, sql`
    INSERT INTO "DriveItem" (
      "key", "parentKey", "clientPrefix", "name", "isFolder",
      "size", "etag", "mimeType", "storageTier", "lastModified",
      "pending", "lastEventAt", "previewStatus", "previewRequestedAt", "updatedAt"
    ) VALUES ${sql.join(values, sql`, `)}
    ON CONFLICT ("key") DO UPDATE SET
      "size" = EXCLUDED."size",
      "etag" = COALESCE(EXCLUDED."etag", "DriveItem"."etag"),
      "mimeType" = COALESCE("DriveItem"."mimeType", EXCLUDED."mimeType"),
      "storageTier" = 'r2',
      "lastModified" = EXCLUDED."lastModified",
      "pending" = false,
      "removedAt" = NULL,
      -- A fresh write to a trashed key means someone uploaded it again: it's live.
      "trashedAt" = NULL,
      "trashedBy" = NULL,
      "trashRootKey" = NULL,
      -- Same bytes (e.g. an event redelivery) keep their preview; new bytes start over.
      "previewStatus" = CASE WHEN (EXCLUDED."etag" IS NULL OR "DriveItem"."etag" IS NOT DISTINCT FROM EXCLUDED."etag") AND "DriveItem"."removedAt" IS NULL AND NOT "DriveItem"."pending"
        THEN "DriveItem"."previewStatus" ELSE EXCLUDED."previewStatus" END,
      "previewRequestedAt" = CASE WHEN (EXCLUDED."etag" IS NULL OR "DriveItem"."etag" IS NOT DISTINCT FROM EXCLUDED."etag") AND "DriveItem"."removedAt" IS NULL AND NOT "DriveItem"."pending"
        THEN "DriveItem"."previewRequestedAt" ELSE EXCLUDED."previewRequestedAt" END,
      "previewPrefix" = CASE WHEN (EXCLUDED."etag" IS NULL OR "DriveItem"."etag" IS NOT DISTINCT FROM EXCLUDED."etag") AND "DriveItem"."removedAt" IS NULL AND NOT "DriveItem"."pending"
        THEN "DriveItem"."previewPrefix" ELSE NULL END,
      "previewAttempts" = CASE WHEN (EXCLUDED."etag" IS NULL OR "DriveItem"."etag" IS NOT DISTINCT FROM EXCLUDED."etag") AND "DriveItem"."removedAt" IS NULL AND NOT "DriveItem"."pending"
        THEN "DriveItem"."previewAttempts" ELSE 0 END,
      "previewError" = CASE WHEN (EXCLUDED."etag" IS NULL OR "DriveItem"."etag" IS NOT DISTINCT FROM EXCLUDED."etag") AND "DriveItem"."removedAt" IS NULL AND NOT "DriveItem"."pending"
        THEN "DriveItem"."previewError" ELSE NULL END,
      "lastEventAt" = EXCLUDED."lastEventAt",
      "updatedAt" = now()
    WHERE "DriveItem"."lastEventAt" <= EXCLUDED."lastEventAt"
    RETURNING "key"
  `);
  const appliedKeys = new Set(applied.map((a) => a.key));

  // Copies (moves and renames are copy + delete): carry the source's
  // uploader, finished preview and thumbnail across so a move doesn't throw
  // away work.
  const copies = creates.filter((c) => c.action === 'CopyObject' && c.copySource?.object && appliedKeys.has(c.key));
  if (copies.length) {
    let bucket: R2BucketLike | null = null;
    try { bucket = getR2Bucket(env); } catch { bucket = null; }
    for (const c of copies) {
      const src = decodeEventKey(c.copySource!.object!);
      const carried = await rows<{ hasThumbnail: boolean }>(db, sql`
        UPDATE "DriveItem" d SET
          "uploadedBy" = COALESCE(d."uploadedBy", s."uploadedBy"),
          "previewStatus" = CASE WHEN s."previewStatus" = 'ready' THEN 'ready' ELSE d."previewStatus" END,
          "previewPrefix" = CASE WHEN s."previewStatus" = 'ready' THEN s."previewPrefix" ELSE d."previewPrefix" END,
          "durationSeconds" = COALESCE(d."durationSeconds", s."durationSeconds"),
          "width" = COALESCE(d."width", s."width"),
          "height" = COALESCE(d."height", s."height"),
          "updatedAt" = now()
        FROM "DriveItem" s
        WHERE d."key" = ${c.key} AND s."key" = ${src} AND s."etag" IS NOT DISTINCT FROM d."etag"
        RETURNING s."hasThumbnail"
      `);
      if (carried[0]?.hasThumbnail && bucket) {
        try {
          const thumb = await bucket.get(thumbnailKeyFor(src));
          if (thumb) {
            await bucket.put(thumbnailKeyFor(c.key), await thumb.arrayBuffer(), {
              httpMetadata: { contentType: 'image/jpeg' },
            });
          }
        } catch (err: any) {
          console.warn(`[drive-index] thumbnail carry-over failed ${src} -> ${c.key}:`, err?.message);
        }
      }
    }
  }

  // Activity: new uploads and replacements. Moves/renames/trash are logged
  // by the routes that perform them (they know who did it).
  const activity: DriveActivityInput[] = [];
  for (const c of creates) {
    if (isFolderKey(c.key) || c.action === 'CopyObject' || !appliedKeys.has(c.key)) continue;
    const prev = beforeByKey.get(c.key);
    const etag = normalizeEtag(c.object.eTag);
    if (!prev || prev.pending || prev.removedAt) {
      activity.push({ key: c.key, action: 'uploaded', userId: prev?.uploadedBy ?? null, details: { size: c.object.size ?? null } });
    } else if (prev.etag && etag && prev.etag !== etag) {
      activity.push({ key: c.key, action: 'replaced', userId: prev.uploadedBy ?? null, details: { size: c.object.size ?? null } });
    }
  }
  if (activity.length) await logDriveActivity(activity, db);
}

async function applyDeletes(db: Db, deletes: Array<{ key: string; ts: string }>) {
  const keys = deletes.map((d) => d.key);
  const keyList = sql.join(keys.map((k) => sql`${k}`), sql`, `);
  // Archived to the NAS = still part of the Drive, just in cold storage.
  const archived = await rows<{ s3Key: string; size: number | null }>(db, sql`
    SELECT "s3Key", "size"::bigint AS "size" FROM "File" WHERE "s3Key" IN (${keyList}) AND "archivedToNas" = true
    UNION
    SELECT "s3Key", "fileSize" AS "size" FROM "NasBackupRecord" WHERE "s3Key" IN (${keyList}) AND "archivedToNas" = true
  `);
  const archivedSize = new Map(archived.map((a) => [a.s3Key, Number(a.size || 0)]));

  for (const d of deletes) {
    if (archivedSize.has(d.key)) {
      await db.execute(sql`
        INSERT INTO "DriveItem" ("key", "parentKey", "clientPrefix", "name", "isFolder", "size", "mimeType", "storageTier", "lastModified", "lastEventAt", "updatedAt")
        VALUES (${d.key}, ${parentKeyOf(d.key)}, ${clientPrefixOf(d.key)}, ${nameOf(d.key)}, ${isFolderKey(d.key)},
                ${archivedSize.get(d.key) || 0}, ${mimeFromName(d.key)}, 'nas', ${d.ts}::timestamp, ${d.ts}::timestamp, now())
        ON CONFLICT ("key") DO UPDATE SET "storageTier" = 'nas', "lastEventAt" = EXCLUDED."lastEventAt", "updatedAt" = now()
        WHERE "DriveItem"."lastEventAt" <= EXCLUDED."lastEventAt" AND "DriveItem"."removedAt" IS NULL
      `);
    } else {
      // Tombstone — insert one even for keys we've never seen, so a late
      // create event for the same key is recognized as stale.
      await db.execute(sql`
        INSERT INTO "DriveItem" ("key", "parentKey", "clientPrefix", "name", "isFolder", "removedAt", "lastEventAt", "updatedAt")
        VALUES (${d.key}, ${parentKeyOf(d.key)}, ${clientPrefixOf(d.key)}, ${nameOf(d.key)}, ${isFolderKey(d.key)},
                ${d.ts}::timestamp, ${d.ts}::timestamp, now())
        ON CONFLICT ("key") DO UPDATE SET "removedAt" = EXCLUDED."removedAt", "lastEventAt" = EXCLUDED."lastEventAt", "updatedAt" = now()
        WHERE "DriveItem"."lastEventAt" <= EXCLUDED."lastEventAt" AND "DriveItem"."removedAt" IS NULL
      `);
    }
  }
}

/**
 * Called when an upload is presigned — before any bytes move — so the
 * index knows who uploaded it (R2 events don't carry a user). Stays hidden
 * (`pending`) until the real create event arrives.
 */
export async function recordPendingUpload(key: string, userId: number | null, mimeType?: string | null): Promise<void> {
  if (!key || isInternalKey(key)) return;
  try {
    const db = getDbHttp();
    await db.execute(sql`
      INSERT INTO "DriveItem" ("key", "parentKey", "clientPrefix", "name", "isFolder", "mimeType", "uploadedBy", "pending", "lastEventAt", "updatedAt")
      VALUES (${key}, ${parentKeyOf(key)}, ${clientPrefixOf(key)}, ${nameOf(key)}, ${isFolderKey(key)},
              ${mimeType && mimeType !== 'application/octet-stream' ? mimeType : mimeFromName(key)}, ${userId}, true,
              '1970-01-01T00:00:00Z'::timestamp, now())
      ON CONFLICT ("key") DO UPDATE SET
        "uploadedBy" = COALESCE(EXCLUDED."uploadedBy", "DriveItem"."uploadedBy"),
        "mimeType" = COALESCE(EXCLUDED."mimeType", "DriveItem"."mimeType")
    `);
  } catch (err: any) {
    // Never let index bookkeeping fail an upload.
    console.warn('[drive-index] recordPendingUpload failed:', err?.message);
  }
}

// ─── Folder tree (same JSON shape the file server's /structure returned) ────

export interface DriveTreeNode {
  name: string;
  type: 'folder' | 'file';
  path: string;
  s3Key?: string;
  children?: DriveTreeNode[];
  size?: number;
  url?: string;
  thumbnailUrl?: string | null;
  lastModified?: string;
  mimeType?: string | null;
  storageTier?: 'r2' | 'nas';
  previewStatus?: string;
  starred?: boolean;
}

const MONTH_ORDER: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function monthSortValue(name: string): number | null {
  const m = name.match(/^([A-Za-z]+)-(\d{4})$/);
  if (!m) return null;
  const idx = MONTH_ORDER[m[1].toLowerCase()];
  return idx === undefined ? null : parseInt(m[2], 10) * 12 + idx;
}

function leadingNumber(name: string): number | null {
  const m = name.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Identical ordering to e8-file-server/src/tree.js so nothing jumps around.
function sortChildren(folder: DriveTreeNode) {
  if (!folder.children?.length) return;
  folder.children.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    const am = monthSortValue(a.name);
    const bm = monthSortValue(b.name);
    if (am !== null && bm !== null) return am - bm;
    const an = leadingNumber(a.name);
    const bn = leadingNumber(b.name);
    if (an !== null && bn !== null) return an - bn;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
  for (const c of folder.children) if (c.type === 'folder') sortChildren(c);
}

interface TreeRow {
  key: string;
  size: string | number;
  lastModified: string | null;
  storageTier: 'r2' | 'nas';
  hasThumbnail: boolean;
  previewStatus: string;
  mimeType: string | null;
  mediaPreviewKey: string | null;
}

/**
 * The whole tree under `prefix` (one client), from Postgres. One indexed
 * query plus one HMAC per URL — no R2 listing, no presigning.
 *
 * Differences from the old tree, on purpose:
 *  - folder `s3Key` is always the folder's own prefix ("Acme/outputs/May-2026/").
 *    The old builder set an implicit folder's s3Key to whichever FILE happened
 *    to be listed first inside it, which broke download/delete/move/share
 *    for folders that were never created with an explicit marker object.
 *  - files archived to the NAS are listed (storageTier 'nas') instead of
 *    vanishing; downloads already fall back to the NAS for those.
 *  - thumbnails include ready MediaPreview images, so the browser no longer
 *    has to batch-fetch /api/media-previews after every load.
 */
export async function buildTreeFromIndex(prefix: string, userId: number): Promise<DriveTreeNode & { _source: 'index' }> {
  const db = getDbHttp();
  const pattern = `${escapeLike(prefix)}%`;

  const [items, stars] = await Promise.all([
    rows<TreeRow>(db, sql`
      SELECT d."key", d."size", d."lastModified", d."storageTier", d."hasThumbnail", d."previewStatus", d."mimeType",
             mp."previewS3Key" AS "mediaPreviewKey"
      FROM "DriveItem" d
      LEFT JOIN "MediaPreview" mp ON mp."s3Key" = d."key" AND mp."status" = 'READY' AND d."hasThumbnail" = false
      WHERE d."key" LIKE ${pattern} AND d."removedAt" IS NULL AND d."trashedAt" IS NULL AND d."pending" = false
    `),
    rows<{ key: string }>(db, sql`SELECT "key" FROM "DriveStar" WHERE "userId" = ${userId} AND "key" LIKE ${pattern}`),
  ]);
  const starred = new Set(stars.map((s) => s.key));

  items.sort((a, b) => a.key.localeCompare(b.key));

  const root: DriveTreeNode = {
    name: prefix ? prefix.replace(/\/$/, '').split('/').pop() || 'Root' : 'Root',
    type: 'folder',
    path: '/',
    children: [],
  };
  const folderMap = new Map<string, DriveTreeNode>([['/', root]]);
  const fileNodes: Array<{ node: DriveTreeNode; row: TreeRow }> = [];

  for (const row of items) {
    const relativePath = prefix ? row.key.slice(prefix.length) : row.key;
    if (!relativePath) continue;
    const parts = relativePath.split('/').filter(Boolean);
    let currentPath = '/';
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;

      if (isLast && !row.key.endsWith('/')) {
        const node: DriveTreeNode = {
          name: part,
          type: 'file',
          path: fullPath,
          s3Key: row.key,
          size: Number(row.size || 0),
          lastModified: tsToIso(row.lastModified),
          mimeType: row.mimeType,
          storageTier: row.storageTier,
          previewStatus: row.previewStatus !== 'none' ? row.previewStatus : undefined,
          starred: starred.has(row.key) || undefined,
        };
        current.children!.push(node);
        fileNodes.push({ node, row });
      } else {
        let folder = folderMap.get(fullPath);
        if (!folder) {
          const folderKey = `${prefix}${parts.slice(0, i + 1).join('/')}/`;
          folder = {
            name: part,
            type: 'folder',
            path: fullPath,
            s3Key: folderKey,
            children: [],
            starred: starred.has(folderKey) || undefined,
          };
          current.children!.push(folder);
          folderMap.set(fullPath, folder);
        }
        current = folder;
        currentPath = fullPath;
      }
    }
  }

  await Promise.all(
    fileNodes.map(async ({ node, row }) => {
      node.url = await signedFileUrl(row.key);
      if (row.hasThumbnail) node.thumbnailUrl = await signedThumbUrl(thumbnailKeyFor(row.key));
      else if (row.mediaPreviewKey) node.thumbnailUrl = await signedThumbUrl(row.mediaPreviewKey);
    }),
  );

  sortChildren(root);
  return { ...root, _source: 'index' };
}

/** How many live rows exist under a prefix — used to decide if the index is trustworthy for it yet. */
export async function countIndexed(prefix: string): Promise<number> {
  const db = getDbHttp();
  const r = await rows<{ n: string }>(db, sql`
    SELECT count(*)::text AS n FROM "DriveItem"
    WHERE "key" LIKE ${`${escapeLike(prefix)}%`} AND "removedAt" IS NULL AND "pending" = false
  `);
  return Number(r[0]?.n || 0);
}

// ─── Scope helper for flat listings (search, recent, starred, trash) ────────

function scopeCondition(column: SQL, allowedPrefixes: string[] | null, prefix?: string): SQL | null {
  const conds: SQL[] = [];
  if (prefix) conds.push(sql`${column} LIKE ${`${escapeLike(prefix)}%`}`);
  if (allowedPrefixes !== null) {
    if (allowedPrefixes.length === 0) return null; // no access at all
    conds.push(sql`(${sql.join(allowedPrefixes.map((p) => sql`${column} LIKE ${`${escapeLike(p)}%`}`), sql` OR `)})`);
  }
  return conds.length ? sql.join(conds, sql` AND `) : sql`TRUE`;
}

export interface FlatDriveItem {
  name: string;
  type: 'file' | 'folder';
  s3Key: string;
  clientPrefix: string;
  folderPath: string;
  breadcrumbParts: string[];
  path: string;
  size?: number;
  lastModified?: string;
  url?: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  storageTier?: string;
  previewStatus?: string;
  starred?: boolean;
  uploadedBy?: number | null;
  uploadedByName?: string | null;
}

async function toFlat(r: any, relativeTo?: string): Promise<FlatDriveItem> {
  const key: string = r.key;
  const folder = key.endsWith('/');
  const pathParts = key.replace(/\/$/, '').split('/').filter(Boolean);
  const name = pathParts.pop() || key;
  // Relative to the client currently open, so the UI can walk its tree.
  const rel = relativeTo && key.startsWith(relativeTo)
    ? key.slice(relativeTo.length).replace(/\/$/, '').split('/').filter(Boolean).slice(0, -1)
    : pathParts;
  const item: FlatDriveItem = {
    name,
    type: folder ? 'folder' : 'file',
    s3Key: key,
    clientPrefix: clientPrefixOf(key),
    folderPath: pathParts.join('/'),
    breadcrumbParts: rel,
    path: `/${[...pathParts, name].join('/')}`,
    size: r.size != null ? Number(r.size) : undefined,
    lastModified: tsToIso(r.lastModified),
    mimeType: r.mimeType ?? null,
    storageTier: r.storageTier,
    previewStatus: r.previewStatus && r.previewStatus !== 'none' ? r.previewStatus : undefined,
    starred: r.starred || undefined,
    uploadedBy: r.uploadedBy ?? null,
    uploadedByName: r.uploadedByName ?? null,
  };
  if (!folder) {
    item.url = await signedFileUrl(key);
    if (r.hasThumbnail) item.thumbnailUrl = await signedThumbUrl(thumbnailKeyFor(key));
    else if (r.mediaPreviewKey) item.thumbnailUrl = await signedThumbUrl(r.mediaPreviewKey);
  }
  return item;
}

const FLAT_SELECT = sql`
  d."key", d."size", d."lastModified", d."storageTier", d."hasThumbnail", d."previewStatus", d."mimeType", d."uploadedBy",
  u."name" AS "uploadedByName", mp."previewS3Key" AS "mediaPreviewKey"
`;
const FLAT_JOINS = sql`
  LEFT JOIN "User" u ON u."id" = d."uploadedBy"
  LEFT JOIN "MediaPreview" mp ON mp."s3Key" = d."key" AND mp."status" = 'READY' AND d."hasThumbnail" = false
`;

/** Search-as-you-type: file names first, then anything whose path matches. */
export async function searchIndex(opts: {
  query: string;
  allowedPrefixes: string[] | null;
  prefix?: string;
  userId: number;
  max?: number;
}): Promise<FlatDriveItem[]> {
  const cond = scopeCondition(sql`d."key"`, opts.allowedPrefixes, opts.prefix);
  if (!cond) return [];
  const q = opts.query.trim();
  const like = `%${escapeLike(q)}%`;
  const db = getDbHttp();
  const result = await rows(db, sql`
    SELECT ${FLAT_SELECT}, (s."userId" IS NOT NULL) AS "starred"
    FROM "DriveItem" d
    ${FLAT_JOINS}
    LEFT JOIN "DriveStar" s ON s."key" = d."key" AND s."userId" = ${opts.userId}
    WHERE d."removedAt" IS NULL AND d."trashedAt" IS NULL AND d."pending" = false AND d."isFolder" = false
      AND (d."name" ILIKE ${like} OR d."key" ILIKE ${like})
      AND ${cond}
    ORDER BY (lower(d."name") = lower(${q})) DESC,
             (d."name" ILIKE ${`${escapeLike(q)}%`}) DESC,
             (d."name" ILIKE ${like}) DESC,
             d."lastModified" DESC NULLS LAST
    LIMIT ${Math.min(Math.max(opts.max || 50, 1), 100)}
  `);
  return Promise.all(result.map((r) => toFlat(r, opts.prefix)));
}

/** Most recently added/changed files in scope — the "Recent" view. */
export async function listRecent(opts: { allowedPrefixes: string[] | null; prefix?: string; userId: number; limit?: number }): Promise<FlatDriveItem[]> {
  const cond = scopeCondition(sql`d."key"`, opts.allowedPrefixes, opts.prefix);
  if (!cond) return [];
  const db = getDbHttp();
  const result = await rows(db, sql`
    SELECT ${FLAT_SELECT}, (s."userId" IS NOT NULL) AS "starred"
    FROM "DriveItem" d
    ${FLAT_JOINS}
    LEFT JOIN "DriveStar" s ON s."key" = d."key" AND s."userId" = ${opts.userId}
    WHERE d."removedAt" IS NULL AND d."trashedAt" IS NULL AND d."pending" = false AND d."isFolder" = false
      AND ${cond}
    ORDER BY d."lastModified" DESC NULLS LAST
    LIMIT ${Math.min(opts.limit || 100, 200)}
  `);
  return Promise.all(result.map((r) => toFlat(r, opts.prefix)));
}

/** The user's starred files and folders that still exist and are in scope. */
export async function listStarred(opts: { allowedPrefixes: string[] | null; prefix?: string; userId: number }): Promise<FlatDriveItem[]> {
  const cond = scopeCondition(sql`s."key"`, opts.allowedPrefixes, opts.prefix);
  if (!cond) return [];
  const db = getDbHttp();
  const result = await rows(db, sql`
    SELECT s."key", d."size", d."lastModified", d."storageTier", d."hasThumbnail", d."previewStatus", d."mimeType", d."uploadedBy",
           u."name" AS "uploadedByName", mp."previewS3Key" AS "mediaPreviewKey", true AS "starred",
           d."key" IS NOT NULL AS "hasRow"
    FROM "DriveStar" s
    LEFT JOIN "DriveItem" d ON d."key" = s."key"
    LEFT JOIN "User" u ON u."id" = d."uploadedBy"
    LEFT JOIN "MediaPreview" mp ON mp."s3Key" = s."key" AND mp."status" = 'READY'
    WHERE s."userId" = ${opts.userId} AND ${cond}
      AND (
        (d."key" IS NOT NULL AND d."removedAt" IS NULL AND d."trashedAt" IS NULL)
        -- Implicit folders have no row of their own; keep the star if anything still lives under it.
        OR (d."key" IS NULL AND right(s."key", 1) = '/' AND EXISTS (
          SELECT 1 FROM "DriveItem" c WHERE c."key" LIKE (replace(replace(replace(s."key", '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%')
            AND c."removedAt" IS NULL AND c."trashedAt" IS NULL
        ))
      )
    ORDER BY s."createdAt" DESC
    LIMIT 500
  `);
  return Promise.all(result.map((r) => toFlat(r, opts.prefix)));
}

export async function setStar(userId: number, key: string, starred: boolean): Promise<void> {
  const db = getDbHttp();
  if (starred) {
    await db.execute(sql`INSERT INTO "DriveStar" ("userId", "key") VALUES (${userId}, ${key}) ON CONFLICT DO NOTHING`);
  } else {
    await db.execute(sql`DELETE FROM "DriveStar" WHERE "userId" = ${userId} AND "key" = ${key}`);
  }
}

/** Keep stars pointing at the right place after a move/rename (paths = keys, so the key changes). */
export async function rewriteStarsForMove(oldKey: string, newKey: string, isFolder: boolean): Promise<void> {
  const db = getDbHttp();
  if (!isFolder) {
    await db.execute(sql`
      UPDATE "DriveStar" SET "key" = ${newKey} WHERE "key" = ${oldKey}
        AND NOT EXISTS (SELECT 1 FROM "DriveStar" x WHERE x."userId" = "DriveStar"."userId" AND x."key" = ${newKey})
    `);
    return;
  }
  const oldP = oldKey.endsWith('/') ? oldKey : `${oldKey}/`;
  const newP = newKey.endsWith('/') ? newKey : `${newKey}/`;
  await db.execute(sql`
    UPDATE "DriveStar" SET "key" = ${newP} || substr("key", ${oldP.length + 1})
    WHERE "key" LIKE ${`${escapeLike(oldP)}%`}
      AND NOT EXISTS (
        SELECT 1 FROM "DriveStar" x WHERE x."userId" = "DriveStar"."userId" AND x."key" = ${newP} || substr("DriveStar"."key", ${oldP.length + 1})
      )
  `);
}

// ─── Trash ───────────────────────────────────────────────────────────────────

/**
 * Soft-delete. Bytes stay in R2 for TRASH_RETENTION_DAYS so a restore is
 * instant; the drive tick purges for real afterwards. Returns rows affected
 * (0 = the index doesn't know this item — caller should fall back).
 */
export async function trashItem(key: string, isFolder: boolean, userId: number): Promise<number> {
  const db = getDbHttp();
  if (isFolder) {
    const root = key.endsWith('/') ? key : `${key}/`;
    const r = await rows(db, sql`
      UPDATE "DriveItem" SET "trashedAt" = now(), "trashedBy" = ${userId}, "trashRootKey" = ${root}, "updatedAt" = now()
      WHERE "key" LIKE ${`${escapeLike(root)}%`} AND "removedAt" IS NULL AND "trashedAt" IS NULL AND "pending" = false
      RETURNING "key"
    `);
    return r.length;
  }
  const r = await rows(db, sql`
    UPDATE "DriveItem" SET "trashedAt" = now(), "trashedBy" = ${userId}, "trashRootKey" = ${key}, "updatedAt" = now()
    WHERE "key" = ${key} AND "removedAt" IS NULL AND "trashedAt" IS NULL
    RETURNING "key"
  `);
  return r.length;
}

export async function restoreTrashRoots(rootKeys: string[]): Promise<number> {
  if (!rootKeys.length) return 0;
  const db = getDbHttp();
  const r = await rows(db, sql`
    UPDATE "DriveItem" SET "trashedAt" = NULL, "trashedBy" = NULL, "trashRootKey" = NULL, "updatedAt" = now()
    WHERE "trashRootKey" IN (${sql.join(rootKeys.map((k) => sql`${k}`), sql`, `)}) AND "removedAt" IS NULL
    RETURNING "key"
  `);
  return r.length;
}

export interface TrashEntry {
  rootKey: string;
  name: string;
  type: 'file' | 'folder';
  itemCount: number;
  totalSize: number;
  trashedAt: string;
  trashedBy: number | null;
  trashedByName: string | null;
  purgeAt: string;
  thumbnailUrl?: string | null;
}

export async function listTrash(opts: { allowedPrefixes: string[] | null; prefix?: string }): Promise<TrashEntry[]> {
  const cond = scopeCondition(sql`d."trashRootKey"`, opts.allowedPrefixes, opts.prefix);
  if (!cond) return [];
  const db = getDbHttp();
  const result = await rows(db, sql`
    SELECT d."trashRootKey" AS "rootKey",
           count(*) FILTER (WHERE NOT d."isFolder")::int AS "itemCount",
           coalesce(sum(d."size"), 0)::bigint AS "totalSize",
           min(d."trashedAt") AS "trashedAt",
           min(d."trashedBy") AS "trashedBy",
           bool_or(d."hasThumbnail" AND d."key" = d."trashRootKey") AS "hasThumbnail"
    FROM "DriveItem" d
    WHERE d."trashedAt" IS NOT NULL AND d."removedAt" IS NULL AND ${cond}
    GROUP BY d."trashRootKey"
    ORDER BY min(d."trashedAt") DESC
    LIMIT 500
  `);
  const userIds = [...new Set(result.map((r) => r.trashedBy).filter((v): v is number => v != null))];
  const names = new Map<number, string>();
  if (userIds.length) {
    const us = await rows<{ id: number; name: string }>(db, sql`SELECT "id", "name" FROM "User" WHERE "id" IN (${sql.join(userIds.map((u) => sql`${u}`), sql`, `)})`);
    for (const u of us) names.set(u.id, u.name);
  }
  return Promise.all(result.map(async (r) => {
    const trashedAt = new Date(tsToIso(r.trashedAt) || Date.now());
    const isFolder = String(r.rootKey).endsWith('/');
    return {
      rootKey: r.rootKey,
      name: nameOf(r.rootKey),
      type: isFolder ? 'folder' : 'file',
      itemCount: r.itemCount,
      totalSize: Number(r.totalSize || 0),
      trashedAt: trashedAt.toISOString(),
      trashedBy: r.trashedBy,
      trashedByName: r.trashedBy != null ? names.get(r.trashedBy) || null : null,
      purgeAt: new Date(trashedAt.getTime() + TRASH_RETENTION_DAYS * 86400_000).toISOString(),
      thumbnailUrl: !isFolder && r.hasThumbnail ? await signedThumbUrl(thumbnailKeyFor(r.rootKey)) : null,
    } as TrashEntry;
  }));
}

/** Trash roots whose retention has run out, oldest first. */
export async function expiredTrashRoots(limit = 20): Promise<string[]> {
  const db = getDbHttp();
  const r = await rows<{ rootKey: string }>(db, sql`
    SELECT "trashRootKey" AS "rootKey" FROM "DriveItem"
    WHERE "trashedAt" IS NOT NULL AND "removedAt" IS NULL
    GROUP BY "trashRootKey"
    HAVING min("trashedAt") < now() - (${TRASH_RETENTION_DAYS} || ' days')::interval
    ORDER BY min("trashedAt") ASC
    LIMIT ${limit}
  `);
  return r.map((x) => x.rootKey);
}

/** Tombstone everything under a trash root, right before its bytes are deleted for good. */
export async function markTrashRootRemoved(rootKey: string): Promise<void> {
  const db = getDbHttp();
  await db.execute(sql`
    UPDATE "DriveItem" SET "removedAt" = now(), "lastEventAt" = GREATEST("lastEventAt", now()::timestamp), "updatedAt" = now()
    WHERE "trashRootKey" = ${rootKey} AND "removedAt" IS NULL
  `);
}

/** Keys currently trashed under a folder prefix (excluded from zip downloads). */
export async function trashedKeysUnder(prefix: string, limit = 5000): Promise<string[]> {
  const db = getDbHttp();
  const r = await rows<{ key: string }>(db, sql`
    SELECT "key" FROM "DriveItem"
    WHERE "key" LIKE ${`${escapeLike(prefix)}%`} AND "trashedAt" IS NOT NULL AND "removedAt" IS NULL AND "isFolder" = false
    LIMIT ${limit}
  `);
  return r.map((x) => x.key);
}

/** Is this exact key (or folder root) currently in the trash? */
export async function trashRootOf(key: string): Promise<string | null> {
  const db = getDbHttp();
  const r = await rows<{ trashRootKey: string | null }>(db, sql`SELECT "trashRootKey" FROM "DriveItem" WHERE "key" = ${key} LIMIT 1`);
  return r[0]?.trashRootKey ?? null;
}

// ─── Activity ────────────────────────────────────────────────────────────────

export interface DriveActivityInput {
  key: string;
  action: 'uploaded' | 'replaced' | 'moved' | 'renamed' | 'trashed' | 'restored' | 'deleted' | 'folder_created' | 'downloaded' | 'shared' | string;
  userId?: number | null;
  details?: Record<string, unknown> | null;
}

export async function logDriveActivity(entries: DriveActivityInput[], dbArg?: Db): Promise<void> {
  if (!entries.length) return;
  try {
    const db = dbArg || getDbHttp();
    const values = entries.map((e) => sql`(
      ${createId()}, ${e.key}, ${clientPrefixOf(e.key)}, ${e.action}, ${e.userId ?? null},
      ${e.details ? JSON.stringify(e.details) : null}::jsonb, now()
    )`);
    await db.execute(sql`
      INSERT INTO "DriveActivity" ("id", "key", "clientPrefix", "action", "userId", "details", "createdAt")
      VALUES ${sql.join(values, sql`, `)}
    `);
  } catch (err: any) {
    console.warn('[drive-index] activity log failed:', err?.message);
  }
}

export async function listActivity(key: string, limit = 50) {
  const db = getDbHttp();
  const isFolder = key.endsWith('/');
  const r = await rows(db, sql`
    SELECT a."id", a."key", a."action", a."details", a."createdAt", a."userId", u."name" AS "userName"
    FROM "DriveActivity" a
    LEFT JOIN "User" u ON u."id" = a."userId"
    WHERE ${isFolder ? sql`a."key" LIKE ${`${escapeLike(key)}%`}` : sql`a."key" = ${key}`}
    ORDER BY a."createdAt" DESC
    LIMIT ${Math.min(limit, 200)}
  `);
  return r.map((a) => ({
    ...a,
    name: nameOf(a.key),
    createdAt: tsToIso(a.createdAt),
  }));
}

/** Details panel for one item: uploader, dates, preview state. */
export async function getItemDetails(key: string) {
  const db = getDbHttp();
  const r = await rows(db, sql`
    SELECT d.*, u."name" AS "uploadedByName"
    FROM "DriveItem" d LEFT JOIN "User" u ON u."id" = d."uploadedBy"
    WHERE d."key" = ${key} LIMIT 1
  `);
  return r[0] || null;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export async function storageByClient(allowedPrefixes: string[] | null) {
  const cond = scopeCondition(sql`"key"`, allowedPrefixes);
  if (!cond) return [];
  const db = getDbHttp();
  const r = await rows(db, sql`
    SELECT "clientPrefix",
           count(*) FILTER (WHERE NOT "isFolder")::int AS "fileCount",
           coalesce(sum("size") FILTER (WHERE "storageTier" = 'r2' AND "trashedAt" IS NULL), 0)::bigint AS "hotBytes",
           coalesce(sum("size") FILTER (WHERE "storageTier" = 'nas'), 0)::bigint AS "archivedBytes",
           coalesce(sum("size") FILTER (WHERE "trashedAt" IS NOT NULL), 0)::bigint AS "trashBytes",
           coalesce(sum("size") FILTER (WHERE "storageTier" = 'r2' AND "key" LIKE '%/raw-footage/%'), 0)::bigint AS "rawFootageBytes",
           coalesce(sum("size") FILTER (WHERE "storageTier" = 'r2' AND "key" LIKE '%/outputs/%'), 0)::bigint AS "outputBytes"
    FROM "DriveItem"
    WHERE "removedAt" IS NULL AND "pending" = false AND "clientPrefix" <> '' AND ${cond}
    GROUP BY "clientPrefix"
    ORDER BY 3 DESC
  `);
  return r.map((x) => ({
    client: String(x.clientPrefix).replace(/\/$/, ''),
    clientPrefix: x.clientPrefix,
    fileCount: x.fileCount,
    hotBytes: Number(x.hotBytes),
    archivedBytes: Number(x.archivedBytes),
    trashBytes: Number(x.trashBytes),
    rawFootageBytes: Number(x.rawFootageBytes),
    outputBytes: Number(x.outputBytes),
  }));
}

// ─── Reconcile / backfill (mark and sweep against a full R2 listing) ────────

interface SyncCursor {
  phase: 'objects' | 'thumbs' | 'nas' | 'sweep';
  cursor?: string;
}

export interface SyncRun {
  id: string;
  prefix: string;
  status: 'running' | 'done' | 'failed';
  cursor: string | null;
  startedAt: string;
  finishedAt: string | null;
  listedCount: number;
  tombstonedCount: number;
  triggeredBy: string | null;
  error: string | null;
}

export async function getLatestSyncRun(): Promise<SyncRun | null> {
  const db = getDbHttp();
  const r = await rows<SyncRun>(db, sql`SELECT * FROM "DriveSyncRun" ORDER BY "startedAt" DESC LIMIT 1`);
  return r[0] || null;
}

/** Start a reconcile run (or return the one already running). */
export async function startIndexSync(prefix = '', triggeredBy = 'system'): Promise<SyncRun> {
  const db = getDbHttp();
  const running = await rows<SyncRun>(db, sql`SELECT * FROM "DriveSyncRun" WHERE "status" = 'running' ORDER BY "startedAt" DESC LIMIT 1`);
  if (running[0]) return running[0];
  const id = createId();
  const created = await rows<SyncRun>(db, sql`
    INSERT INTO "DriveSyncRun" ("id", "prefix", "status", "cursor", "triggeredBy")
    VALUES (${id}, ${prefix}, 'running', ${JSON.stringify({ phase: 'objects' } satisfies SyncCursor)}, ${triggeredBy})
    RETURNING *
  `);
  return created[0];
}

async function upsertListedPage(db: Db, runId: string, objs: Array<{ key: string; size: number; etag: string | null; uploaded: string }>, listedAt: string) {
  if (!objs.length) return;
  const values = objs.map((o) => {
    const folder = isFolderKey(o.key);
    return sql`(
      ${o.key}, ${parentKeyOf(o.key)}, ${clientPrefixOf(o.key)}, ${nameOf(o.key)}, ${folder},
      ${o.size}, ${o.etag}, ${folder ? null : mimeFromName(o.key)}, 'r2', ${o.uploaded}::timestamp,
      false, ${listedAt}::timestamp, ${runId}, now()
    )`;
  });
  await db.execute(sql`
    INSERT INTO "DriveItem" (
      "key", "parentKey", "clientPrefix", "name", "isFolder",
      "size", "etag", "mimeType", "storageTier", "lastModified",
      "pending", "lastEventAt", "lastSeenRunId", "updatedAt"
    ) VALUES ${sql.join(values, sql`, `)}
    ON CONFLICT ("key") DO UPDATE SET
      "size" = EXCLUDED."size",
      "etag" = EXCLUDED."etag",
      "mimeType" = COALESCE("DriveItem"."mimeType", EXCLUDED."mimeType"),
      "storageTier" = 'r2',
      "lastModified" = EXCLUDED."lastModified",
      "pending" = false,
      "removedAt" = NULL,
      -- NOTE: trashedAt is deliberately untouched — trashed files still exist in R2.
      -- 'upload:…' etags are placeholders from /api/upload/complete (real etag unknown) — not a change.
      "previewStatus" = CASE WHEN "DriveItem"."etag" IS NULL OR "DriveItem"."etag" LIKE 'upload:%' OR "DriveItem"."etag" = EXCLUDED."etag"
        THEN "DriveItem"."previewStatus" ELSE 'none' END,
      "previewPrefix" = CASE WHEN "DriveItem"."etag" IS NULL OR "DriveItem"."etag" LIKE 'upload:%' OR "DriveItem"."etag" = EXCLUDED."etag"
        THEN "DriveItem"."previewPrefix" ELSE NULL END,
      "lastSeenRunId" = EXCLUDED."lastSeenRunId",
      "lastEventAt" = GREATEST("DriveItem"."lastEventAt", EXCLUDED."lastEventAt"),
      "updatedAt" = CASE WHEN "DriveItem"."etag" IS DISTINCT FROM EXCLUDED."etag" OR "DriveItem"."removedAt" IS NOT NULL
          OR "DriveItem"."pending" OR "DriveItem"."storageTier" <> 'r2' OR "DriveItem"."size" <> EXCLUDED."size"
        THEN now() ELSE "DriveItem"."updatedAt" END
    WHERE "DriveItem"."lastEventAt" <= EXCLUDED."lastEventAt"
  `);
}

async function markThumbnails(db: Db, sources: string[]) {
  if (!sources.length) return;
  await db.execute(sql`
    UPDATE "DriveItem" SET "hasThumbnail" = true, "updatedAt" = now()
    WHERE "hasThumbnail" = false AND "key" IN (${sql.join(sources.map((k) => sql`${k}`), sql`, `)})
  `);
}

/**
 * Advance the running reconcile by up to `budgetMs`. Resumable: progress
 * lives in DriveSyncRun.cursor, so the every-minute drive tick just keeps
 * calling this until it reports done.
 */
// Hard ceiling on objects listed in a single invocation, independent of
// budgetMs. R2 list() latency varies a lot (cold vs. warm, prefix size), so
// a wall-clock budget alone doesn't bound memory: a fast run can accumulate
// far more per-page arrays / SQL text than a slow one in the same window.
// This is what actually caps this tick's contribution to the Worker
// isolate's shared memory ceiling — the isolate serves other concurrent
// requests (uploads, page loads, video streaming) on the same heap, so an
// unbounded tick here can OOM-kill all of them, not just itself.
const MAX_OBJECTS_PER_TICK = 4_000;

export async function continueIndexSync(env: any, budgetMs = 40_000): Promise<SyncRun | null> {
  const db = getDbHttp();
  const found = await rows<SyncRun>(db, sql`SELECT * FROM "DriveSyncRun" WHERE "status" = 'running' ORDER BY "startedAt" DESC LIMIT 1`);
  const run = found[0];
  if (!run) return null;

  const deadline = Date.now() + budgetMs;
  const bucket = getR2Bucket(env);
  let state: SyncCursor = run.cursor ? JSON.parse(run.cursor) : { phase: 'objects' };
  let listed = run.listedCount;
  let listedThisTick = 0;
  const prefix = run.prefix || '';
  const pattern = `${escapeLike(prefix)}%`;

  try {
    while (Date.now() < deadline && listedThisTick < MAX_OBJECTS_PER_TICK) {
      if (state.phase === 'objects' || state.phase === 'thumbs') {
        const listPrefix = state.phase === 'objects' ? prefix : `.thumbnails/${prefix}`;
        if (state.phase === 'thumbs' && !prefix) {
          state = { phase: 'nas' }; // a full-bucket listing already saw .thumbnails/
          continue;
        }
        const listedAt = new Date().toISOString();
        const page = await bucket.list({ prefix: listPrefix, cursor: state.cursor, limit: 1000 });
        const live: Array<{ key: string; size: number; etag: string | null; uploaded: string }> = [];
        const thumbs: string[] = [];
        for (const o of page.objects) {
          const src = sourceKeyForThumbnail(o.key);
          if (src) { thumbs.push(src); continue; }
          if (isInternalKey(o.key)) continue;
          live.push({ key: o.key, size: o.size, etag: normalizeEtag(o.etag), uploaded: new Date(o.uploaded).toISOString() });
        }
        await upsertListedPage(db, run.id, live, listedAt);
        await markThumbnails(db, thumbs);
        listed += page.objects.length;
        listedThisTick += page.objects.length;
        if (page.truncated && page.cursor) {
          state = { phase: state.phase, cursor: page.cursor };
        } else {
          state = { phase: state.phase === 'objects' ? 'thumbs' : 'nas' };
        }
      } else if (state.phase === 'nas') {
        // Files already archived to the NAS and cleared from R2 before this
        // index existed would otherwise never appear.
        await db.execute(sql`
          INSERT INTO "DriveItem" ("key", "parentKey", "clientPrefix", "name", "isFolder", "size", "storageTier", "lastModified", "lastEventAt", "lastSeenRunId", "updatedAt")
          SELECT n."s3Key",
                 regexp_replace(n."s3Key", '[^/]+$', ''),
                 CASE WHEN position('/' in n."s3Key") > 0 THEN split_part(n."s3Key", '/', 1) || '/' ELSE '' END,
                 regexp_replace(n."s3Key", '^.*/', ''),
                 false, coalesce(n."size", 0), 'nas', n."at", n."at", ${run.id}, now()
          FROM (
            SELECT "s3Key", "fileSize" AS "size", coalesce("deletedFromCloudAt", "updatedAt") AS "at"
            FROM "NasBackupRecord" WHERE "deletedFromCloud" = true AND "archivedToNas" = true AND "s3Key" LIKE ${pattern}
            UNION ALL
            SELECT "s3Key", "size", coalesce("deletedFromCloudAt", "uploadedAt") AS "at"
            FROM "File" WHERE "deletedFromCloud" = true AND "archivedToNas" = true AND "s3Key" IS NOT NULL AND "s3Key" LIKE ${pattern}
          ) n
          WHERE n."s3Key" NOT LIKE '.%' AND n."s3Key" NOT LIKE '\\_\\_%'
          ON CONFLICT ("key") DO UPDATE SET "storageTier" = 'nas', "lastSeenRunId" = EXCLUDED."lastSeenRunId", "updatedAt" = now()
          WHERE "DriveItem"."removedAt" IS NULL AND "DriveItem"."lastSeenRunId" IS DISTINCT FROM EXCLUDED."lastSeenRunId"
        `);
        state = { phase: 'sweep' };
      } else {
        // Sweep: anything not seen in this listing (and not touched by an
        // event since the run started) is gone — archived to the NAS if we
        // have a backup record for it, otherwise tombstoned.
        await db.execute(sql`
          UPDATE "DriveItem" d SET "storageTier" = 'nas', "updatedAt" = now()
          WHERE d."key" LIKE ${pattern} AND d."removedAt" IS NULL AND d."pending" = false AND d."storageTier" = 'r2'
            AND d."lastSeenRunId" IS DISTINCT FROM ${run.id} AND d."lastEventAt" < ${tsToIso(run.startedAt)}::timestamp
            AND (EXISTS (SELECT 1 FROM "File" f WHERE f."s3Key" = d."key" AND f."archivedToNas" = true)
              OR EXISTS (SELECT 1 FROM "NasBackupRecord" n WHERE n."s3Key" = d."key" AND n."archivedToNas" = true))
        `);
        const tomb = await rows(db, sql`
          UPDATE "DriveItem" d SET "removedAt" = now(), "updatedAt" = now()
          WHERE d."key" LIKE ${pattern} AND d."removedAt" IS NULL AND d."pending" = false AND d."storageTier" = 'r2'
            AND d."lastSeenRunId" IS DISTINCT FROM ${run.id} AND d."lastEventAt" < ${tsToIso(run.startedAt)}::timestamp
          RETURNING d."key"
        `);
        await db.execute(sql`
          UPDATE "DriveSyncRun" SET "status" = 'done', "cursor" = NULL, "finishedAt" = now(),
            "listedCount" = ${listed}, "tombstonedCount" = ${tomb.length}
          WHERE "id" = ${run.id}
        `);
        await housekeeping(db, bucket);
        const done = await rows<SyncRun>(db, sql`SELECT * FROM "DriveSyncRun" WHERE "id" = ${run.id}`);
        return done[0];
      }
    }
  } catch (err: any) {
    console.error('[drive-index] sync failed:', err);
    await db.execute(sql`
      UPDATE "DriveSyncRun" SET "status" = 'failed', "error" = ${String(err?.message || err).slice(0, 1000)}, "finishedAt" = now(),
        "listedCount" = ${listed}, "cursor" = ${JSON.stringify(state)}
      WHERE "id" = ${run.id}
    `);
    throw err;
  }

  await db.execute(sql`UPDATE "DriveSyncRun" SET "cursor" = ${JSON.stringify(state)}, "listedCount" = ${listed} WHERE "id" = ${run.id}`);
  const after = await rows<SyncRun>(db, sql`SELECT * FROM "DriveSyncRun" WHERE "id" = ${run.id}`);
  return after[0];
}

/** Drop stale bookkeeping rows and orphaned HLS renditions. Runs at the end of each reconcile. */
async function housekeeping(db: Db, bucket: R2BucketLike) {
  // Presigned uploads that never happened.
  await db.execute(sql`
    DELETE FROM "DriveItem" WHERE "pending" = true AND "createdAt" < now() - (${PENDING_RETENTION_DAYS} || ' days')::interval
  `);
  // Old tombstones — first delete their HLS renditions unless a live row
  // still points at the same one (a moved file carries its preview over).
  const old = await rows<{ key: string; previewPrefix: string | null }>(db, sql`
    SELECT "key", "previewPrefix" FROM "DriveItem"
    WHERE "removedAt" IS NOT NULL AND "removedAt" < now() - (${TOMBSTONE_RETENTION_DAYS} || ' days')::interval
      -- Keep tombstones for keys that have a NAS backup: without one, the next
      -- reconcile's NAS phase would re-add a purged file as "archived".
      AND NOT EXISTS (SELECT 1 FROM "File" f WHERE f."s3Key" = "DriveItem"."key" AND f."archivedToNas" = true)
      AND NOT EXISTS (SELECT 1 FROM "NasBackupRecord" n WHERE n."s3Key" = "DriveItem"."key" AND n."archivedToNas" = true)
    LIMIT 2000
  `);
  const prefixes = [...new Set(old.map((o) => o.previewPrefix).filter((p): p is string => !!p && p.startsWith('.hls/')))];
  if (prefixes.length) {
    const stillUsed = await rows<{ previewPrefix: string }>(db, sql`
      SELECT DISTINCT "previewPrefix" FROM "DriveItem"
      WHERE "removedAt" IS NULL AND "previewPrefix" IN (${sql.join(prefixes.map((p) => sql`${p}`), sql`, `)})
    `);
    const used = new Set(stillUsed.map((s) => s.previewPrefix));
    for (const p of prefixes) {
      if (used.has(p)) continue;
      try { await deletePrefix(bucket, p); } catch (err: any) { console.warn(`[drive-index] HLS cleanup failed for ${p}:`, err?.message); }
    }
  }
  if (old.length) {
    await db.execute(sql`DELETE FROM "DriveItem" WHERE "key" IN (${sql.join(old.map((o) => sql`${o.key}`), sql`, `)})`);
  }
  // Activity older than a year.
  await db.execute(sql`DELETE FROM "DriveActivity" WHERE "createdAt" < now() - interval '365 days'`);
}
