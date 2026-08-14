// src/app/api/health/route.ts
import { getDbHttp } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// process.* is unavailable on Cloudflare Workers — guard it
function getRuntimeStats() {
  try {
    if (typeof process === 'undefined' || !process.memoryUsage) {
      return { runtime: 'workers' };
    }
    return {
      uptime: process.uptime(),
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      },
    };
  } catch {
    return { runtime: 'workers' };
  }
}

export async function GET() {
  const db = getDbHttp();
  const startTime = Date.now();

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database query timeout after 10s')), 10000)
    );

    await Promise.race([
      db.execute(sql`SELECT 1`),
      timeoutPromise,
    ]);

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      ...getRuntimeStats(),
    });
  } catch (error: any) {
    console.error('[Health Check] DB connection failed:', error.message);

    return NextResponse.json({
      status: 'error',
      db: error.message,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      ...getRuntimeStats(),
    }, { status: 500 });
  }
}
