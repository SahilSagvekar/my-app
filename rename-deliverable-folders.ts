/**
 * rename-deliverable-folders.ts
 *
 * Renames short-code deliverable folders (SF, LF, SQF, THUMB, T, HP, SEP,
 * BSF, ST, TP) under a client's raw-footage/ prefix to their real full
 * names — same logic as /api/admin/rename-folders and FolderRenameTool.tsx,
 * just runnable locally without deploying anything. Talks to R2 directly
 * with the same credentials already in .env.
 *
 * Copy-then-delete, one folder at a time — never deletes the old folder if
 * the copy step had any errors. Dry run by default; nothing in R2 is
 * touched unless you pass --execute.
 *
 * Run (dry run — shows what WOULD happen, touches nothing):
 *   npx tsx src/scripts/rename-deliverable-folders.ts --company="B&M Marine Construction, Inc."
 *
 * Run for real (after reviewing the dry run output):
 *   npx tsx src/scripts/rename-deliverable-folders.ts --company="B&M Marine Construction, Inc." --execute
 *
 * One client at a time by design — re-run with a different --company for
 * the next one.
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const BUCKET = process.env.AWS_S3_BUCKET || 'e8-app-r2-prod';

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  ...(process.env.R2_ENDPOINT ? { endpoint: process.env.R2_ENDPOINT, forcePathStyle: true } : {}),
});

// Same mapping as src/app/api/admin/rename-folders/route.ts — keep these in
// sync (see src/lib/deliverable-folder-name.ts for the canonical direction).
const SHORT_CODE_MAP: Record<string, string> = {
  SF:    'Short Form Videos',
  LF:    'Long Form Videos',
  SQF:   'Square Form Videos',
  THUMB: 'Thumbnails',
  T:     'Tiles',
  HP:    'Hard Posts', // "Hard Posts / Graphic Images" contains a "/" — breaks S3 keys as a folder name, so shortened
  SEP:   'Snapchat Episodes',
  BSF:   'Beta Short Form',
  ST:    'Stories',
  TP:    'Text Post',
};
const SHORT_CODES = new Set(Object.keys(SHORT_CODE_MAP));

interface FoundFolder {
  folderKey: string;
  shortCode: string;
  newKey: string;
}

async function listAllKeys(prefix: string): Promise<string[]> {
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

async function findShortCodeFolders(clientPrefix: string): Promise<FoundFolder[]> {
  const results: FoundFolder[] = [];

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
        const folderKey = cp.Prefix!;
        const segments = folderKey.replace(/\/$/, '').split('/');
        const folderName = segments[segments.length - 1];

        if (SHORT_CODES.has(folderName)) {
          const fullName = SHORT_CODE_MAP[folderName];
          segments[segments.length - 1] = fullName;
          const newKey = segments.join('/') + '/';
          results.push({ folderKey, shortCode: folderName, newKey });
          // Don't recurse into it — renaming the whole folder
        } else {
          await scanLevel(folderKey);
        }
      }

      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  }

  await scanLevel(clientPrefix);
  return results;
}

async function copyPrefix(oldPrefix: string, newPrefix: string): Promise<{ copied: number; errors: string[] }> {
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

async function deletePrefix(prefix: string): Promise<{ deleted: number; errors: string[] }> {
  const keys = await listAllKeys(prefix);
  let deleted = 0;
  const errors: string[] = [];

  const BATCH = 1000;
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

async function main() {
  const args = process.argv.slice(2);
  const companyArg = args.find(a => a.startsWith('--company='));
  const execute = args.includes('--execute');

  if (!companyArg) {
    console.error('Usage: npx tsx src/scripts/rename-deliverable-folders.ts --company="Company Name" [--execute]');
    process.exit(1);
  }

  const companyName = companyArg.slice('--company='.length).replace(/^["']|["']$/g, '').trim();
  if (!companyName) {
    console.error('Company name cannot be empty.');
    process.exit(1);
  }

  const prefix = `${companyName}/`;
  console.log(`\n${execute ? '🔴 EXECUTING' : '🟡 DRY RUN'} — scanning: ${prefix}\n`);

  const found = await findShortCodeFolders(prefix);

  if (found.length === 0) {
    console.log('Nothing to rename — no short-code folders found under this client.');
    return;
  }

  console.log(`Found ${found.length} short-code folder(s):\n`);

  for (const f of found) {
    const keys = await listAllKeys(f.folderKey);
    console.log(`  ${f.folderKey}  →  ${f.newKey}`);
    console.log(`    ${keys.length} object(s)${keys.length > 0 ? ' — e.g. ' + keys.slice(0, 3).join(', ') : ''}`);
  }

  if (!execute) {
    console.log(`\nDry run only — nothing was changed. Re-run with --execute to actually rename these.\n`);
    return;
  }

  console.log(`\nExecuting renames...\n`);

  let succeeded = 0;
  let failed = 0;

  for (const f of found) {
    console.log(`Renaming: ${f.folderKey} → ${f.newKey}`);
    const { copied, errors: copyErrors } = await copyPrefix(f.folderKey, f.newKey);

    if (copyErrors.length > 0) {
      console.error(`  ❌ Copy failed (${copyErrors.length} error(s)) — leaving original in place:`);
      copyErrors.forEach(e => console.error(`     ${e}`));
      failed++;
      continue;
    }

    const { deleted, errors: deleteErrors } = await deletePrefix(f.folderKey);

    if (deleteErrors.length > 0) {
      console.error(`  ⚠️  Copied ${copied} object(s) OK, but ${deleteErrors.length} delete(s) failed — old folder partially remains:`);
      deleteErrors.forEach(e => console.error(`     ${e}`));
      failed++;
    } else {
      console.log(`  ✅ Copied ${copied}, deleted ${deleted}`);
      succeeded++;
    }
  }

  console.log(`\nDone — ${succeeded} succeeded, ${failed} failed.\n`);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});