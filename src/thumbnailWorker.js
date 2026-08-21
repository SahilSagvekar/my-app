// src/thumbnailWorker.js — background processor for the thumbnail queue
//
// This is the piece that makes bursts safe: no matter how many jobs get
// enqueued at once (10 uploads finishing together, or a full backfill
// dropping thousands of rows), this worker only ever processes
// CONCURRENCY of them at a time. Everything else just waits in the queue.

const queue = require('./thumbnailQueue');
const { generateThumbnail } = require('./thumbnail');
const { invalidateStructure } = require('./cache');

const CONCURRENCY = parseInt(process.env.THUMBNAIL_CONCURRENCY || '2', 10);
const POLL_INTERVAL_MS = 5000;

const APP_URL = process.env.APP_URL || 'https://e8productions.com';
const CRON_SECRET = process.env.CRON_SECRET;

/** Notify my-app so it can create a real `file` row for this auto-generated
 *  thumbnail — output-video jobs only (raw-footage thumbnails don't need a
 *  DB record; they're looked up directly from R2 by the folder tree). */
async function notifyOutputThumbnailComplete(videoKey, thumbnailKey, sizeBytes) {
  if (!CRON_SECRET) {
    console.error('[ThumbnailWorker] CRON_SECRET not set — cannot notify my-app of completed output thumbnail');
    return;
  }
  try {
    const res = await fetch(`${APP_URL}/api/internal/thumbnail-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': CRON_SECRET,
      },
      body: JSON.stringify({ videoS3Key: videoKey, thumbnailS3Key: thumbnailKey, sizeBytes }),
    });
    if (!res.ok) {
      console.error(`[ThumbnailWorker] Webhook failed (${res.status}) for ${videoKey}: ${await res.text().catch(() => '')}`);
    }
  } catch (err) {
    console.error(`[ThumbnailWorker] Webhook fetch failed for ${videoKey}:`, err.message);
  }
}

let active = 0;
let stopped = false;

async function processJob(job) {
  active++;
  try {
    const { destKey, sizeBytes } = await generateThumbnail(job.key);
    queue.markDone(job.id);
    console.log(`🖼️  Thumbnail ready: ${job.key} → ${destKey}`);

    if (job.kind === 'output') {
      await notifyOutputThumbnailComplete(job.key, destKey, sizeBytes);
    } else {
      // The upload's own cache invalidation (in /multipart/complete) already
      // fired before this ran — thumbnail generation takes several seconds
      // longer than the upload response. Without invalidating again here,
      // the folder view keeps showing "no thumbnail yet" until the 5-minute
      // cache TTL happens to expire on its own.
      const parentFolderPrefix = job.key.split('/').slice(0, -1).join('/') + '/';
      invalidateStructure(parentFolderPrefix);
    }
  } catch (err) {
    queue.markFailed(job.id, err.message);
    console.warn(`⚠️  Thumbnail failed for ${job.key}: ${err.message}`);
  } finally {
    active--;
  }
}

async function tick() {
  if (stopped) return;
  const capacity = CONCURRENCY - active;
  if (capacity <= 0) return;

  const jobs = queue.claimBatch(capacity);
  for (const job of jobs) {
    processJob(job); // intentionally not awaited — runs concurrently, capped by `active`
  }
}

function start() {
  console.log(`🚀 Thumbnail worker started (concurrency: ${CONCURRENCY})`);
  setInterval(tick, POLL_INTERVAL_MS);
}

function stop() {
  stopped = true;
}

module.exports = { start, stop };