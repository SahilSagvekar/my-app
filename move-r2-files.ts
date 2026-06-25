import dotenv from "dotenv";
dotenv.config();

import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = "e8-app-r2-prod";
const SOURCE_PREFIX = "William Coleman/raw-footage/May-2026/Long Form Videos/may-week-2-raw/may-week-3-raw/may-16th-raw/may-25-raw/";
const DEST_PREFIX   = "William Coleman/raw-footage/May-2026/Long Form Videos/may-25-raw/";

async function main() {
  console.log(`\nMoving folder:\n  FROM: ${SOURCE_PREFIX}\n  TO:   ${DEST_PREFIX}\n`);

  // List all objects under the source folder
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await R2.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: SOURCE_PREFIX,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  if (keys.length === 0) {
    console.log("No files found under source prefix. Exiting.");
    return;
  }

  console.log(`Found ${keys.length} file(s):\n`);
  for (const k of keys) console.log(`  ${k.slice(SOURCE_PREFIX.length)}`);
  console.log();

  let moved = 0, failed = 0;

  for (const sourceKey of keys) {
    const relative = sourceKey.slice(SOURCE_PREFIX.length);
    const destKey  = `${DEST_PREFIX}${relative}`;

    try {
      await R2.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${encodeURIComponent(sourceKey).replace(/%2F/g, "/")}`,
        Key: destKey,
      }));

      await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: sourceKey }));

      console.log(`  ✓ ${relative}`);
      moved++;
    } catch (err) {
      console.error(`  ✗ ${relative}`, err);
      failed++;
    }
  }

  console.log(`\nDone. ${moved} moved, ${failed} failed.`);
}

main().catch(console.error);