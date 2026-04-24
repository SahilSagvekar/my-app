import "dotenv/config";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getS3, BUCKET } from "../lib/s3";

const DRY_RUN = process.env.DRY_RUN !== "false";

const SOURCE_PREFIX = "William Coleman/";
const DEST_PREFIX =
  "William Coleman/raw-footage/April-2026/Long Form Videos/week-1/";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"];

function isVideoFile(key: string) {
  return VIDEO_EXTENSIONS.some((ext) => key.toLowerCase().endsWith(ext));
}

function isDirectRootFile(key: string) {
  const rest = key.replace(SOURCE_PREFIX, "");
  return rest.length > 0 && !rest.includes("/");
}

async function main() {
  const s3 = getS3();

  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`Source: ${SOURCE_PREFIX}`);
  console.log(`Destination: ${DEST_PREFIX}`);

  const files: { key: string; size: number }[] = [];
  let token: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: SOURCE_PREFIX,
        ContinuationToken: token,
      })
    );

    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;

      if (isDirectRootFile(obj.Key) && isVideoFile(obj.Key)) {
        files.push({
          key: obj.Key,
          size: obj.Size ?? 0,
        });
      }
    }

    token = res.NextContinuationToken;
  } while (token);

  console.log(`\nFound ${files.length} root video file(s):`);

  for (const file of files) {
    const filename = file.key.replace(SOURCE_PREFIX, "");
    const destKey = `${DEST_PREFIX}${filename}`;

    console.log(`- ${file.key}`);
    console.log(`  -> ${destKey}`);
    console.log(`  Size: ${file.size} bytes`);
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  console.log(`\nTotal size: ${totalSize} bytes`);

  if (DRY_RUN) {
    console.log("\nDry run only. Nothing was moved.");
    return;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: DEST_PREFIX,
      Body: "",
    })
  );

  for (const file of files) {
    const filename = file.key.replace(SOURCE_PREFIX, "");
    const destKey = `${DEST_PREFIX}${filename}`;

    console.log(`\nMoving: ${file.key}`);

    await s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${encodeURIComponent(file.key)}`,
        Key: destKey,
      })
    );

    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: BUCKET,
        Key: destKey,
      })
    );

    if ((head.ContentLength ?? 0) !== file.size) {
      console.error(`❌ Size mismatch. Not deleting original: ${file.key}`);
      continue;
    }

    // await s3.send(
    //   new DeleteObjectCommand({
    //     Bucket: BUCKET,
    //     Key: file.key,
    //   })
    // );

    console.log(`✅ Moved successfully: ${destKey}`);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});