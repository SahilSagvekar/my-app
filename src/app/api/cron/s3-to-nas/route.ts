export const dynamic = 'force-dynamic';
// src/app/api/cron/s3-to-nas/route.ts
// Read-only report of output files old enough + confirmed on NAS that could
// be manually cleaned up from R2 — this never deletes anything itself. See
// src/lib/nas-archival.ts.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { runNasArchivalSweep } from '@/lib/nas-archival';

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
    const body = await req.json().catch(() => ({}));
    const clientId = typeof body?.clientId === 'string' && body.clientId.length > 0 ? body.clientId : null;

    const summary = await runNasArchivalSweep({ clientId });

    return NextResponse.json({
      ok: true,
      message: `${summary.confirmedOnNasCount} file(s) (${summary.monthsSwept.join(', ') || 'none'}) are confirmed on NAS and old enough for manual cleanup consideration — nothing was deleted. ${summary.skippedCount} not yet confirmed on NAS.`,
      summary,
    });
  } catch (err: any) {
    console.error('[S3/NAS eligibility report] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Report failed' }, { status: 500 });
  }
}