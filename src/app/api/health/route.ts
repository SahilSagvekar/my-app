// src/app/api/health/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    // Test database connection with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database query timeout after 10s')), 10000)
    );

    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      timeoutPromise
    ]);

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      }
    });
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('[Health Check] DB connection failed:', error.message);

    return NextResponse.json({
      status: 'error',
      db: error.message,
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      }
    }, { status: 500 });
  }
}