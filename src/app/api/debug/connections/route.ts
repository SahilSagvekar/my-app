export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const db = getDbHttp();
  try {
    // Check active connections
    const result = await db.execute<{
      total: number,
      active: number,
      idle: number
    }>(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    const connections = result.rows;

    // Check memory
    const memory = {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    };
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      database: connections[0],
      memory,
      uptime: Math.round(process.uptime()),
      status: memory.heapUsed < 300 ? 'healthy' : 'warning'
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}