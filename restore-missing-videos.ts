/**
 * restore-missing-videos.ts
 *
 * Re-uploads local video files back to R2 for tasks whose File rows still
 * exist in Postgres but whose objects are missing from the bucket.
 *
 * Matching: by File.name (exact, case-sensitive) against the local filename.
 *   - 0 matches      -> skipped, logged under "no DB match"
 *   - 1 match        -> checked against R2; uploaded if actually missing
 *   - 2+ matches     -> skipped, logged under "ambiguous" (same filename
 *                       used on multiple tasks) so you can resolve by hand
 *
 * Uploads go to the SAME s3Key already stored on the File row, so proxyUrl,
 * Drive-mirror links, thumbnails, and task.driveLinks all keep working
 * without any other changes.
 *
 * Every task that gets a file restored is also tagged "sahil" (the same
 * Tag model / TagPicker the scheduler dashboard already uses — shows up
 * immediately in the existing Tag filter dropdown, no UI changes needed).
 * Tagging ADDS to a task's existing tags, it never removes any.
 *
 * Usage:
 *   npx tsx restore-missing-videos.ts --dir="C:\Users\SAHIL\Downloads\TDBS" --dry-run
 *   npx tsx restore-missing-videos.ts --dir="C:\Users\SAHIL\Downloads\TDBS"
 *   npx tsx restore-missing-videos.ts --dir="C:\Users\SAHIL\Downloads\TDBS" --tag="sahil"
 *
 * Requires the same .env as the app (R2_ENDPOINT, AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, DATABASE_URL). Run from the my-app
 * repo root so `.env` resolves.
 */

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env" });

const prisma = new PrismaClient();

const BUCKET = process.env.AWS_S3_BUCKET || "e8-app-r2-prod";
const IS_R2 = !!process.env.R2_ENDPOINT;

const s3 = new S3Client({
  region: IS_R2 ? "auto" : process.env.AWS_S3_REGION || "us-east-1",
  ...(IS_R2 && { endpoint: process.env.R2_ENDPOINT!, forcePathStyle: true }),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".mxf", ".wmv",
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const dirArg = args.find((a) => a.startsWith("--dir="));
  const tagArg = args.find((a) => a.startsWith("--tag="));
  const dryRun = args.includes("--dry-run");
  if (!dirArg) {
    console.error('Missing required --dir="/path/to/local/videos"');
    process.exit(1);
  }
  return {
    dir: dirArg.slice("--dir=".length),
    dryRun,
    tagName: tagArg ? tagArg.slice("--tag=".length) : "sahil",
  };
}

/** Adds `tagName` to a task's tags without touching any tags already there. */
async function addTagToTask(taskId: string, tagName: string) {
  const tag = await prisma.tag.upsert({
    where: { name: tagName },
    update: {},
    create: { name: tagName },
  });
  await prisma.task.update({
    where: { id: taskId },
    data: { tags: { connect: { id: tag.id } } },
  });
}

function walkVideoFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkVideoFiles(full));
    } else if (VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

async function existsInR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

function mimeTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
    ".m4v": "video/x-m4v",
    ".mxf": "application/mxf",
    ".wmv": "video/x-ms-wmv",
  };
  return map[ext] || "application/octet-stream";
}

async function main() {
  const { dir, dryRun, tagName } = parseArgs();

  if (!fs.existsSync(dir)) {
    console.error(`Directory does not exist: ${dir}`);
    process.exit(1);
  }

  const localFiles = walkVideoFiles(dir);
  console.log(`Found ${localFiles.length} local video file(s) under ${dir}`);
  if (dryRun) console.log("*** DRY RUN — no uploads, DB writes, or tagging will happen ***\n");

  const summary = {
    uploaded: [] as string[],
    alreadyPresent: [] as string[],
    noDbMatch: [] as string[],
    ambiguous: [] as string[],
    failed: [] as string[],
  };
  const taggedTaskIds = new Set<string>();

  for (const localPath of localFiles) {
    const filename = path.basename(localPath);

    const matches = await prisma.file.findMany({
      where: { name: filename },
      select: {
        id: true,
        taskId: true,
        s3Key: true,
        deletedFromCloud: true,
        task: { select: { title: true, clientId: true } },
      },
    });

    if (matches.length === 0) {
      console.log(`⚠️  No DB match: ${filename}`);
      summary.noDbMatch.push(filename);
      continue;
    }

    if (matches.length > 1) {
      console.log(`⚠️  Ambiguous (${matches.length} tasks) for: ${filename}`);
      for (const m of matches) {
        console.log(`     - taskId=${m.taskId} title="${m.task?.title}" fileId=${m.id}`);
      }
      summary.ambiguous.push(filename);
      continue;
    }

    const file = matches[0];
    if (!file.s3Key) {
      console.log(`⚠️  DB match has no s3Key, skipping: ${filename} (fileId=${file.id})`);
      summary.noDbMatch.push(filename);
      continue;
    }

    try {
      const present = await existsInR2(file.s3Key);
      if (present) {
        console.log(`✅ Already in R2, skipping: ${filename}`);
        summary.alreadyPresent.push(filename);
        continue;
      }

      console.log(`⬆️  Missing from R2 — uploading: ${filename} -> ${file.s3Key}`);
      if (!dryRun) {
        const stream = fs.createReadStream(localPath);
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: file.s3Key,
            Body: stream,
            ContentType: mimeTypeFor(filename),
          })
        );

        await prisma.file.update({
          where: { id: file.id },
          data: {
            deletedFromCloud: false,
            deletedFromCloudAt: null,
          },
        });

        await addTagToTask(file.taskId, tagName);
        taggedTaskIds.add(file.taskId);
      }
      console.log(`   done: taskId=${file.taskId} fileId=${file.id} (tagged "${tagName}")`);
      summary.uploaded.push(filename);
    } catch (err: any) {
      console.error(`❌ Failed: ${filename} — ${err.message || err}`);
      summary.failed.push(filename);
    }
  }

  console.log("\n===== SUMMARY =====");
  console.log(`Uploaded:        ${summary.uploaded.length}`);
  console.log(`Already present: ${summary.alreadyPresent.length}`);
  console.log(`No DB match:     ${summary.noDbMatch.length}`);
  console.log(`Ambiguous:       ${summary.ambiguous.length}`);
  console.log(`Failed:          ${summary.failed.length}`);
  console.log(`Tasks tagged "${tagName}": ${taggedTaskIds.size}`);

  if (summary.noDbMatch.length) {
    console.log("\nNo DB match (filenames):");
    summary.noDbMatch.forEach((f) => console.log(`  - ${f}`));
  }
  if (summary.ambiguous.length) {
    console.log("\nAmbiguous (resolve manually):");
    summary.ambiguous.forEach((f) => console.log(`  - ${f}`));
  }
  if (summary.failed.length) {
    console.log("\nFailed:");
    summary.failed.forEach((f) => console.log(`  - ${f}`));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});