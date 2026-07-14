export const dynamic = 'force-dynamic';
// src/app/api/cron/s3-to-nas/route.ts
// Monthly output-folder archival sweep. Called by cron-master.ts on the 1st
// of every month, or manually from the NAS Backup admin panel.
// See src/lib/nas-archival.ts for the actual sweep + NAS verification logic.

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
    const dryRun = body?.dryRun === true;
    const clientId = typeof body?.clientId === 'string' && body.clientId.length > 0 ? body.clientId : null;

    const summary = await runNasArchivalSweep({ dryRun, clientId });

    return NextResponse.json({
      ok: true,
      message: dryRun
        ? `Preview: ${summary.eligibleCount} file(s) eligible, ${summary.deletedCount} verified on NAS and would be deleted, ${summary.skippedCount} not yet confirmed on NAS.`
        : `Swept ${summary.deletedCount} file(s) (${summary.monthsSwept.join(', ') || 'none'}), ${summary.skippedCount} skipped (not confirmed on NAS), ${summary.failedCount} failed.`,
      summary,
    });
  } catch (err: any) {
    console.error('[S3 to NAS Sweep] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Sweep failed' }, { status: 500 });
  }
}
