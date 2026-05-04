import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const SOURCE = "William Coleman/raw-footage/April-2026/Long Form Videos/may-week-2-raw";
const DEST   = "William Coleman/raw-footage/May-2026/Long Form Videos/may-week-2-raw";
const BUCKET = process.env.AWS_S3_BUCKET || "e8-app-r2-prod";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const srcPrefix = SOURCE.endsWith("/") ? SOURCE : SOURCE + "/";
const dstPrefix = DEST.endsWith("/")   ? DEST   : DEST   + "/";

async function listAll(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  console.log(`\n📂 Source: ${srcPrefix}`);
  console.log(`📂 Dest:   ${dstPrefix}\n`);

  const keys = await listAll(srcPrefix);

  if (keys.length === 0) {
    console.log("❌ No files found at source path. Check the path and try again.");
    process.exit(1);
  }

  console.log(`Found ${keys.length} file(s):\n`);
  keys.forEach(k => console.log(`  ${k}`));
  console.log();

  let copied = 0;
  let deleted = 0;
  let failed = 0;

  for (const key of keys) {
    const newKey = dstPrefix + key.slice(srcPrefix.length);

    // 1. Copy
    try {
      await s3.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${encodeURIComponent(key).replace(/%2F/g, "/")}`,
        Key: newKey,
      }));
      copied++;
      console.log(`✅ Copied: ${key}`);
      console.log(`       → ${newKey}`);
    } catch (err: any) {
      failed++;
      console.error(`❌ Copy failed for ${key}: ${err.message}`);
      continue; // don't delete if copy failed
    }

    // 2. Delete original only after successful copy
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      deleted++;
      console.log(`🗑️  Deleted: ${key}\n`);
    } catch (err: any) {
      console.error(`⚠️  Delete failed for ${key}: ${err.message}`);
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`Copied:  ${copied}/${keys.length}`);
  console.log(`Deleted: ${deleted}/${keys.length}`);
  if (failed > 0) console.log(`Failed:  ${failed}`);
  console.log(`Done.\n`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});