export const dynamic = 'force-dynamic';
// src/app/api/cron/check-optimization-jobs/route.ts

import { NextResponse } from 'next/server';
import { checkStuckVideoOptimizationJobs } from '@/lib/video-optimizer';

/**
 * GET /api/cron/check-optimization-jobs
 * 
 * Cron job to check for stuck video optimization jobs (e.g., if server crashed)
 * Should be called periodically (e.g., every 30-60 minutes)
 */
export async function GET(req: Request) {
  try {
    // Optional: Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && cronSecret !== expectedSecret) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('\n⏰ Running stuck optimization jobs check...');
    
    const restartedCount = await checkStuckVideoOptimizationJobs();
    
    return NextResponse.json({
      success: true,
      message: `Checked and restarted ${restartedCount} stuck optimization jobs`,
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('❌ Optimization Cron error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
