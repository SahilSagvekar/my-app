// src/app/api/cron/billing-sync/route.ts
// Runs syncStripeCustomers for EVERY client automatically (hourly — see
// worker.ts/wrangler.toml). Webhooks handle real-time updates already; this
// is the safety net for anything a webhook missed, so nobody has to
// remember to click "Sync & Refresh" for it to actually happen.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import { syncStripeCustomers } from '@/lib/billing-sync';

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

  const db = getDbHttp();
  const allCustomers = await db.query.stripeCustomer.findMany({
    with: { client: true },
  });

  console.log(`[billing-sync cron] Syncing ${allCustomers.length} Stripe customer(s)...`);
  const { invoicesSynced, subscriptionsSynced } = await syncStripeCustomers(db, allCustomers as any);

  return NextResponse.json({
    customersSynced: allCustomers.length,
    invoicesSynced,
    subscriptionsSynced,
  });
}