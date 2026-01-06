import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check active connections
    const connections = await prisma.$queryRaw<Array<{
      total: number,
      active: number,
      idle: number
    }>>`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;
    
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