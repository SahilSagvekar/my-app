#!/usr/bin/env node
// scripts/mirror-and-cleanup.mjs
//
// Copies ONE client's ONE month of output files from R2 to the NAS's
// MinIO, verifies each copy (size match via HeadObject), and — only for
// files that verify successfully — deletes the R2 copy and updates the
// File record in the database (same fields nas-archival.ts sets).
//
// Raw footage is never touched (it isn't under an /outputs/ prefix, so
// this script structurally can't reach it).
//
// Usage:
//   node scripts/mirror-and-cleanup.mjs --client "The Dating Blind Show" --month "March-2026"
//     -> copies + verifies only, does NOT delete from R2. Safe to run
//        repeatedly. Reports what WOULD be deleted.
//
//   node scripts/mirror-and-cleanup.mjs --client "The Dating Blind Show" --month "March-2026" --delete
//     -> after verified copy, actually deletes from R2 and updates the DB.
//
// Client name must match the exact prefix used in s3Key, e.g. for
// "The Dating Blind Show/outputs/March-2026/..." pass
// --client "The Dating Blind Show" --month "March-2026"

import 'dotenv/config';
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    client: get('--client'),
    month: get('--month'),
    reallyDelete: args.includes('--delete'),
  };
}

const { client, month, reallyDelete } = parseArgs();

if (!client || !month) {
  console.error('Usage: node scripts/mirror-and-cleanup.mjs --client "ClientName" --month "March-2026" [--delete]');
  process.exit(1);
}

const prefix = `${client}/outputs/${month}/`;

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const R2_BUCKET = process.env.AWS_S3_BUCKET || 'e8-app-r2-prod';

const nas = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.NAS_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.NAS_S3_ACCESS_KEY,
    secretAccessKey: process.env.NAS_S3_SECRET_KEY,
  },
});
const NAS_BUCKET = process.env.NAS_S3_BUCKET || 'e8-nas-backup';

const prisma = new PrismaClient();

async function ensureNasBucket() {
  try {
    await nas.send(new CreateBucketCommand({ Bucket: NAS_BUCKET }));
  } catch (err) {
    if (err.name !== 'BucketAlreadyOwnedByYou' && err.name !== 'BucketAlreadyExists') {
      throw err;
    }
  }
}

async function* listR2Keys(prefix) {
  let ContinuationToken;
  do {
    const page = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      ContinuationToken,
    }));
    for (const obj of page.Contents || []) {
      yield obj;
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

async function headOnNas(key) {
  try {
    const head = await nas.send(new HeadObjectCommand({ Bucket: NAS_BUCKET, Key: key }));
    return { ok: true, size: head.ContentLength };
  } catch {
    return { ok: false };
  }
}

async function copyToNas(key, expectedSize) {
  const { Body, ContentType } = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  await nas.send(new PutObjectCommand({
    Bucket: NAS_BUCKET,
    Key: key,
    Body,
    ContentLength: expectedSize,
    ContentType,
  }));
}

async function main() {
  console.log(`=== Mirror + Cleanup: "${client}" / ${month} ===`);
  console.log(`Prefix: ${prefix}`);
  console.log(reallyDelete ? 'Mode: COPY + VERIFY + DELETE FROM R2' : 'Mode: COPY + VERIFY ONLY (no deletion — pass --delete to actually delete)');
  console.log('');

  await ensureNasBucket();

  let scanned = 0, copied = 0, alreadyOnNas = 0, verified = 0, deleted = 0, failed = 0;
  const verifiedKeys = [];

  for await (const obj of listR2Keys(prefix)) {
    scanned++;
    const key = obj.Key;

    let head = await headOnNas(key);
    if (head.ok && head.size === obj.Size) {
      alreadyOnNas++;
    } else {
      try {
        console.log(`Copying: ${key} (${(obj.Size / 1024 / 1024).toFixed(1)} MB)`);
        await copyToNas(key, obj.Size);
        copied++;
        head = await headOnNas(key);
      } catch (err) {
        console.error(`  FAILED to copy: ${err.message}`);
        failed++;
        continue;
      }
    }

    if (head.ok && head.size === obj.Size) {
      verified++;
      verifiedKeys.push({ key, size: obj.Size });
    } else {
      console.error(`  VERIFY FAILED (size mismatch or still missing): ${key}`);
      failed++;
    }
  }

  console.log('');
  console.log(`Scanned: ${scanned} | Already on NAS: ${alreadyOnNas} | Newly copied: ${copied} | Verified: ${verified} | Failed: ${failed}`);

  if (!reallyDelete) {
    console.log('');
    console.log(`Dry run — ${verified} file(s) verified and WOULD be deleted from R2 with --delete.`);
    await prisma.$disconnect();
    return;
  }

  console.log('');
  console.log(`Deleting ${verified} verified file(s) from R2...`);

  for (const { key } of verifiedKeys) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));

      const updated = await prisma.file.updateMany({
        where: { s3Key: key },
        data: {
          deletedFromCloud: true,
          deletedFromCloudAt: new Date(),
          archivedToNas: true,
          nasArchivedAt: new Date(),
          nasPath: `minio://${NAS_BUCKET}`,
        },
      });

      deleted++;
      console.log(`  Deleted from R2 + updated DB (${updated.count} record(s)): ${key}`);
    } catch (err) {
      console.error(`  FAILED to delete ${key}: ${err.message}`);
    }
  }

  console.log('');
  console.log(`=== Done: ${deleted} file(s) deleted from R2 and archived to NAS ===`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Script crashed:', err);
  await prisma.$disconnect();
  process.exit(1);
});