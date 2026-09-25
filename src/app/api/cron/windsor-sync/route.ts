// src/app/api/cron/windsor-sync/route.ts
// Daily pull of social analytics from Windsor.ai for every active
// SocialAccount (see worker.ts scheduled() for the trigger).

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { syncWindsorAnalytics } from '@/lib/social/windsor';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && process.env.CRON_SECRET) {
    if (authHeader.slice(7) === process.env.CRON_SECRET) return true;
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

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('date_from') || undefined;
  const dateTo = searchParams.get('date_to') || undefined;

  try {
    const results = await syncWindsorAnalytics(dateFrom, dateTo);
    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('[windsor-sync cron] failed:', err.message || err);
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}
