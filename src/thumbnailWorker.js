// src/thumbnailWorker.js — background processor for the thumbnail queue
//
// This is the piece that makes bursts safe: no matter how many jobs get
// enqueued at once (10 uploads finishing together, or a full backfill
// dropping thousands of rows), this worker only ever processes
// CONCURRENCY of them at a time. Everything else just waits in the queue.

const queue = require('./thumbnailQueue');
const { generateThumbnail } = require('./thumbnail');

const CONCURRENCY = parseInt(process.env.THUMBNAIL_CONCURRENCY || '2', 10);
const POLL_INTERVAL_MS = 5000;

let active = 0;
let stopped = false;

async function processJob(job) {
  active++;
  try {
    const destKey = await generateThumbnail(job.key);
    queue.markDone(job.id);
    console.log(`🖼️  Thumbnail ready: ${job.key} → ${destKey}`);
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