// src/lib/youtube-quota.ts
//
// Tracks daily YouTube Data API upload quota for the review-mirror
// pipeline (see youtube-mirror.ts), backed by the existing Upstash Redis
// client (redis.ts). A video upload (videos.insert) costs ~1,600 units
// against YouTube's default 10,000-unit/day quota — roughly 6 uploads/day.
// Override YOUTUBE_DAILY_UPLOAD_QUOTA if your project's quota has been
// raised.
//
// Two independent signals gate an upload:
//   1. A local count of today's successful uploads (avoids even trying
//      once we've likely used up the quota).
//   2. An "exhausted" flag set the moment YouTube itself returns a
//      quotaExceeded/dailyLimitExceeded error (see markQuotaExhausted),
//      so we stop wasting round-trips for the rest of the day even if
//      our local count is off (e.g. quota is shared with other jobs).

import { redis } from '@/lib/redis';

const DAILY_QUOTA = parseInt(process.env.YOUTUBE_DAILY_UPLOAD_QUOTA || '6', 10);

function todayDateStr(): string {
  return new Date().toISOString().split('T')[0]; // UTC YYYY-MM-DD
}

function countKey(): string {
  return `youtube:upload-count:${todayDateStr()}`;
}

function exhaustedKey(): string {
  return `youtube:quota-exhausted:${todayDateStr()}`;
}

function secondsUntilUTCMidnight(): number {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}

/**
 * Check whether we still have upload quota left today. Fails OPEN
 * (allows the upload) if Redis isn't configured — we'd rather risk a
 * mid-upload 403 (handled by markQuotaExhausted, which falls back to
 * Drive) than silently disable YouTube mirroring over a missing env var.
 */
export async function hasQuotaForUpload(): Promise<boolean> {
  if (!redis) {
    console.warn('[youtube-quota] Redis not configured — skipping quota check, allowing upload');
    return true;
  }

  const [count, exhausted] = await Promise.all([
    redis.get<number>(countKey()),
    redis.get<string>(exhaustedKey()),
  ]);

  if (exhausted) return false;
  return (count || 0) < DAILY_QUOTA;
}

/** Record a successful upload against today's quota. */
export async function recordQuotaUsage(): Promise<void> {
  if (!redis) return;

  const key = countKey();
  const newCount = await redis.incr(key);

  if (newCount === 1) {
    // First increment of the day — set expiry so the key self-cleans
    // instead of accumulating forever.
    await redis.expire(key, secondsUntilUTCMidnight());
  }
}

/**
 * Mark today's quota as exhausted — called when YouTube itself returns a
 * quotaExceeded/dailyLimitExceeded error mid-upload. Subsequent uploads
 * today skip straight to the Drive fallback without another round-trip.
 */
export async function markQuotaExhausted(): Promise<void> {
  if (!redis) return;
  await redis.set(exhaustedKey(), '1', { ex: secondsUntilUTCMidnight() });
}