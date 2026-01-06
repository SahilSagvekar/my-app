import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Helper for caching
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 60 // seconds
): Promise<T> {
  const cached = await redis.get<T>(key);
  if (cached) return cached;

  const fresh = await fn();
  await redis.set(key, fresh, { ex: ttl });
  return fresh;
}

// Add this to redis.ts
export async function invalidateTaskCache(userId: number) {
  const keys = await redis.keys(`tasks:${userId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}