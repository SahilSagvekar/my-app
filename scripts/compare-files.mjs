// compare-files.mjs
//
// Compares a list of expected filenames against what's actually sitting in
// an R2 folder, and reports which ones are missing.
//
// Usage:
//   1. Paste your filenames into the FILENAMES array below.
//   2. Run from the my-app project root (so it picks up your .env):
//        node compare-files.mjs
//
// Requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, R2_ENDPOINT, and
// AWS_S3_BUCKET to already be set in your .env — same vars your app's
// s3.ts already uses.

import 'dotenv/config';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// ─────────────────────────────────────────
// 1. Paste your filenames here (one per line, exactly as expected)
// ─────────────────────────────────────────
const FILENAMES = [
  // "example-video-1.mp4",
  // "example-video-2.mp4",
];

// ─────────────────────────────────────────
// 2. Folder to check against
// ─────────────────────────────────────────
const BUCKET = process.env.AWS_S3_BUCKET || 'e8-app-r2-prod';
const PREFIX = 'Combatica/raw-footage/August-2026/SF/';

// ─────────────────────────────────────────
// R2 client — same config pattern as src/lib/s3.ts
// ─────────────────────────────────────────
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // Same fix from the SignatureDoesNotMatch issue — avoid the SDK's default
  // flexible-checksum handshake, which R2 doesn't fully support.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async function listAllFilesInFolder(bucket, prefix) {
  const filenames = new Set();
  let continuationToken = undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of res.Contents || []) {
      // Strip the folder path, keep just the filename itself.
      // Skip "folder marker" objects (keys ending in /).
      if (obj.Key.endsWith('/')) continue;
      const parts = obj.Key.split('/');
      filenames.add(parts[parts.length - 1]);
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return filenames;
}

async function main() {
  if (FILENAMES.length === 0) {
    console.error('⚠️  FILENAMES array is empty — paste your list into the script first.');
    process.exit(1);
  }

  console.log(`Checking ${FILENAMES.length} filenames against r2://${BUCKET}/${PREFIX} ...`);

  const actualFiles = await listAllFilesInFolder(BUCKET, PREFIX);
  console.log(`Found ${actualFiles.size} files in that folder.\n`);

  const missing = FILENAMES.filter((name) => !actualFiles.has(name.trim()));

  if (missing.length === 0) {
    console.log('✅ All filenames were found in the folder.');
  } else {
    console.log(`❌ ${missing.length} of ${FILENAMES.length} filenames are MISSING:\n`);
    missing.forEach((name) => console.log(`  - ${name}`));
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
