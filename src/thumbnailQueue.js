// src/thumbnailQueue.js — durable job queue for thumbnail generation
//
// Backed by a local SQLite file (not the main app's Postgres) on purpose:
// thumbnail generation is owned entirely by this service, so it doesn't need
// network access to another DB or shared credentials. The file survives
// process restarts (pm2), so nothing is lost if the box reboots mid-backlog.

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.THUMBNAIL_QUEUE_DB || path.join(__dirname, '..', 'thumbnail-queue.sqlite');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS thumbnail_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | done | failed
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_thumbnail_jobs_status ON thumbnail_jobs(status);
`);

const MAX_ATTEMPTS = 2;

/**
 * Add a key to the queue. No-op if it's already pending/processing/done —
 * only re-queues if a previous attempt failed (lets a fixed bug retry on
 * the next backfill without duplicating rows).
 */
function enqueue(key) {
  const existing = db.prepare(`SELECT id, status FROM thumbnail_jobs WHERE key = ?`).get(key);
  if (!existing) {
    db.prepare(`INSERT INTO thumbnail_jobs (key, status) VALUES (?, 'pending')`).run(key);
    return 'queued';
  }
  if (existing.status === 'failed') {
    db.prepare(`
      UPDATE thumbnail_jobs SET status = 'pending', updated_at = datetime('now')
      WHERE id = ?
    `).run(existing.id);
    return 're-queued';
  }
  return 'skipped'; // already pending/processing/done
}

/** Pull up to `limit` pending jobs and atomically mark them 'processing'. */
function claimBatch(limit) {
  const rows = db.prepare(`
    SELECT id, key, attempts FROM thumbnail_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit);

  const claim = db.prepare(`
    UPDATE thumbnail_jobs SET status = 'processing', updated_at = datetime('now')
    WHERE id = ? AND status = 'pending'
  `);

  const claimed = [];
  for (const row of rows) {
    const result = claim.run(row.id);
    if (result.changes === 1) claimed.push(row);
  }
  return claimed;
}

function markDone(id) {
  db.prepare(`
    UPDATE thumbnail_jobs SET status = 'done', error = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

function markFailed(id, errorMessage) {
  const row = db.prepare(`SELECT attempts FROM thumbnail_jobs WHERE id = ?`).get(id);
  const attempts = (row?.attempts || 0) + 1;
  const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'; // retry once, then give up
  db.prepare(`
    UPDATE thumbnail_jobs
    SET status = ?, attempts = ?, error = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, attempts, String(errorMessage).slice(0, 500), id);
}

function getStats() {
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count FROM thumbnail_jobs GROUP BY status
  `).all();
  const stats = { pending: 0, processing: 0, done: 0, failed: 0 };
  for (const r of rows) stats[r.status] = r.count;
  return stats;
}

function getStatusForKey(key) {
  return db.prepare(`SELECT status, error FROM thumbnail_jobs WHERE key = ?`).get(key) || null;
}

function listFailed(limit = 100) {
  return db.prepare(`
    SELECT key, error, attempts, updated_at FROM thumbnail_jobs
    WHERE status = 'failed' ORDER BY updated_at DESC LIMIT ?
  `).all(limit);
}

module.exports = { enqueue, claimBatch, markDone, markFailed, getStats, getStatusForKey, listFailed };