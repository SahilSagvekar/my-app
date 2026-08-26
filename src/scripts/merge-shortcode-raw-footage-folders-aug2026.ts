// src/scripts/merge-shortcode-raw-footage-folders-aug2026.ts
//
// One-off cleanup: three clients have both a short-code folder (SF/LF) and
// a full-name folder (Short Form Videos/Long Form Videos) sitting side by
// side under raw-footage/August-2026/ — merge each pair into the full-name
// folder and remove the short-code one.
//
//   1. capdental        SF -> Short Form Videos   (full move, delete SF folder after)
//   2. Coin Laundry Association   LF -> Long Form Videos    (skip files already present at dest)
//   3. The Drew Meyers  SF -> Short Form Videos   (skip files already present at dest)
//
// "Already present" = same key (relative path) AND same byte size already
// sitting at the destination — that file is left alone (both copies stay
// where they are, task's file is simply not touched). Everything else is
// copied to the destination, size-verified, then deleted from the source.
//
// Client names are resolved from the DB (case-insensitive match on
// companyName or name) to get the client's real rawFootageFolderId, the
// same source of truth uploads use — NOT a guess at exact casing/spacing
// in the R2 key. See /api/nas/browse-folders and nas-mirror-worker.ts for
// the same pattern.
//
// Usage:
//   DRY_RUN=true  npx tsx src/scripts/merge-shortcode-raw-footage-folders-aug2026.ts   (default — prints the plan, touches nothing)
//   DRY_RUN=false npx tsx src/scripts/merge-shortcode-raw-footage-folders-aug2026.ts   (actually copies + deletes)

import "dotenv/config";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getS3, BUCKET } from "../lib/s3";
import { getDbHttp } from "../lib/db";
import { client as clientTable } from "../lib/db/schema";
import { or, ilike } from "drizzle-orm";

const DRY_RUN = process.env.DRY_RUN !== "false";
const MONTH_FOLDER = "August-2026";

interface MergeTask {
  clientName: string;
  sourceFolder: string; // short-code folder name, e.g. "SF"
  destFolder: string; // full-name folder, e.g. "Short Form Videos"
  deleteSourceFolderWhenDone: boolean; // remove the now-empty short-code folder marker
}

const TASKS: MergeTask[] = [
  { clientName: "Cap Dental", sourceFolder: "SF", destFolder: "Short Form Videos", deleteSourceFolderWhenDone: true },
  { clientName: "Coin Laundry Association", sourceFolder: "LF", destFolder: "Long Form Videos", deleteSourceFolderWhenDone: false },
  { clientName: "The Drew Meyers", sourceFolder: "SF", destFolder: "Short Form Videos", deleteSourceFolderWhenDone: false },
];

async function resolveRawFootageRoot(clientName: string): Promise<string> {
  const db = getDbHttp();
  const [found] = await db
    .select({ companyName: clientTable.companyName, name: clientTable.name, rawFootageFolderId: clientTable.rawFootageFolderId })
    .from(clientTable)
    .where(or(ilike(clientTable.companyName, clientName), ilike(clientTable.name, clientName)))
    .limit(1);

  if (!found) {
    throw new Error(`No client found matching "${clientName}" (checked companyName and name, case-insensitive)`);
  }

  const label = found.companyName || found.name || clientName;
  if (found.rawFootageFolderId) {
    return found.rawFootageFolderId.endsWith("/") ? found.rawFootageFolderId : `${found.rawFootageFolderId}/`;
  }
  console.warn(`  ⚠️  No rawFootageFolderId on file for "${label}" — falling back to "${label}/raw-footage/"`);
  return `${label}/raw-footage/`;
}

async function* listAllObjects(prefix: string) {
  const s3 = getS3();
  let token: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) yield { key: obj.Key, size: obj.Size ?? 0 };
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
}

async function headSize(key: string): Promise<number | null> {
  const s3 = getS3();
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return head.ContentLength ?? 0;
  } catch {
    return null; // doesn't exist
  }
}

async function runTask(task: MergeTask) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Client: ${task.clientName}`);
  console.log(`  ${task.sourceFolder}/  ->  ${task.destFolder}/`);

  const rawRoot = await resolveRawFootageRoot(task.clientName);
  const sourcePrefix = `${rawRoot}${MONTH_FOLDER}/${task.sourceFolder}/`;
  const destPrefix = `${rawRoot}${MONTH_FOLDER}/${task.destFolder}/`;

  console.log(`  Source prefix: ${sourcePrefix}`);
  console.log(`  Dest prefix:   ${destPrefix}`);

  const sourceObjects: { key: string; size: number }[] = [];
  for await (const obj of listAllObjects(sourcePrefix)) {
    // Skip the zero-byte "directory marker" object for the source folder itself.
    if (obj.key === sourcePrefix) continue;
    sourceObjects.push(obj);
  }

  if (sourceObjects.length === 0) {
    console.log(`  Nothing found under ${sourcePrefix} — skipping.`);
    return;
  }

  console.log(`  Found ${sourceObjects.length} file(s) under source.\n`);

  let toMove = 0, toSkip = 0, conflicts = 0;
  const moved: string[] = [];
  const skippedDuplicates: string[] = [];

  for (const obj of sourceObjects) {
    const relKey = obj.key.slice(sourcePrefix.length);
    const destKey = `${destPrefix}${relKey}`;

    const existingSize = await headSize(destKey);

    if (existingSize === null) {
      // Doesn't exist at destination — move it.
      toMove++;
      console.log(`  [MOVE]   ${relKey}  (${obj.size} bytes)`);
      if (!DRY_RUN) {
        await getS3().send(
          new CopyObjectCommand({
            Bucket: BUCKET,
            CopySource: `${BUCKET}/${encodeURIComponent(obj.key)}`,
            Key: destKey,
          })
        );
        const verifySize = await headSize(destKey);
        if (verifySize !== obj.size) {
          console.error(`    ❌ Size mismatch after copy (${verifySize} != ${obj.size}) — NOT deleting source: ${obj.key}`);
          continue;
        }
        await getS3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.key }));
      }
      moved.push(obj.key);
    } else if (existingSize === obj.size) {
      // Already present at destination with matching size — don't move it.
      toSkip++;
      console.log(`  [SKIP]   ${relKey}  (already present at destination, ${obj.size} bytes)`);
      skippedDuplicates.push(obj.key);
    } else {
      // Same name, different size — do NOT touch, needs manual review.
      conflicts++;
      console.warn(`  [CONFLICT] ${relKey} — source is ${obj.size} bytes, destination is ${existingSize} bytes. Left both in place — review manually.`);
    }
  }

  console.log(`\n  Summary: ${toMove} to move, ${toSkip} already present (skipped), ${conflicts} conflict(s).`);

  // Clean up the now-empty source folder if requested and nothing was left behind.
  if (task.deleteSourceFolderWhenDone) {
    if (conflicts > 0) {
      console.log(`  Not deleting ${sourcePrefix} — ${conflicts} conflict(s) still need manual review.`);
    } else if (DRY_RUN) {
      console.log(`  (dry run) Would delete the now-empty folder: ${sourcePrefix}`);
    } else {
      // Delete every remaining key under the source prefix — this includes
      // any skipped-duplicate files (task 1 has no "leave duplicates"
      // exception — it explicitly wants the SF folder gone) plus the
      // directory marker object itself, if one exists.
      const remaining: string[] = [];
      for await (const obj of listAllObjects(sourcePrefix)) remaining.push(obj.key);
      if (remaining.length > 0) {
        await getS3().send(
          new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: { Objects: remaining.map((Key) => ({ Key })) },
          })
        );
      }
      console.log(`  ✅ Deleted ${sourcePrefix} (${remaining.length} object(s) removed).`);
    }
  }
}

async function main() {
  console.log(`DRY_RUN: ${DRY_RUN}${DRY_RUN ? "  (nothing will be copied or deleted — set DRY_RUN=false to execute)" : "  (LIVE — files will be copied and deleted)"}`);

  for (const task of TASKS) {
    await runTask(task);
  }

  console.log(`\nDone.`);
}

main().catch((error) => {
  console.error("Merge failed:", error);
  process.exit(1);
});