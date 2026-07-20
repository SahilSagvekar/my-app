// scripts/backfill-thumbnails.js — one-off script to queue thumbnails for
// raw-footage video files that were uploaded before this feature existed.
//
// Run manually on the EC2 box, from the e8-file-server directory:
//   node scripts/backfill-thumbnails.js
//
// This script only ENQUEUES jobs — it does not generate any thumbnails
// itself. The already-running server process (under pm2) picks them up
// via its worker, which is capped at THUMBNAIL_CONCURRENCY (default 2) at
// a time. That's intentional: it means the backfill inherits the exact
// same safety limits as normal on-upload thumbnailing, instead of needing
// its own separate throttling logic.
//
// Safe to re-run: already-queued/done jobs are skipped (see thumbnailQueue.js).

require('dotenv').config();
const { getS3, BUCKET } = require('../src/s3');
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { shouldThumbnail } = require('../src/thumbnail');
const queue = require('../src/thumbnailQueue');

async function* scanAllKeys() {
  const s3 = getS3();
  let continuationToken;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));
    for (const obj of res.Contents || []) {
      if (obj.Key && obj.Size > 0) yield obj.Key;
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
}

async function main() {
  console.log('🔍 Scanning entire bucket for raw-footage video files (this can take a while)...');

  let scanned = 0;
  let matched = 0;
  let queued = 0;
  let alreadyDone = 0;

  for await (const key of scanAllKeys()) {
    scanned++;
    if (scanned % 5000 === 0) console.log(`   …scanned ${scanned} objects so far`);

    if (!shouldThumbnail(key)) continue;
    matched++;

    const outcome = queue.enqueue(key);
    if (outcome === 'queued' || outcome === 're-queued') {
      queued++;
    } else {
      alreadyDone++;
    }
  }

  console.log('');
  console.log('✅ Backfill scan complete');
  console.log(`   Objects scanned:        ${scanned}`);
  console.log(`   Raw-footage videos:     ${matched}`);
  console.log(`   Newly queued:           ${queued}`);
  console.log(`   Already queued/done:    ${alreadyDone}`);
  console.log('');
  console.log('The live server\'s worker will process the queue in the background.');
  console.log('Check progress any time with: curl <file-server-url>/thumbnail/stats');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});