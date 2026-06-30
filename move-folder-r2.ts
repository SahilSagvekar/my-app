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

const BUCKET      = "e8-app-r2-prod";
const PARENT      = "William Coleman/raw-footage/May-2026/";
const DEST_PREFIX = `${PARENT}Long Form Videos/may-16th-raw/`;

async function main() {
  console.log(`\nListing loose files directly inside:\n  ${PARENT}\n`);

  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await R2.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: PARENT,
      Delimiter: "/",
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      if (obj.Key && obj.Key !== PARENT) keys.push(obj.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  if (keys.length === 0) {
    console.log("No loose files found. Exiting.");
    return;
  }

  console.log(`Found ${keys.length} file(s) to move into Long Form Videos/may-16th-raw/:\n`);
  for (const k of keys) console.log(`  ${k.slice(PARENT.length)}`);
  console.log();

  let moved = 0, failed = 0;

  for (const sourceKey of keys) {
    const fileName = sourceKey.slice(PARENT.length);
    const destKey  = `${DEST_PREFIX}${fileName}`;

    try {
      await R2.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${encodeURIComponent(sourceKey).replace(/%2F/g, "/")}`,
        Key: destKey,
      }));

      await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: sourceKey }));

      console.log(`  ✓ ${fileName}`);
      moved++;
    } catch (err) {
      console.error(`  ✗ ${fileName}`, err);
      failed++;
    }
  }

  console.log(`\nDone. ${moved} moved, ${failed} failed.`);
}

main().catch(console.error);

