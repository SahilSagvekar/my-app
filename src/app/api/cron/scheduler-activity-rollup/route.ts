export const dynamic = 'force-dynamic';
// src/app/api/cron/scheduler-activity-rollup/route.ts
// Nightly job. Called by cron-master.ts, or manually by an admin.
// See src/lib/scheduler-activity-rollup.ts for the actual rollup + prune logic.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { runSchedulerActivityRollup } from '@/lib/scheduler-activity-rollup';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  const cookieHeader = req.headers.get('cookie');
  const match = cookieHeader?.match(/authToken=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.role?.toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await runSchedulerActivityRollup();
    return NextResponse.json({ ok: true, message: 'Scheduler activity rollup complete' });
  } catch (err: any) {
    console.error('❌ /api/cron/scheduler-activity-rollup error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}