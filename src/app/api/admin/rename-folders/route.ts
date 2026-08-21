export const dynamic = 'force-dynamic';

// /api/admin/rename-folders
//
// GET  ?clientId=<id>  — scan one client's R2 prefix and return all folders
//                        whose name exactly matches a short code (SF, LF, etc.)
//                        Returns dry-run preview: what would be renamed to what.
//
// POST { renames: { oldKey: string; newKey: string }[], dryRun: boolean }
//      dryRun=true  → returns the same plan without touching R2
//      dryRun=false → executes: copies all objects under oldKey → newKey, deletes originals

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { client as clientTable } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getS3, BUCKET } from '@/lib/s3';
import {
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

// ─── Short code → full name mapping ──────────────────────────────────────────
// Matches the exact deliverable "type" strings real uploads use (see
// ClientManagement.tsx's dropdown, RawFootageUploadDialog.tsx) — see
// src/lib/deliverable-folder-name.ts for the single source of truth this
// mirrors (kept as a literal map here, not imported, since this map's KEYS
// are short codes that only ever existed as folder names on disk, not real
// deliverable type values — the helper only knows the reverse direction).
const SHORT_CODE_MAP: Record<string, string> = {
  SF:    'Short Form Videos',
  LF:    'Long Form Videos',
  SQF:   'Square Form Videos',
  THUMB: 'Thumbnails',
  T:     'Tiles',
  HP:    'Hard Posts', // "Hard Posts / Graphic Images" contains a "/", which breaks S3 keys as a folder name — shortened, see deliverable-folder-name.ts
  SEP:   'Snapchat Episodes',
  BSF:   'Beta Short Form',
  ST:    'Stories',
  TP:    'Text Post',
};

const SHORT_CODES = new Set(Object.keys(SHORT_CODE_MAP));

// ─── List every key under a prefix (paginated) ───────────────────────────────
async function listAllKeys(prefix: string): Promise<string[]> {
  const s3 = getS3();
  const keys: string[] = [];
  let token: string | undefined;

  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  return keys;
}

// ─── Find all folders directly under a prefix whose name is a short code ─────
// A "folder" in R2 is inferred from common prefixes. We list with Delimiter='/'
// to get just the immediate children.
async function findShortCodeFolders(clientPrefix: string): Promise<
  { folderKey: string; shortCode: string; fullName: string; newKey: string }[]
> {
  const s3 = getS3();
  const results: { folderKey: string; shortCode: string; fullName: string; newKey: string }[] = [];

  // We need to scan recursively to catch SF/LF inside month folders.
  // Strategy: list with Delimiter to walk level by level.
  async function scanLevel(prefix: string) {
    let token: string | undefined;
    do {
      const res = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        Delimiter: '/',
        ContinuationToken: token,
        MaxKeys: 1000,
      }));

      for (const cp of res.CommonPrefixes ?? []) {
        const folderKey = cp.Prefix!; // e.g. "ClientName/raw-footage/June-2025/SF/"
        // Get just the folder name (last non-empty segment)
        const segments = folderKey.replace(/\/$/, '').split('/');
        const folderName = segments[segments.length - 1];

        if (SHORT_CODES.has(folderName)) {
          // This folder is a short code — record the rename
          const fullName = SHORT_CODE_MAP[folderName];
          // Build the new key by replacing just the last segment
          segments[segments.length - 1] = fullName;
          const newKey = segments.join('/') + '/';
          results.push({ folderKey, shortCode: folderName, fullName, newKey });
          // Don't recurse into it — we're renaming the whole folder
        } else {
          // Not a short code folder — recurse into it
          await scanLevel(folderKey);
        }
      }

      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  }

  await scanLevel(clientPrefix);
  return results;
}

// ─── Copy all objects from oldPrefix → newPrefix ──────────────────────────────
async function copyPrefix(oldPrefix: string, newPrefix: string): Promise<{ copied: number; errors: string[] }> {
  const s3 = getS3();
  const keys = await listAllKeys(oldPrefix);
  let copied = 0;
  const errors: string[] = [];

  const CONCURRENCY = 10;
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(key => {
        const relativePath = key.slice(oldPrefix.length);
        const destKey = newPrefix + relativePath;
        return s3.send(new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `${BUCKET}/${key}`,
          Key: destKey,
        }));
      })
    );
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') copied++;
      else errors.push(`Copy failed for ${batch[idx]}: ${(r.reason as Error).message}`);
    });
  }

  return { copied, errors };
}

// ─── Delete all objects under a prefix ───────────────────────────────────────
async function deletePrefix(prefix: string): Promise<{ deleted: number; errors: string[] }> {
  const s3 = getS3();
  const keys = await listAllKeys(prefix);
  let deleted = 0;
  const errors: string[] = [];

  const BATCH = 1000; // S3 DeleteObjects max
  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH);
    try {
      const res = await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: batch.map(k => ({ Key: k })) },
      }));
      deleted += batch.length - (res.Errors?.length ?? 0);
      for (const e of res.Errors ?? []) {
        errors.push(`Delete failed for ${e.Key}: ${e.Message}`);
      }
    } catch (err: any) {
      errors.push(`DeleteObjects batch failed: ${err.message}`);
    }
  }

  return { deleted, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/rename-folders?clientId=<id>
// Scans the client's R2 prefix and returns every short-code folder found,
// with the proposed rename. Never modifies anything.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    await requireAdmin(req);

    const clientId = req.nextUrl.searchParams.get('clientId');

    if (!clientId) {
      // No clientId — return client list for the selector
      const clients = await db.select({ id: clientTable.id, companyName: clientTable.companyName, name: clientTable.name })
        .from(clientTable)
        .where(eq(clientTable.status, 'active'))
        .orderBy(asc(clientTable.companyName));
      return NextResponse.json({
        clients: clients.map(c => ({
          id: c.id,
          name: c.companyName || c.name,
        })),
      });
    }

    // Resolve company name
    const [client] = await db.select({ companyName: clientTable.companyName, name: clientTable.name })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const companyName = (client.companyName || client.name).trim();
    const prefix = `${companyName}/`;

    console.log(`[rename-folders] Scanning prefix: ${prefix}`);
    const found = await findShortCodeFolders(prefix);
    console.log(`[rename-folders] Found ${found.length} short-code folders`);

    return NextResponse.json({
      companyName,
      prefix,
      folders: found,
      totalFound: found.length,
    });
  } catch (err: any) {
    console.error('[rename-folders] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/rename-folders
// Body: { renames: { oldKey: string; newKey: string }[], dryRun: boolean }
//
// dryRun=true  → validates the keys and returns the plan, touches nothing
// dryRun=false → executes each rename: copy all objects, then delete originals
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    await requireAdmin(req);

    const body = await req.json();
    const { renames, dryRun = true } = body as {
      renames: { oldKey: string; newKey: string }[];
      dryRun: boolean;
    };

    if (!Array.isArray(renames) || renames.length === 0) {
      return NextResponse.json({ error: 'renames must be a non-empty array' }, { status: 400 });
    }

    // Safety: validate all keys — must end in '/', no path traversal
    for (const r of renames) {
      if (!r.oldKey?.endsWith('/') || !r.newKey?.endsWith('/')) {
        return NextResponse.json({ error: 'All keys must end in /' }, { status: 400 });
      }
      if (r.oldKey.includes('..') || r.newKey.includes('..')) {
        return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
      }
    }

    if (dryRun) {
      // Dry run: count objects under each prefix so the user can see what will move
      const preview = await Promise.all(
        renames.map(async r => {
          const keys = await listAllKeys(r.oldKey);
          return {
            oldKey: r.oldKey,
            newKey: r.newKey,
            objectCount: keys.length,
            sampleKeys: keys.slice(0, 3),
          };
        })
      );
      return NextResponse.json({ dryRun: true, preview, totalRenames: renames.length });
    }

    // Execute renames one at a time (copy then delete)
    const results: {
      oldKey: string;
      newKey: string;
      ok: boolean;
      copied?: number;
      deleted?: number;
      errors?: string[];
    }[] = [];

    for (const { oldKey, newKey } of renames) {
      console.log(`[rename-folders] Renaming: ${oldKey} → ${newKey}`);
      const { copied, errors: copyErrors } = await copyPrefix(oldKey, newKey);

      if (copyErrors.length > 0) {
        console.error(`[rename-folders] Copy errors for ${oldKey}:`, copyErrors);
        results.push({ oldKey, newKey, ok: false, copied, errors: copyErrors });
        continue; // Don't delete if copy had errors
      }

      const { deleted, errors: deleteErrors } = await deletePrefix(oldKey);

      results.push({
        oldKey,
        newKey,
        ok: deleteErrors.length === 0,
        copied,
        deleted,
        errors: deleteErrors.length > 0 ? deleteErrors : undefined,
      });

      console.log(`[rename-folders] Done: ${oldKey} → ${newKey} | copied:${copied} deleted:${deleted}`);
    }

    const succeeded = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;

    return NextResponse.json({ dryRun: false, succeeded, failed, results });
  } catch (err: any) {
    console.error('[rename-folders] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}