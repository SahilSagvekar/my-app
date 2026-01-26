// src/app/api/cron/check-titling-jobs/route.ts

import { NextResponse } from 'next/server';
import { checkStuckJobs } from '@/lib/titling-service';

/**
 * GET /api/cron/check-titling-jobs
 * 
 * Cron job to check for stuck titling jobs
 * Should be called every 30 minutes
 * 
 * For Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-titling-jobs",
 *     "schedule": "0,30 * * * *"
 *   }]
 * }
 * 
 * For external cron (e.g., cron-job.org), just hit this endpoint
 */
export async function GET(req: Request) {
  try {
    // Optional: Verify cron secret to prevent unauthorized calls
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && cronSecret !== expectedSecret) {
      // Allow without secret in development
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('\n⏰ Running stuck titling jobs check...');
    
    const stuckCount = await checkStuckJobs();
    
    console.log(`   Processed ${stuckCount} stuck jobs`);

    return NextResponse.json({
      success: true,
      message: `Checked and processed ${stuckCount} stuck jobs`,
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('❌ Cron job error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST also allowed for flexibility
export async function POST(req: Request) {
  return GET(req);
}
