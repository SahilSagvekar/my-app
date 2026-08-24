// src/app/api/cron/billing-warnings/route.ts
// Daily job: email clients whose nextBillingDate is ~3 days away and who have
// autoInvoiceActive (or an upcoming bill date on portal access).

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import { clientPortalAccess as clientPortalAccessTable } from '@/lib/db/schema';
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';

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

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const db = getDbHttp();
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() + 3);
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCHours(23, 59, 59, 999);

  const results: Array<{ clientId: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }> = [];

  try {
    const dueSoon = await db.query.clientPortalAccess.findMany({
      where: and(
        eq(clientPortalAccessTable.autoInvoiceActive, true),
        isNotNull(clientPortalAccessTable.nextBillingDate),
        gte(clientPortalAccessTable.nextBillingDate, windowStart.toISOString()),
        lte(clientPortalAccessTable.nextBillingDate, windowEnd.toISOString()),
      ),
      with: { client: true },
    });

    for (const access of dueSoon) {
      const client = access.client;
      try {
        if (!client.email) {
          results.push({ clientId: client.id, status: 'skipped', reason: 'no email' });
          continue;
        }
        await (await import('@/app/api/stripe/webhook/route')).sendBillingWarningEmail(
          client.companyName || client.name,
          client.email,
          new Date(access.nextBillingDate!)
        );
        results.push({ clientId: client.id, status: 'sent' });
      } catch (err: any) {
        console.error(`[billing-warnings] Failed for ${client.id}:`, err);
        results.push({ clientId: client.id, status: 'failed', reason: err.message });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    return NextResponse.json({
      ok: true,
      message: `Sent ${sent} billing warning(s) of ${dueSoon.length} due in 3 days`,
      results,
    });
  } catch (err: any) {
    console.error('[billing-warnings] Fatal error:', err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
