// src/app/api/dev/clear-cache/route.ts
import { redis } from '@/lib/redis';

export async function POST() {
  await redis.flushdb();
  return Response.json({ message: 'Cache cleared' });
}