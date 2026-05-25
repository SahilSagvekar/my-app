import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (e) {
  console.warn('[Redis] Failed to initialize:', e);
}

export { redis };

// Helper for caching — falls back to direct call if Redis unavailable
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 60 // seconds
): Promise<T> {
  if (!redis) return fn();

  try {
    const hit = await redis.get<T>(key);
    if (hit) return hit;

    const fresh = await fn();
    await redis.set(key, fresh, { ex: ttl });
    return fresh;
  } catch (e) {
    console.warn(`[Redis] Cache miss/error for ${key}, falling back to DB:`, e);
    return fn();
  }
}

export async function invalidateTaskCache(userId: number) {
  if (!redis) return;
  try {
    const keys = await redis.keys(`tasks:${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (e) {
    console.warn('[Redis] invalidateTaskCache error:', e);
  }
}